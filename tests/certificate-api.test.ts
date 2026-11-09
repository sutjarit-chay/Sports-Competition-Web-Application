import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/certificates/route";
import { GET as verify } from "../app/api/certificates/verify/route";
import {
  GET as settingsGet,
  PUT as settingsPut,
} from "../app/api/certificate-template/route";
const school = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  competition = "33333333-3333-4333-8333-333333333333";
async function fixture(
  work: (f: {
    setRole: (s: string) => void;
    files: Map<string, string>;
    tables: Record<string, any[]>;
  }) => Promise<void>,
) {
  const saved = { ...process.env },
    fetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://certificate-fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  let role = "admin";
  const files = new Map<string, string>();
  const tables: Record<string, any[]> = {
    schools: [
      { id: school, name: "โรงเรียนหนึ่ง" },
      { id: other, name: "โรงเรียนสอง" },
    ],
    competitions: [
      {
        id: competition,
        sport: "ฟุตบอล",
        name: "ฟุตบอล ประถมชาย",
        gender: "ชาย",
        age_group: "ประถมศึกษา",
        win_points: 3,
        draw_points: 1,
        loss_points: 0,
        registration_policy: null,
      },
    ],
    registrations: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        school_id: school,
        competition_id: competition,
        athlete_name: "นักกีฬา หนึ่ง",
        bib: "1",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        school_id: other,
        competition_id: competition,
        athlete_name: "นักกีฬา สอง",
        bib: "2",
      },
    ],
    matches: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        competition_id: competition,
        group_name: "ชิงชนะเลิศ",
        home_school_id: school,
        away_school_id: other,
        starts_at: "2026-11-20T06:00:00Z",
        venue: "สนาม",
        status: "finished",
        home_score: 2,
        away_score: 1,
        revision: 1,
      },
    ],
    athletics_events: [],
    athletics_results: [],
    medals: [],
  };
  globalThis.fetch = async (input, init) => {
    const req =
        input instanceof Request ? input : new Request(String(input), init),
      u = new URL(req.url);
    assert.equal(u.origin, "https://certificate-fixture.invalid");
    const json = (v: unknown, status = 200, h = {}) =>
      Response.json(v, { status, headers: h });
    if (u.pathname === "/auth/v1/user")
      return req.headers.get("authorization") === "Bearer valid"
        ? json({ id: "user", aud: "authenticated" })
        : json({}, 401);
    if (u.pathname === "/rest/v1/profiles")
      return json({ id: "user", role, school_id: school });
    if (u.pathname.startsWith("/rest/v1/")) {
      const table = u.pathname.split("/").at(-1)!;
      let rows = [...(tables[table] || [])];
      const id = u.searchParams.get("id");
      if (id?.startsWith("eq."))
        rows = rows.filter((r) => r.id === id.slice(3));
      return json(rows, 200, {
        "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
      });
    }
    if (u.pathname === "/storage/v1/object/list/team-files") {
      const b = await req.json();
      const found = [...files.keys()]
        .filter(
          (k) =>
            k.startsWith(b.prefix + "/") &&
            !k.slice(b.prefix.length + 1).includes("/"),
        )
        .reverse()
        .map((k) => ({ name: k.slice(b.prefix.length + 1), id: k }));
      return json(found.slice(0, b.limit || 100));
    }
    if (u.pathname.startsWith("/storage/v1/object/")) {
      const p = decodeURIComponent(u.pathname.replace(/^.*team-files\//, ""));
      if (req.method === "POST") {
        if (files.has(p))
          return json({ message: "already exists", statusCode: "409" }, 409);
        files.set(p, await req.text());
        return json({ Key: p });
      }
      return files.has(p)
        ? new Response(files.get(p), {
            headers: { "content-type": "application/json" },
          })
        : json({ message: "not found", statusCode: "404" }, 404);
    }
    throw Error("Unexpected " + u.pathname);
  };
  try {
    await work({
      setRole: (r) => {
        role = r;
      },
      files,
      tables,
    });
  } finally {
    globalThis.fetch = fetch;
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}
const request = (action?: string, extra: Record<string, unknown> = {}) =>
  new Request(
    `https://sports.example/api/certificates${action ? "" : `?competitionId=${competition}`}`,
    {
      method: action ? "POST" : "GET",
      headers: {
        Authorization: "Bearer valid",
        "Content-Type": "application/json",
      },
      ...(action
        ? {
            body: JSON.stringify({
              action,
              competitionId: competition,
              ...extra,
            }),
          }
        : {}),
    },
  );
test("certificate endpoints reject anonymous and forbidden roles before private writes", async () =>
  fixture(async (f) => {
    assert.equal(
      (
        await GET(
          new Request(
            `https://sports.example/api/certificates?competitionId=${competition}`,
          ),
        )
      ).status,
      401,
    );
    for (const role of [
      "viewer",
      "referee",
      "recorder",
      "school",
      "school_admin",
    ]) {
      f.setRole(role);
      assert.equal((await POST(request("preview"))).status, 403);
      assert.equal(
        (
          await settingsGet(
            new Request("https://sports.example/api/certificate-template", {
              headers: { Authorization: "Bearer valid" },
            }),
          )
        ).status,
        403,
      );
    }
    assert.equal(f.files.size, 0);
  }));
test("publish freezes trusted recipients, isolates school downloads, revokes QR, and rejects stale versions/sources", async () =>
  fixture(async (f) => {
    const preview = await (await POST(request("preview"))).json();
    assert.equal(preview.candidates.length, 2);
    assert.equal(preview.blocked.length, 0);
    f.tables.matches[0].revision = 2;
    assert.equal(
      (
        await POST(
          request("publish", {
            expectedVersion: null,
            fingerprint: preview.fingerprint,
          }),
        )
      ).status,
      409,
    );
    const fresh = await (await POST(request("preview"))).json();
    const published = await POST(
      request("publish", {
        expectedVersion: null,
        fingerprint: fresh.fingerprint,
      }),
    );
    assert.equal(published.status, 200);
    const result = await published.json();
    assert.equal(result.issue.records.length, 2);
    const record = result.issue.records[0];
    assert.equal(record.award, "gold");
    assert.equal(
      (
        await verify(
          new Request(
            `https://sports.example/api/certificates/verify?competitionId=${competition}&certificateId=${record.id}`,
          ),
        )
      ).status,
      200,
    );
    f.setRole("school_admin");
    const own = await (await GET(request())).json();
    assert.equal(own.issue.records.length, 1);
    assert.equal(own.issue.records[0].schoolId, school);
    f.setRole("admin");
    assert.equal(
      (await POST(request("revoke", { expectedVersion: null }))).status,
      409,
    );
    const revoked = await POST(
      request("revoke", { expectedVersion: result.version }),
    );
    assert.equal(revoked.status, 200);
    assert.equal(
      (
        await verify(
          new Request(
            `https://sports.example/api/certificates/verify?competitionId=${competition}&certificateId=${record.id}`,
          ),
        )
      ).status,
      404,
    );
    assert.ok(f.files.size >= 2);
  }));
test("incomplete results cannot be published as participation certificates", async () =>
  fixture(async (f) => {
    f.tables.matches[0].status = "scheduled";
    const p = await (await POST(request("preview"))).json();
    assert.ok(p.blocked.length > 0);
    assert.equal(
      (
        await POST(
          request("publish", {
            expectedVersion: null,
            fingerprint: p.fingerprint,
          }),
        )
      ).status,
      409,
    );
    assert.equal(f.files.size, 0);
  }));

test("download checks server scope and preserves the issued snapshot after source edits", async () =>
  fixture(async (f) => {
    const { POST: download } =
      await import("../app/api/certificates/download/route");
    const p = await (await POST(request("preview"))).json();
    const issued = await (
      await POST(
        request("publish", {
          expectedVersion: null,
          fingerprint: p.fingerprint,
        }),
      )
    ).json();
    const foreign = issued.issue.records.find((r: any) => r.schoolId === other);
    f.setRole("school_admin");
    assert.equal(
      (
        await download(
          request("download", { format: "pdf", ids: [foreign.id] }),
        )
      ).status,
      403,
    );
    assert.equal(
      (await download(request("download", { format: "pdf", schoolId: other })))
        .status,
      403,
    );
    assert.equal(
      (await download(request("download", { format: "pdf", preview: true })))
        .status,
      403,
    );
    f.tables.registrations[0].athlete_name = "แก้ชื่อหลังออก";
    const own = issued.issue.records.find((r: any) => r.schoolId === school);
    const result = await download(
      request("download", { format: "pdf", ids: [own.id] }),
    );
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("content-type"), "application/pdf");
    assert.ok(
      Buffer.from(await result.arrayBuffer()).toString("ascii", 0, 5) ===
        "%PDF-",
    );
    const frozen = await (await GET(request())).json();
    assert.equal(frozen.issue.records[0].recipientName, "นักกีฬา หนึ่ง");
  }));
test("template updates require admin and fresh versions; invalid Base64 has a Thai validation error", async () =>
  fixture(async (f) => {
    const { DEFAULT_CERTIFICATE_LAYOUT } =
      await import("../lib/certificate-types");
    const settingsRequest = (template: any, expectedVersion: any) =>
      new Request("https://sports.example/api/certificate-template", {
        method: "PUT",
        headers: {
          Authorization: "Bearer valid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ template, expectedVersion }),
      });
    const bad = await settingsPut(
      settingsRequest(
        { background: "bad base64", layout: DEFAULT_CERTIFICATE_LAYOUT },
        null,
      ),
    );
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).error, /Base64/);
    assert.equal(f.files.size, 0);
    const saved = await settingsPut(
      settingsRequest(
        { background: null, layout: DEFAULT_CERTIFICATE_LAYOUT },
        null,
      ),
    );
    assert.equal(saved.status, 200);
    const v = await saved.json();
    assert.ok(v.version);
    assert.equal(
      (
        await settingsPut(
          settingsRequest(
            { background: null, layout: DEFAULT_CERTIFICATE_LAYOUT },
            null,
          ),
        )
      ).status,
      409,
    );
    f.setRole("school_admin");
    assert.equal(
      (
        await settingsPut(
          settingsRequest(
            { background: null, layout: DEFAULT_CERTIFICATE_LAYOUT },
            v.version,
          ),
        )
      ).status,
      403,
    );
  }));
