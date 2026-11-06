import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AccountError,
  accountAdmin,
  accountProfile,
  authenticateAccount,
} from "./account-server";
import { readDocument, writeDocument } from "./school-storage";

export const RESET_CONFIRMATION = "ล้างข้อมูลการแข่งขันทั้งหมด";
const bucket = "team-files",
  claimPath = "competition-reset/claim.json";
const tables = [
  "athletics_results",
  "medals",
  "matches",
  "athletics_events",
  "registrations",
  "team_files",
  "competitions",
] as const;
type Row = Record<string, unknown>;
type Entry = { table: string; row: Row } | { path: string; bytes: string };
type Snapshot = {
  entries: Entry[];
  counts: Record<string, number>;
  fingerprint: string;
};
export type ResetJob = {
  id: string;
  createdAt: string;
  status: "preparing" | "clearing" | "partial" | "complete" | "released";
  processed: number;
  total: number;
  fingerprint: string;
  manifest?: string;
  error?: string;
  executionStartedAt?: number;
  executionToken?: string;
};
const hash = (v: unknown) =>
  createHash("sha256").update(stable(v)).digest("hex");
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );
}
const store = (client: SupabaseClient) => client.storage.from(bucket);
function check(error: unknown) {
  if (error)
    throw new AccountError(
      "การเก็บสำรองหรือล้างข้อมูลไม่สำเร็จ กรุณาลองดำเนินการต่อ",
      503,
    );
}
async function document<T>(
  client: SupabaseClient,
  path: string,
): Promise<T | null> {
  const r = await store(client).download(path);
  if (r.error) {
    if (
      ["404", "400"].includes(String(r.error.statusCode)) &&
      /not found|does not exist/i.test(r.error.message)
    )
      return null;
    check(r.error);
  }
  return r.data ? (JSON.parse(await r.data.text()) as T) : null;
}
async function immutable(client: SupabaseClient, path: string, value: unknown) {
  const raw = stable(value);
  if (Buffer.byteLength(raw) > 1_000_000)
    throw new AccountError("ส่วนสำรองข้อมูลใหญ่เกินกำหนด", 413);
  const r = await store(client).upload(path, raw, {
    contentType: "application/json",
    upsert: false,
  });
  if (r.error) {
    const existing = await document(client, path);
    if (stable(existing) !== raw) check(r.error);
  }
}
async function claim(client: SupabaseClient) {
  return document<{ id: string }>(client, claimPath);
}
export async function assertCompetitionOpen(
  client: SupabaseClient = accountAdmin(),
) {
  if (await claim(client))
    throw new AccountError(
      "กำลังดำเนินการล้างข้อมูลการแข่งขัน กรุณารอผู้ดูแลดำเนินการต่อ",
      409,
    );
}
export async function authorizeReset(request: Request) {
  const { user, client } = await authenticateAccount(request);
  if ((await accountProfile(client, user.id))?.role !== "admin")
    throw new AccountError("เฉพาะผู้ดูแลระบบเท่านั้น", 403);
  return accountAdmin();
}
async function snapshot(client: SupabaseClient): Promise<Snapshot> {
  const entries: Entry[] = [],
    counts: Record<string, number> = {};
  let size = 0;
  const deadline = Date.now() + 18_000;
  function add(e: Entry) {
    if ("table" in e) {
      const predicate = new URLSearchParams();
      for (const [key, value] of Object.entries(e.row))
        predicate.set(
          key,
          value === null
            ? "is.null"
            : `eq.${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
        );
      // Keep a margin for the host, table path and PostgREST select parameter.
      // Exact-row equality stays mandatory; a revision alone cannot protect out-of-band changes.
      if (Buffer.byteLength(predicate.toString()) + 500 > 7_000)
        throw new AccountError(
          "ข้อมูลแถวหรือตารางแข่งขันใหญ่เกินขนาดที่ล้างผ่านระบบนี้ได้อย่างปลอดภัย กรุณาติดต่อผู้ดูแลระบบสำรองข้อมูล",
          413,
        );
    }
    size += Buffer.byteLength(stable(e));
    if (size > 6_000_000 || Date.now() > deadline)
      throw new AccountError(
        "ข้อมูลเกินขนาดที่ล้างได้อย่างปลอดภัย กรุณาติดต่อผู้ดูแลระบบสำรองข้อมูล",
        413,
      );
    entries.push(e);
  }
  for (const table of tables) {
    counts[table] = 0;
    for (let offset = 0; ; offset += 200) {
      const r = await client
        .from(table)
        .select("*")
        .order("id")
        .range(offset, offset + 199);
      check(r.error);
      const rows = (r.data || []) as Row[];
      for (const row of rows) {
        if (table === "competitions") {
          const policy = row.registration_policy as Row | null;
          const m = policy?.management as Row | undefined;
          if (
            !m ||
            (!((m.teams as unknown[]) || []).length &&
              !((m.fixtures as unknown[]) || []).length)
          )
            continue;
        }
        counts[table]++;
        add({ table, row });
      }
      if (rows.length < 200) break;
    }
  }
  // Every coach version is archived, including superseded histories. Profile/logo prefixes are excluded.
  async function walk(prefix: string) {
    for (let offset = 0; ; offset += 100) {
      const r = await store(client).list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      check(r.error);
      for (const f of r.data || []) {
        const path = prefix ? `${prefix}/${f.name}` : f.name;
        if (f.id === null) {
          await walk(path);
        } else {
          const b = await store(client).download(path);
          check(b.error);
          if (!b.data) throw new AccountError("ไม่พบไฟล์สำรอง", 503);
          add({
            path,
            bytes: Buffer.from(await b.data.arrayBuffer()).toString("base64"),
          });
          counts.coachFiles = (counts.coachFiles || 0) + 1;
        }
      }
      if ((r.data || []).length < 100) break;
    }
  }
  await walk("school-coaches");
  // team_files path columns differ across hosted schema revisions; refuse unknown paths.
  for (const e of [...entries])
    if ("table" in e && e.table === "team_files") {
      const path = e.row.storage_path ?? e.row.file_path ?? e.row.path;
      if (
        typeof path !== "string" ||
        !/\.(csv|xls|xlsx)$/i.test(path) ||
        /[\\%\x00-\x1f]/.test(path) ||
        path
          .split("/")
          .some((segment) => !segment || segment === "." || segment === "..") ||
        /^(?:school-profiles|school-coaches|competition-reset|account-[^/]*|admin-[^/]*)(?:\/|$)/i.test(
          path,
        )
      )
        throw new AccountError(
          "ไม่สามารถยืนยันตำแหน่งไฟล์ทีมเพื่อสำรองได้",
          409,
        );
      const b = await store(client).download(path);
      check(b.error);
      if (!b.data) throw new AccountError("ไม่พบไฟล์ทีมเพื่อสำรอง", 503);
      add({
        path,
        bytes: Buffer.from(await b.data.arrayBuffer()).toString("base64"),
      });
    }
  return { entries, counts, fingerprint: hash(entries) };
}
export async function resetPreview(client: SupabaseClient) {
  const { counts, fingerprint } = await snapshot(client);
  return { counts, fingerprint };
}
export async function currentResetJob(client: SupabaseClient) {
  const c = await claim(client);
  return c
    ? (
        await readDocument<ResetJob | null>(
          client,
          `competition-reset/${c.id}/state`,
          null,
        )
      ).value || (c as ResetJob)
    : null;
}
async function save(
  client: SupabaseClient,
  job: ResetJob,
  version: string | null,
) {
  return writeDocument(
    client,
    `competition-reset/${job.id}/state`,
    job,
    version,
    null as ResetJob | null,
  );
}
function archiveId(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))
    throw new AccountError("รหัสสำรองไม่ถูกต้อง");
  return value;
}
export async function resetBackup(
  client: SupabaseClient,
  id: unknown,
  part: unknown,
) {
  const root = `competition-reset/${archiveId(id)}`;
  if (
    part !== "manifest" &&
    !(typeof part === "string" && /^\d{1,5}$/.test(part))
  )
    throw new AccountError("ส่วนสำรองไม่ถูกต้อง");
  const value = await document(
    client,
    `${root}/${part === "manifest" ? "manifest" : `part-${part}`}.json`,
  );
  if (!value) throw new AccountError("ยังไม่มีส่วนสำรองนี้", 404);
  return value;
}
export async function resetArchives(
  client: SupabaseClient,
  requestedOffset: unknown = "0",
) {
  const offset = Number(requestedOffset ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw new AccountError("หน้าประวัติสำรองไม่ถูกต้อง");
  const limit = 25;
  const listed = await store(client).list("competition-reset", {
    limit,
    offset,
    sortBy: { column: "name", order: "asc" },
  });
  check(listed.error);
  const archives: {
    id: string;
    createdAt: string;
    counts: Record<string, number>;
    parts: number;
    sha256: string;
  }[] = [];
  for (const item of listed.data || []) {
    if (item.id !== null || !/^[0-9a-f-]{36}$/i.test(item.name)) continue;
    const manifest = await document<Record<string, unknown>>(
      client,
      `competition-reset/${item.name}/manifest.json`,
    );
    if (!manifest) continue;
    if (
      manifest.id !== item.name ||
      !Number.isSafeInteger(manifest.parts) ||
      Number(manifest.parts) < 0 ||
      typeof manifest.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(manifest.sha256) ||
      typeof manifest.createdAt !== "string" ||
      !manifest.counts ||
      typeof manifest.counts !== "object" ||
      Array.isArray(manifest.counts)
    )
      throw new AccountError(
        "ข้อมูลรายการสำรองเสียหาย กรุณาติดต่อผู้ดูแล",
        503,
      );
    archives.push({
      id: item.name,
      createdAt: manifest.createdAt,
      counts: manifest.counts as Record<string, number>,
      parts: Number(manifest.parts),
      sha256: manifest.sha256,
    });
  }
  return {
    archives,
    nextOffset: (listed.data || []).length === limit ? offset + limit : null,
  };
}
export async function startReset(
  client: SupabaseClient,
  body: Record<string, unknown>,
) {
  if (body.confirmation !== RESET_CONFIRMATION)
    throw new AccountError("กรอกข้อความยืนยันให้ตรงกัน");
  await assertCompetitionOpen(client);
  const preview = await resetPreview(client);
  if (body.fingerprint !== preview.fingerprint)
    throw new AccountError("ข้อมูลเปลี่ยนแล้ว กรุณาดูตัวอย่างใหม่", 409);
  const job: ResetJob = {
    id: randomUUID(),
    status: "preparing",
    processed: 0,
    total: 0,
    fingerprint: preview.fingerprint,
    createdAt: new Date().toISOString(),
  };
  // The claim itself contains recoverable state if the first state upload is interrupted.
  const r = await store(client).upload(claimPath, stable(job), {
    contentType: "application/json",
    upsert: false,
  });
  if (r.error)
    throw new AccountError("มีงานล้างข้อมูลอยู่แล้ว กรุณาโหลดสถานะใหม่", 409);
  await save(client, job, null);
  return job;
}
export async function stepReset(client: SupabaseClient, id: unknown) {
  const jobId = archiveId(id),
    c = await claim(client);
  if (!c) {
    const old = await readDocument<ResetJob | null>(
      client,
      `competition-reset/${jobId}/state`,
      null,
    );
    if (old.value?.status === "complete") return old.value;
    throw new AccountError("ไม่พบงานที่กำลังทำ", 409);
  }
  if (c.id !== jobId) throw new AccountError("งานล้างข้อมูลไม่ตรงกัน", 409);
  const state = await readDocument<ResetJob | null>(
    client,
    `competition-reset/${jobId}/state`,
    null,
  );
  let job = state.value;
  if (!job) {
    job = c as ResetJob;
    await save(client, job, null);
    return job;
  }
  if (job.status === "released")
    throw new AccountError("งานนี้ถูกยุติแล้ว ไม่สามารถดำเนินการต่อได้", 409);
  if (job.executionStartedAt && Date.now() - job.executionStartedAt < 300_000)
    throw new AccountError(
      "คำขอก่อนหน้ายังทำงานอยู่ กรุณารอแล้วโหลดสถานะใหม่",
      409,
    );
  // CAS reservation prevents two HTTP workers from deleting against the same progress version.
  // maxDuration=60; a five-minute recovery window exceeds the server execution limit.
  job = {
    ...job,
    executionStartedAt: Date.now(),
    executionToken: randomUUID(),
  };
  const reserved = await save(client, job, state.version);
  const root = `competition-reset/${jobId}`,
    deadline = Date.now() + 20_000;
  try {
    if (job.status === "preparing") {
      const s = await snapshot(client);
      if (s.fingerprint !== job.fingerprint)
        throw new AccountError(
          "ข้อมูลเปลี่ยนหลังเริ่มงาน ต้องตรวจสอบและยกเลิกก่อนเริ่มใหม่",
          409,
        );
      const raw = Buffer.from(stable(s.entries));
      const parts = Math.ceil(raw.length / 650_000);
      for (let i = 0; i < parts; i++)
        await immutable(client, `${root}/part-${i}.json`, {
          encoding: "base64-json",
          data: raw.subarray(i * 650_000, (i + 1) * 650_000).toString("base64"),
        });
      await immutable(client, `${root}/manifest.json`, {
        id: jobId,
        parts,
        sha256: createHash("sha256").update(raw).digest("hex"),
        counts: s.counts,
        total: s.entries.length,
        createdAt: job.createdAt,
      });
      job = {
        ...job,
        status: "clearing",
        total: s.entries.length,
        manifest: `${root}/manifest.json`,
        error: undefined,
      };
    } else {
      const manifest = await document<{ parts: number; sha256: string }>(
        client,
        `${root}/manifest.json`,
      );
      if (!manifest)
        throw new AccountError("ไม่พบสำรองที่สมบูรณ์ ห้ามลบข้อมูล", 503);
      const chunks = [];
      for (let i = 0; i < manifest.parts; i++) {
        const p = await document<{ data: string }>(
          client,
          `${root}/part-${i}.json`,
        );
        if (!p) throw new AccountError("สำรองไม่ครบ ห้ามลบข้อมูล", 503);
        chunks.push(Buffer.from(p.data, "base64"));
      }
      const raw = Buffer.concat(chunks);
      if (createHash("sha256").update(raw).digest("hex") !== manifest.sha256)
        throw new AccountError("สำรองเสียหาย ห้ามลบข้อมูล", 503);
      const entries = JSON.parse(raw.toString()) as Entry[];
      job = { ...job, status: "clearing", error: undefined };
      const end = Math.min(job.processed + 15, entries.length);
      for (; job.processed < end && Date.now() < deadline; job.processed++) {
        const e = entries[job.processed];
        if ("table" in e) {
          const found = await client
            .from(e.table)
            .select("*")
            .eq("id", e.row.id)
            .maybeSingle();
          check(found.error);
          if (!found.data) continue;
          const policy = e.row.registration_policy as Row;
          const cleared =
            e.table === "competitions"
              ? {
                  ...policy,
                  management: {
                    ...(policy.management as Row),
                    teams: [],
                    fixtures: [],
                    revision:
                      Number((policy.management as Row).revision || 0) + 1,
                  },
                }
              : null;
          if (
            e.table === "competitions" &&
            stable(found.data.registration_policy) === stable(cleared)
          )
            continue;
          if (stable(found.data) !== stable(e.row))
            throw new AccountError(
              "ข้อมูลเปลี่ยนจากสำรอง จึงหยุดเพื่อรักษาข้อมูลใหม่",
              409,
            );
          let q =
            e.table === "competitions"
              ? client.from(e.table).update({ registration_policy: cleared })
              : client.from(e.table).delete();
          for (const [key, v] of Object.entries(e.row))
            q =
              v === null
                ? q.is(key, null)
                : q.eq(key, typeof v === "object" ? JSON.stringify(v) : v);
          const changed = await q.select("id");
          check(changed.error);
          if (!changed.data?.length)
            throw new AccountError(
              "ข้อมูลเปลี่ยนระหว่างล้าง จึงหยุดดำเนินการ",
              409,
            );
        } else {
          const b = await store(client).download(e.path);
          if (b.error) {
            if (/not found|does not exist/i.test(b.error.message)) continue;
            check(b.error);
          }
          if (
            b.data &&
            Buffer.from(await b.data.arrayBuffer()).toString("base64") !==
              e.bytes
          )
            throw new AccountError("ไฟล์เปลี่ยนจากสำรอง จึงหยุดดำเนินการ", 409);
          check((await store(client).remove([e.path])).error);
        }
      }
      if (job.processed === entries.length) {
        const fresh = await resetPreview(client);
        if (Object.values(fresh.counts).some((n) => n > 0))
          throw new AccountError("พบข้อมูลใหม่ที่ไม่ได้ล้าง กรุณาตรวจสอบ", 409);
        job.status = "complete";
      }
    }
  } catch (error) {
    job = {
      ...job,
      status: job.status === "preparing" ? "preparing" : "partial",
      error: error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ",
    };
  }
  if (job.status !== "complete")
    job = { ...job, executionStartedAt: undefined, executionToken: undefined };
  const saved = await save(client, job, reserved.version);
  if (job.status === "complete") await removeClaimWithLease(client, job);
  return saved.value;
}
/** Every shared-key removal runs while this job retains an exclusive CAS lease.
 * The terminal lease survives cleanup so a stale worker cannot later erase a new claim.
 * A failed cleanup can obtain a new lease after five minutes (maxDuration is 60 seconds).
 */
async function removeClaimWithLease(client: SupabaseClient, job: ResetJob) {
  if (!job.executionToken || !job.executionStartedAt)
    throw new AccountError("ไม่พบสิทธิ์ยุติงาน", 409);
  const current = await claim(client);
  if (!current) return;
  if (current.id !== job.id)
    throw new AccountError("งานล้างข้อมูลเปลี่ยนแล้ว กรุณาโหลดสถานะใหม่", 409);
  check((await store(client).remove([claimPath])).error);
}
/** Releasing maintenance never deletes competition data or archives. */
export async function releaseReset(client: SupabaseClient, id: unknown) {
  const jobId = archiveId(id),
    c = await claim(client);
  if (!c) return { released: true };
  if (c.id !== jobId) throw new AccountError("งานไม่ตรงกัน", 409);
  const s = await readDocument<ResetJob | null>(
    client,
    `competition-reset/${jobId}/state`,
    null,
  );
  const j = s.value || (c as ResetJob);
  if (j.executionStartedAt && Date.now() - j.executionStartedAt < 300_000)
    throw new AccountError(
      "คำขอก่อนหน้ายังทำงานอยู่ กรุณารอห้านาทีก่อนยุติงาน",
      409,
    );
  // Every attempt, including released retries, arbitrates with a new immutable CAS
  // successor. Retain this lease after removing the shared claim key.
  const terminal: ResetJob = {
    ...j,
    status: "released",
    executionStartedAt: Date.now(),
    executionToken: randomUUID(),
    error: "ผู้ดูแลยุติงาน ข้อมูลอาจถูกล้างบางส่วน ตรวจสอบสำรองก่อนเริ่มใหม่",
  };
  await save(client, terminal, s.version);
  await removeClaimWithLease(client, terminal);
  return { released: true, archiveId: jobId };
}
