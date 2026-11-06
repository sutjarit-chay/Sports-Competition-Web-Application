import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import assert from "node:assert/strict";
import {
  RESET_CONFIRMATION,
  resetPreview,
  assertCompetitionOpen,
} from "../lib/competition-reset";
import { accountAdmin } from "../lib/account-server";
test("reset preview uses SDK HTTP, preserves identities and blocks on active claim", async () => {
  const old = globalThis.fetch;
  const env = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  const seen: string[] = [];
  let active = false;
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input));
    assert.equal(u.origin, "https://fixture.invalid");
    seen.push(u.pathname);
    assert.ok(
      !init?.method || init.method === "GET" || u.pathname.includes("/list/"),
    );
    if (u.pathname.includes("/storage/v1/object/list/"))
      return Response.json([]);
    if (u.pathname.includes("/storage/v1/object/"))
      return active
        ? Response.json({ id: "job" })
        : Response.json({ message: "not found" }, { status: 404 });
    return Response.json([]);
  };
  try {
    const p = await resetPreview(accountAdmin());
    assert.equal(typeof p.fingerprint, "string");
    assert.equal(p.counts.registrations, 0);
    assert.ok(!seen.some((x) => /auth|profiles|schools|rule_catalog/.test(x)));
    assert.ok(RESET_CONFIRMATION.length > 10);
    await assertCompetitionOpen(accountAdmin());
    active = true;
    await assert.rejects(assertCompetitionOpen(accountAdmin()), /ดำเนินการ/);
  } finally {
    globalThis.fetch = old;
    process.env = env;
  }
});

import { GET, POST } from "../app/api/competition-reset/route";
import {
  startReset,
  stepReset,
  currentResetJob,
  releaseReset,
} from "../lib/competition-reset";

type R = Record<string, any>;
async function fixture(
  work: (f: {
    rows: Record<string, R[]>;
    files: Map<string, string>;
    request: (body?: R, role?: string) => Request;
    failBackup: () => void;
    failDelete: () => void;
    deletes: () => number;
    beforeClaimRemoval: (callback: () => Promise<void>) => void;
    pauseNextClaimRead: () => { reached: Promise<void>; resume: () => void };
  }) => Promise<void>,
) {
  const old = globalThis.fetch,
    env = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  const rows: Record<string, R[]> = {
    athletics_results: [{ id: "r", value: 1 }],
    medals: [{ id: "m", award: "gold" }],
    matches: [{ id: "match", revision: 1 }],
    athletics_events: [{ id: "event" }],
    registrations: [{ id: "athlete", athlete_name: "A" }],
    team_files: [],
    competitions: [
      {
        id: "competition",
        name: "Keep",
        win_points: 3,
        registration_policy: {
          ruleId: "keep",
          reserves: 2,
          management: {
            revision: 1,
            teams: ["school"],
            fixtures: [{ id: "match" }],
            details: "keep",
          },
        },
      },
    ],
  };
  const files = new Map<string, string>();
  const created = new Map<string, number>();
  let sequence = 0;
  let claimRemoval: (() => Promise<void>) | undefined;
  let claimRead: (() => Promise<void>) | undefined;
  let backupFailure = false,
    deleteFailure = false,
    deleted = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://fixture.invalid");
    const method = init?.method || "GET",
      headers = new Headers(init?.headers);
    let body: any = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const path = url.pathname;
    if (path === "/auth/v1/user")
      return Response.json({
        id: "admin",
        aud: "authenticated",
        role: "authenticated",
        app_metadata: { role: "admin" },
        user_metadata: {},
        created_at: "2026-01-01",
      });
    if (path === "/rest/v1/profiles")
      return Response.json({
        id: "admin",
        role: headers.get("authorization")?.includes("school")
          ? "school"
          : "admin",
        school_id: null,
      });
    if (path.includes("/storage/v1/object/list/")) {
      const prefix = body.prefix as string;
      const values = [...files.keys()]
        .filter((k) => k.startsWith(prefix + "/"))
        .map((k) => k.slice(prefix.length + 1))
        .map((k) => (k.includes("/") ? k.split("/")[0] + "/" : k))
        .filter((k, i, all) => all.indexOf(k) === i)
        .map((entry) => {
          const folder = entry.endsWith("/"),
            name = folder ? entry.slice(0, -1) : entry;
          return {
            name,
            id: folder ? null : name,
            created_at: created.get(prefix + "/" + name),
          };
        });
      return Response.json(
        values
          .sort((a, b) => Number(b.created_at) - Number(a.created_at))
          .slice(body.offset || 0, (body.offset || 0) + (body.limit || 100)),
      );
    }
    if (path.includes("/storage/v1/object/")) {
      const key = decodeURIComponent(
        path.replace(
          /^\/storage\/v1\/object\/(?:authenticated\/)?team-files\//,
          "",
        ),
      );
      if (method === "GET") {
        const response = files.has(key)
          ? new Response(files.get(key))
          : Response.json(
              { message: "Object not found", statusCode: "404" },
              { status: 404 },
            );
        if (key === "competition-reset/claim.json" && claimRead) {
          const callback = claimRead;
          claimRead = undefined;
          await callback();
        }
        return response;
      }
      if (method === "DELETE") {
        if (
          body.prefixes?.includes("competition-reset/claim.json") &&
          claimRemoval
        )
          await claimRemoval();
        for (const k of body.prefixes || []) files.delete(k);
        return Response.json([]);
      }
      if (backupFailure && key.includes("/part-"))
        return Response.json(
          { message: "backup failure", statusCode: "500" },
          { status: 500 },
        );
      if (files.has(key))
        return Response.json(
          { message: "already exists", statusCode: "409" },
          { status: 409 },
        );
      created.set(key, ++sequence);
      files.set(
        key,
        typeof init?.body === "string"
          ? init.body
          : await new Response(init?.body as BodyInit).text(),
      );
      return Response.json({ Key: key });
    }
    const table = path.split("/").at(-1)!;
    assert.ok(table in rows, `unexpected table ${table}`);
    let found = rows[table];
    for (const [key, value] of url.searchParams) {
      if (["select", "order", "offset", "limit"].includes(key)) continue;
      const [op, ...rest] = value.split("."),
        raw = rest.join(".");
      found = found.filter((r) =>
        op === "is"
          ? r[key] === null
          : typeof r[key] === "object"
            ? isDeepStrictEqual(r[key], JSON.parse(raw))
            : String(r[key]) === raw,
      );
    }
    if (method === "DELETE" || method === "PATCH") {
      if (deleteFailure) {
        deleteFailure = false;
        return Response.json({ message: "transient failure" }, { status: 500 });
      }
      deleted++;
      if (method === "DELETE")
        rows[table] = rows[table].filter((r) => !found.includes(r));
      else for (const r of found) Object.assign(r, body);
      return Response.json(found.map((r) => ({ id: r.id })));
    }
    if (headers.get("accept")?.includes("object+json"))
      return Response.json(found[0] || null);
    const offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit") || 1000);
    return Response.json(found.slice(offset, offset + limit));
  };
  const request = (body?: R, role = "admin") =>
    new Request("http://localhost/api/competition-reset", {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${role}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    await work({
      rows,
      files,
      request,
      failBackup: () => {
        backupFailure = true;
      },
      failDelete: () => {
        deleteFailure = true;
      },
      deletes: () => deleted,
      beforeClaimRemoval: (callback) => {
        claimRemoval = callback;
      },
      pauseNextClaimRead: () => {
        let arrive!: () => void, resume!: () => void;
        const reached = new Promise<void>((resolve) => {
            arrive = resolve;
          }),
          gate = new Promise<void>((resolve) => {
            resume = resolve;
          });
        claimRead = async () => {
          arrive();
          await gate;
        };
        return { reached, resume };
      },
    });
  } finally {
    globalThis.fetch = old;
    process.env = env;
  }
}
test("only actual admin may preview or start; typed confirmation and fresh preview precede claim", async () =>
  fixture(async (f) => {
    assert.equal(
      (await GET(new Request("http://localhost/api/competition-reset"))).status,
      401,
    );
    assert.equal((await GET(f.request(undefined, "school"))).status, 403);
    const p = await resetPreview(accountAdmin());
    await assert.rejects(
      startReset(accountAdmin(), {
        confirmation: "wrong",
        fingerprint: p.fingerprint,
      }),
    );
    assert.equal(f.files.size, 0);
    f.rows.registrations.push({ id: "new" });
    await assert.rejects(
      startReset(accountAdmin(), {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      }),
    );
    assert.equal(f.files.size, 0);
    assert.equal(f.deletes(), 0);
  }));
test("backup failure performs no deletion, holds recoverable archive claim", async () =>
  fixture(async (f) => {
    const p = await resetPreview(accountAdmin()),
      j = await startReset(accountAdmin(), {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    f.failBackup();
    const step = await stepReset(accountAdmin(), j.id);
    assert.equal(step?.status, "preparing");
    assert.ok(step?.error);
    assert.equal(f.deletes(), 0);
    assert.equal((await currentResetJob(accountAdmin()))?.id, j.id);
  }));
test("immutable manifest precedes deletion; transient deletion resumes; repeated steps idempotent; policies retained", async () =>
  fixture(async (f) => {
    const p = await resetPreview(accountAdmin()),
      j = await startReset(accountAdmin(), {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    const backed = await stepReset(accountAdmin(), j.id);
    assert.equal(backed?.status, "clearing");
    assert.ok(f.files.has(`competition-reset/${j.id}/manifest.json`));
    assert.equal(f.deletes(), 0);
    f.failDelete();
    const failed = await stepReset(accountAdmin(), j.id);
    assert.equal(failed?.status, "partial");
    assert.ok(failed?.error);
    const done = await stepReset(accountAdmin(), j.id);
    assert.equal(done?.status, "complete", done?.error);
    assert.equal(f.rows.registrations.length, 0);
    assert.equal(f.rows.matches.length, 0);
    assert.equal(f.rows.competitions.length, 1);
    assert.equal(f.rows.competitions[0].win_points, 3);
    assert.equal(f.rows.competitions[0].registration_policy.ruleId, "keep");
    assert.deepEqual(
      f.rows.competitions[0].registration_policy.management.teams,
      [],
    );
    await assertCompetitionOpen(accountAdmin());
    assert.equal((await stepReset(accountAdmin(), j.id))?.status, "complete");
  }));
test("changed backed-up rows and newly inserted records are retained and reported partial", async () =>
  fixture(async (f) => {
    const p = await resetPreview(accountAdmin()),
      j = await startReset(accountAdmin(), {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    await stepReset(accountAdmin(), j.id);
    f.rows.matches[0].revision = 2;
    f.rows.registrations.push({ id: "new" });
    const partial = await stepReset(accountAdmin(), j.id);
    assert.equal(partial?.status, "partial");
    assert.equal(f.rows.matches[0].revision, 2);
    assert.ok(f.rows.registrations.some((r) => r.id === "new"));
    assert.ok(partial?.error);
  }));
test("archives coach history and team bytes while retaining school profiles; backup download requires admin", async () =>
  fixture(async (f) => {
    f.files.set("school-coaches/old.json", '[{"name":"old"}]');
    f.files.set("school-coaches/new.json", '[{"name":"new"}]');
    f.files.set("school-profiles/logo.png", "logo");
    f.files.set("uploads/team.csv", "athlete,name");
    f.rows.team_files.push({ id: "file", storage_path: "uploads/team.csv" });
    const p = await resetPreview(accountAdmin());
    assert.equal(p.counts.coachFiles, 2);
    const j = await startReset(accountAdmin(), {
      confirmation: RESET_CONFIRMATION,
      fingerprint: p.fingerprint,
    });
    await stepReset(accountAdmin(), j.id);
    const archive = JSON.parse(
      Buffer.from(
        JSON.parse(f.files.get(`competition-reset/${j.id}/part-0.json`)!).data,
        "base64",
      ).toString(),
    );
    assert.ok(archive.some((e: any) => e.path === "school-coaches/old.json"));
    assert.ok(
      archive.some(
        (e: any) =>
          e.path === "uploads/team.csv" &&
          Buffer.from(e.bytes, "base64").toString() === "athlete,name",
      ),
    );
    assert.ok(!archive.some((e: any) => e.path === "school-profiles/logo.png"));
    assert.equal(
      (
        await GET(
          new Request(
            `http://localhost/api/competition-reset?archiveId=${j.id}&part=manifest`,
          ),
        )
      ).status,
      401,
    );
    const done = await stepReset(accountAdmin(), j.id);
    assert.equal(done?.status, "complete", done?.error);
    assert.equal(f.files.get("school-profiles/logo.png"), "logo");
    assert.ok(!f.files.has("school-coaches/old.json"));
    assert.ok(!f.files.has("uploads/team.csv"));
  }));
test("two administrators cannot start or step the same state concurrently", async () =>
  fixture(async () => {
    const client = accountAdmin(),
      p = await resetPreview(client);
    const starts = await Promise.allSettled([
      startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      }),
      startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      }),
    ]);
    assert.equal(starts.filter((s) => s.status === "fulfilled").length, 1);
    const job = (
      starts.find(
        (s) => s.status === "fulfilled",
      ) as PromiseFulfilledResult<any>
    ).value;
    const steps = await Promise.allSettled([
      stepReset(client, job.id),
      stepReset(client, job.id),
    ]);
    assert.equal(steps.filter((s) => s.status === "fulfilled").length, 1);
    assert.equal((await currentResetJob(client))?.status, "clearing");
  }));

test("completed archives remain discoverable after claim removal; history is admin-only", async () =>
  fixture(async (f) => {
    const url = "http://localhost/api/competition-reset?archives=1";
    assert.equal((await GET(new Request(url))).status, 401);
    assert.equal(
      (
        await GET(
          new Request(url, { headers: { Authorization: "Bearer school" } }),
        )
      ).status,
      403,
    );
    const p = await resetPreview(accountAdmin()),
      j = await startReset(accountAdmin(), {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    await stepReset(accountAdmin(), j.id);
    await stepReset(accountAdmin(), j.id);
    assert.equal(await currentResetJob(accountAdmin()), null);
    const response = await GET(
      new Request(url, { headers: { Authorization: "Bearer admin" } }),
    );
    assert.equal(response.status, 200);
    const history = await response.json();
    assert.equal(history.archives.length, 1);
    assert.equal(history.archives[0].id, j.id);
    assert.equal(history.archives[0].parts, 1);
    assert.match(history.archives[0].sha256, /^[0-9a-f]{64}$/);
    assert.ok(history.archives[0].createdAt);
    assert.equal(history.archives[0].counts.registrations, 1);
  }));

test("backup history paginates root folders and excludes non-archive objects", async () =>
  fixture(async (f) => {
    for (let i = 0; i < 27; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      f.files.set(
        `competition-reset/${id}/manifest.json`,
        JSON.stringify({
          id,
          createdAt: "2026-11-06T00:00:00Z",
          counts: { registrations: 0 },
          parts: 1,
          sha256: "a".repeat(64),
        }),
      );
    }
    f.files.set("competition-reset/claim.json", "{}");
    f.files.set("competition-reset/not-an-archive/state.json", "{}");
    const first = await (
      await GET(
        new Request("http://localhost/api/competition-reset?archives=1", {
          headers: { Authorization: "Bearer admin" },
        }),
      )
    ).json();
    assert.equal(first.archives.length, 25);
    assert.equal(first.nextOffset, 25);
    const second = await (
      await GET(
        new Request(
          `http://localhost/api/competition-reset?archives=1&offset=${first.nextOffset}`,
          { headers: { Authorization: "Bearer admin" } },
        ),
      )
    ).json();
    assert.equal(second.archives.length, 2);
    assert.equal(second.nextOffset, null);
  }));

test("status remains available to recover a claim even when a new preview cannot be generated", async () =>
  fixture(async (f) => {
    const p = await resetPreview(accountAdmin()),
      j = await startReset(accountAdmin(), {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    f.rows.team_files.push({ id: "unknown-path" });
    const response = await GET(
      new Request("http://localhost/api/competition-reset?status=1", {
        headers: { Authorization: "Bearer admin" },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).job.id, j.id);
  }));

test("oversized conditional management predicates fail before a claim or deletion", async () =>
  fixture(async (f) => {
    f.rows.competitions[0].registration_policy.management.fixtures = [
      { id: "large", details: "x".repeat(8_000) },
    ];
    const response = await POST(
      f.request({
        action: "start",
        confirmation: RESET_CONFIRMATION,
        fingerprint: "outdated",
      }),
    );
    assert.equal(response.status, 413);
    assert.equal(f.files.size, 0);
    assert.equal(f.deletes(), 0);
  }));
test("active job is returned with a nullable preview and previewError if preview fails", async () =>
  fixture(async (f) => {
    const p = await resetPreview(accountAdmin()),
      j = await startReset(accountAdmin(), {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    f.rows.team_files.push({ id: "unknown-path" });
    const response = await GET(f.request());
    assert.equal(response.status, 200);
    const value = await response.json();
    assert.equal(value.preview, null);
    assert.equal(value.job.id, j.id);
    assert.ok(value.previewError);
  }));

test("release persists terminal state before claim removal and concurrent step performs no deletion", async () =>
  fixture(async (f) => {
    const client = accountAdmin(),
      p = await resetPreview(client),
      j = await startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    await stepReset(client, j.id);
    f.beforeClaimRemoval(async () => {
      const state = await currentResetJob(client);
      assert.equal(state?.status, "released");
      await assert.rejects(stepReset(client, j.id), /ยุติ/);
      assert.equal(f.deletes(), 0);
    });
    await releaseReset(client, j.id);
    assert.equal(await currentResetJob(client), null);
    assert.equal(f.deletes(), 0);
    await releaseReset(client, j.id);
    await assert.rejects(stepReset(client, j.id));
  }));
test("team-file metadata cannot archive internal account claims or unsafe non-roster paths", async () =>
  fixture(async (f) => {
    for (const path of [
      "account-usernames/claimed.json",
      "account-usernames/claimed.csv",
      "school-profiles/logo.csv",
      "competition-reset/archive.csv",
      "team/../roster.csv",
      "team/%2e%2e/roster.csv",
      "team/roster.json",
    ]) {
      f.rows.team_files = [{ id: "file", storage_path: path }];
      await assert.rejects(
        startReset(accountAdmin(), {
          confirmation: RESET_CONFIRMATION,
          fingerprint: "outdated",
        }),
        /ตำแหน่ง/,
      );
      assert.equal(f.files.size, 0);
      assert.equal(f.deletes(), 0);
    }
  }));

test("released claim removal is retryable without creating resumable work", async () =>
  fixture(async (f) => {
    const client = accountAdmin(),
      p = await resetPreview(client),
      j = await startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    let fail = true;
    f.beforeClaimRemoval(async () => {
      if (fail) {
        fail = false;
        throw new Error("interrupted removal");
      }
    });
    await assert.rejects(releaseReset(client, j.id));
    assert.equal((await currentResetJob(client))?.status, "released");
    await assert.rejects(stepReset(client, j.id), /ยุติ/);
    assert.equal(f.deletes(), 0);
    await assert.rejects(releaseReset(client, j.id), /ห้านาที/);
    const clock = Date.now;
    Date.now = () => clock() + 300_001;
    try {
      await releaseReset(client, j.id);
    } finally {
      Date.now = clock;
    }
    assert.equal(await currentResetJob(client), null);
    assert.equal(f.deletes(), 0);
  }));

test("stale release cleanup cannot remove a new reset claim", async () =>
  fixture(async (f) => {
    const client = accountAdmin(),
      p = await resetPreview(client),
      j = await startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    const barrier = f.pauseNextClaimRead(),
      stale = releaseReset(client, j.id);
    await barrier.reached;
    await releaseReset(client, j.id);
    const next = await startReset(client, {
      confirmation: RESET_CONFIRMATION,
      fingerprint: p.fingerprint,
    });
    barrier.resume();
    await assert.rejects(stale);
    assert.equal((await currentResetJob(client))?.id, next.id);
    assert.equal(f.deletes(), 0);
  }));
test("stale complete cleanup cannot remove a new reset claim", async () =>
  fixture(async (f) => {
    const client = accountAdmin(),
      p = await resetPreview(client),
      j = await startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    await stepReset(client, j.id);
    const barrier = f.pauseNextClaimRead(),
      stale = stepReset(client, j.id);
    await barrier.reached;
    assert.equal((await stepReset(client, j.id))?.status, "complete");
    const nextPreview = await resetPreview(client),
      next = await startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: nextPreview.fingerprint,
      });
    barrier.resume();
    await assert.rejects(stale);
    assert.equal((await currentResetJob(client))?.id, next.id);
  }));

test("two retries of released cleanup cannot erase a replacement claim", async () =>
  fixture(async (f) => {
    const client = accountAdmin(),
      p = await resetPreview(client),
      j = await startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
    let fail = true;
    f.beforeClaimRemoval(async () => {
      if (fail) {
        fail = false;
        throw new Error("initial cleanup interrupted");
      }
    });
    await assert.rejects(releaseReset(client, j.id));
    const clock = Date.now;
    Date.now = () => clock() + 300_001;
    try {
      const barrier = f.pauseNextClaimRead(),
        stale = releaseReset(client, j.id);
      await barrier.reached;
      await releaseReset(client, j.id);
      const next = await startReset(client, {
        confirmation: RESET_CONFIRMATION,
        fingerprint: p.fingerprint,
      });
      barrier.resume();
      await assert.rejects(stale);
      assert.equal((await currentResetJob(client))?.id, next.id);
      assert.equal(f.deletes(), 0);
    } finally {
      Date.now = clock;
    }
  }));
