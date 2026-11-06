import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/athlete-registrations/route";
import { defaultPolicy } from "../lib/registration";
const uid = "10000000-0000-4000-8000-000000000001",
  sid = "20000000-0000-4000-8000-000000000001",
  other = "20000000-0000-4000-8000-000000000002",
  cid = "30000000-0000-4000-8000-000000000001";
type Row = Record<string, any>;
async function fixture(
  work: (f: {
    rows: Row[];
    writes: Row[];
    role: (v: string) => void;
    maintenance: () => void;
  }) => Promise<void>,
) {
  const oldFetch = globalThis.fetch,
    saved = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://athlete-fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  let role = "school_admin",
    locked = false;
  const rows: Row[] = [],
    writes: Row[] = [];
  const tables: Record<string, Row[]> = {
    schools: [
      { id: sid, name: "โรงเรียนตนเอง" },
      { id: other, name: "โรงเรียนอื่น" },
    ],
    competitions: [
      {
        id: cid,
        sport: "ฟุตบอล",
        name: "ฟุตบอลชาย",
        age_group: "ประถมศึกษา",
        gender: "ชาย",
        win_points: 3,
        draw_points: 1,
        loss_points: 0,
        registration_policy: defaultPolicy("football-male"),
      },
    ],
    registrations: rows,
    matches: [],
    athletics_events: [],
    athletics_results: [],
    medals: [],
  };
  globalThis.fetch = async (input, init) => {
    const u = new URL(String(input));
    assert.equal(u.origin, "https://athlete-fixture.invalid");
    const send = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "content-type": "application/json",
          "content-range": `0-0/${Array.isArray(body) ? body.length : 1}`,
        },
      });
    if (u.pathname === "/auth/v1/user")
      return send({
        id: uid,
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
      });
    if (u.pathname.startsWith("/storage/"))
      return locked
        ? send({ id: "reset-job" })
        : send({ statusCode: "404", message: "Object not found" }, 404);
    const table = u.pathname.split("/").pop()!;
    if (table === "profiles") return send([{ id: uid, role, school_id: sid }]);
    let selected = tables[table] || [];
    for (const [key, val] of u.searchParams)
      if (val.startsWith("eq."))
        selected = selected.filter((r) => String(r[key]) === val.slice(3));
    if (!init?.method || init.method === "GET")
      return send(
        selected.slice(
          Number(u.searchParams.get("offset") || 0),
          Number(u.searchParams.get("offset") || 0) + 500,
        ),
      );
    const body = JSON.parse(String(init.body));
    writes.push({ table, body });
    if (init.method === "POST")
      rows.push(...(Array.isArray(body) ? body : [body]));
    if (init.method === "PATCH")
      selected.forEach((r) => Object.assign(r, body));
    return send(selected);
  };
  try {
    await work({
      rows,
      writes,
      role: (v) => (role = v),
      maintenance: () => (locked = true),
    });
  } finally {
    globalThis.fetch = oldFetch;
    for (const k of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}
const athlete = (index = 1) => ({
  id: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  name: `นักกีฬา ${index}`,
  school_id: sid,
  competition_id: cid,
  sport: "ฟุตบอล",
  division: "ประถมศึกษา",
  gender: "ชาย",
});
const request = (athletes: Row[], auth = true) =>
  POST(
    new Request("http://localhost/api/athlete-registrations", {
      method: "POST",
      headers: auth ? { authorization: "Bearer fixture" } : {},
      body: JSON.stringify({ athletes }),
    }),
  );
test("registration endpoint refuses anonymous, referee and cross-school writers", async () =>
  fixture(async (f) => {
    assert.equal((await request([athlete()], false)).status, 401);
    f.role("referee");
    assert.equal((await request([athlete()])).status, 403);
    f.role("school_admin");
    assert.equal(
      (await request([{ ...athlete(), school_id: other }])).status,
      403,
    );
    assert.equal(f.writes.length, 0);
  }));
test("registration endpoint uses trusted policy for atomic batch limits and starter/reserve assignment", async () =>
  fixture(async (f) => {
    assert.equal(
      (await request(Array.from({ length: 11 }, (_, i) => athlete(i + 1))))
        .status,
      400,
    );
    assert.equal(f.writes.length, 0);
    const r = await request(
      Array.from({ length: 10 }, (_, i) => athlete(i + 1)),
    );
    assert.equal(r.status, 200, await r.text());
    assert.equal(f.writes.length, 1);
    assert.equal(
      f.rows.filter((a) => a.roster_details.position === "starter").length,
      7,
    );
    assert.equal(
      f.rows.filter((a) => a.roster_details.position === "reserve").length,
      3,
    );
  }));
test("registration maintenance blocks writes and editing cannot replace another school registration", async () =>
  fixture(async (f) => {
    f.rows.push({
      id: athlete().id,
      school_id: other,
      competition_id: cid,
      athlete_name: "เดิม",
      bib: "101",
      roster_details: null,
    });
    assert.equal((await request([athlete()])).status, 403);
    f.maintenance();
    assert.equal((await request([athlete(2)])).status, 409);
    assert.equal(f.writes.length, 0);
  }));

test("registration endpoint persists only recognized roster fields", async () =>
  fixture(async (f) => {
    const row = {
      ...athlete(),
      roster: {
        ruleId: "football-male",
        position: "starter",
        events: [],
        unexpected: "untrusted metadata",
      },
    };
    assert.equal((await request([row])).status, 200);
    assert.deepEqual(Object.keys(f.rows[0].roster_details).sort(), [
      "events",
      "position",
      "ruleId",
    ]);
  }));
