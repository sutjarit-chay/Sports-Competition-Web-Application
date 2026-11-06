import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/competitions/route";
const id = "10000000-0000-4000-8000-000000000001";
const a = "20000000-0000-4000-8000-000000000001",
  b = "20000000-0000-4000-8000-000000000002",
  c = "20000000-0000-4000-8000-000000000003",
  d = "20000000-0000-4000-8000-000000000004";
type Row = Record<string, any>;
async function fixture(
  work: (f: {
    competitions: Row[];
    matches: Row[];
    writes: Row[];
    setRole: (role: string) => void;
  }) => Promise<void>,
) {
  const competitions: Row[] = [
    {
      id,
      sport: "ฟุตบอล",
      name: "ฟุตบอล",
      age_group: "ประถมศึกษา",
      gender: "ชาย",
      win_points: 3,
      draw_points: 1,
      loss_points: 0,
      registration_policy: {
        ruleId: "football-male",
        reserves: 3,
        eventQuotas: {},
        maxEventsPerAthlete: null,
        custom: "keep",
        management: {
          revision: 1,
          format: "knockout",
          teamLimit: 4,
          details: "",
          teams: [a, b, c, d],
          fixtures: [],
        },
      },
    },
  ];
  const matches: Row[] = [],
    writes: Row[] = [];
  let role = "admin";
  const oldFetch = globalThis.fetch;
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const old = keys.map((k) => process.env[k]);
  process.env[keys[0]] = "https://competition-fixture.invalid";
  process.env[keys[1]] = "public-fixture";
  process.env[keys[2]] = "secret-fixture";
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    assert.equal(url.origin, "https://competition-fixture.invalid");
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const send = (x: unknown) =>
      new Response(JSON.stringify(x), {
        headers: { "content-type": "application/json" },
      });
    if (url.pathname === "/auth/v1/user")
      return send({
        id,
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
      });
    const table = url.pathname.split("/").at(-1);
    if (table === "profiles") return send({ id, role, school_id: null });
    const rows =
      table === "competitions"
        ? competitions
        : table === "matches"
          ? matches
          : table === "schools"
            ? [a, b, c, d].map((id) => ({ id }))
            : [];
    const selected = rows.filter((row) =>
      [...url.searchParams].every(([key, val]) => {
        if (["select", "order", "limit"].includes(key)) return true;
        const v =
          key === "registration_policy->management->>revision"
            ? row.registration_policy?.management?.revision
            : row[key];
        return val === "is.null"
          ? v == null
          : val.startsWith("eq.")
            ? String(v) === val.slice(3)
            : true;
      }),
    );
    if (method !== "GET") writes.push({ table, method, body });
    if (method === "POST") {
      const added = Array.isArray(body) ? body : [body];
      if (table === "matches" && added.some((row) => !row.starts_at))
        return new Response(
          JSON.stringify({
            code: "23502",
            message:
              'null value in column "starts_at" violates not-null constraint',
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      for (const row of added)
        rows.push({ ...row, id: row.id || crypto.randomUUID() });
      return send(
        added.length === 1 && !Array.isArray(body) ? rows.at(-1) : added,
      );
    }
    if (method === "PATCH") {
      if (table === "matches" && "starts_at" in body && !body.starts_at)
        return new Response(
          JSON.stringify({
            code: "23502",
            message:
              'null value in column "starts_at" violates not-null constraint',
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      selected.forEach((row) => Object.assign(row, body));
      return send(selected);
    }
    return send(
      new Headers(init?.headers).get("accept")?.includes("object+json")
        ? selected[0] || null
        : selected,
    );
  };
  try {
    await work({ competitions, matches, writes, setRole: (r) => (role = r) });
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((k, i) =>
      old[i] === undefined ? delete process.env[k] : (process.env[k] = old[i]),
    );
  }
}
const post = (body: Row, auth = true) =>
  POST(
    new Request("http://localhost/api/competitions", {
      method: "POST",
      headers: auth ? { authorization: "Bearer fixture-token" } : {},
      body: JSON.stringify(body),
    }),
  );
async function scheduleAll(f: { competitions: Row[] }) {
  const fixtures = f.competitions[0].registration_policy.management.fixtures;
  for (let i = 0; i < fixtures.length; i++) {
    const res = await post({
      action: "schedule",
      id,
      fixtureId: fixtures[i].id,
      startsAt: `2026-11-10T${String(9 + i).padStart(2, "0")}:00`,
      venue: `Court ${i + 1}`,
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
  }
}
test("competition administration rejects unauthenticated and school accounts without writes", async () =>
  fixture(async (f) => {
    assert.equal((await post({ action: "draw", id }, false)).status, 401);
    f.setRole("school");
    assert.equal((await post({ action: "draw", id })).status, 403);
    assert.equal(f.writes.length, 0);
  }));
test("policy writes preserve management metadata and unrelated policy values", async () =>
  fixture(async (f) => {
    const res = await post({
      action: "policy",
      id,
      revision: 1,
      policy: {
        ruleId: "football-male",
        reserves: 3,
        eventQuotas: {},
        maxEventsPerAthlete: null,
      },
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.equal(f.competitions[0].registration_policy.custom, "keep");
    assert.equal(f.competitions[0].registration_policy.management.revision, 2);
    assert.deepEqual(f.competitions[0].registration_policy.management.teams, [
      a,
      b,
      c,
      d,
    ]);
  }));
test("draw keeps undated fixtures in metadata and scheduled ready matches advance confirmed decisive winners", async () =>
  fixture(async (f) => {
    let res = await post({
      action: "draw",
      id,
      revision: 1,
      teams: [a, b, c, d],
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.equal(f.matches.length, 0);
    assert.equal(
      f.competitions[0].registration_policy.management.fixtures.length,
      3,
    );
    await scheduleAll(f);
    assert.equal(f.matches.length, 2);
    f.matches.forEach((m, i) =>
      Object.assign(m, {
        status: "finished",
        home_score: 2,
        away_score: 0,
        revision: 1,
      }),
    );
    res = await post({ action: "advance", matchId: f.matches[0].id });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.equal(f.matches.length, 3);
    assert.equal(f.matches[2].home_school_id, a);
    assert.equal(f.matches[2].away_school_id, c);
  }));
test("confirmed matches cannot be redrawn or rescheduled", async () =>
  fixture(async (f) => {
    f.matches.push({
      id: a,
      competition_id: id,
      status: "finished",
      revision: 1,
      home_school_id: a,
      away_school_id: b,
      group_name: "รอบ 1",
    });
    assert.equal(
      (await post({ action: "draw", id, revision: 1, teams: [a, b] })).status,
      409,
    );
    assert.equal(
      (
        await post({
          action: "schedule",
          id,
          revision: 1,
          fixtureId: a,
          startsAt: "2026-11-10T09:00",
          venue: "สนาม",
        })
      ).status,
      409,
    );
    assert.equal(f.writes.length, 0);
  }));
test("schedules reject school and venue conflicts across competitions", async () =>
  fixture(async (f) => {
    f.competitions[0].registration_policy.management.fixtures = [
      { id: a, round: "รอบ 1", home: a, away: b, startsAt: "", venue: "" },
    ];
    f.matches.push(
      {
        id: a,
        competition_id: id,
        status: "scheduled",
        revision: 1,
        home_school_id: a,
        away_school_id: b,
      },
      {
        id: d,
        competition_id: c,
        status: "scheduled",
        revision: 1,
        home_school_id: c,
        away_school_id: d,
        starts_at: "2026-11-10T09:00:00+07:00",
        venue: "สนาม",
      },
    );
    assert.equal(
      (
        await post({
          action: "schedule",
          id,
          revision: 1,
          fixtureId: a,
          startsAt: "2026-11-10T09:00",
          venue: "สนาม",
        })
      ).status,
      409,
    );
    assert.equal(f.writes.length, 0);
  }));

test("advancement refuses unassigned recorders and tied confirmed scores", async () =>
  fixture(async (f) => {
    const draw = await post({
      action: "draw",
      id,
      revision: 1,
      teams: [a, b, c, d],
    });
    assert.equal(draw.status, 200);
    await scheduleAll(f);
    Object.assign(f.matches[0], {
      status: "finished",
      home_score: 1,
      away_score: 1,
      referee_id: c,
    });
    f.setRole("recorder");
    assert.equal(
      (await post({ action: "advance", matchId: f.matches[0].id })).status,
      403,
    );
    f.setRole("admin");
    assert.equal(
      (await post({ action: "advance", matchId: f.matches[0].id })).status,
      409,
    );
    assert.equal(f.matches.length, 2);
  }));
test("advancement refuses to overwrite a confirmed downstream participant", async () =>
  fixture(async (f) => {
    assert.equal(
      (await post({ action: "draw", id, revision: 1, teams: [a, b, c, d] }))
        .status,
      200,
    );
    await scheduleAll(f);
    f.matches.forEach((m) =>
      Object.assign(m, { status: "finished", home_score: 2, away_score: 0 }),
    );
    const final = f.competitions[0].registration_policy.management.fixtures[2];
    f.matches.push({
      id: final.id,
      competition_id: id,
      group_name: final.round,
      home_school_id: b,
      away_school_id: c,
      status: "finished",
      home_score: 1,
      away_score: 0,
      revision: 2,
    });
    const res = await post({ action: "advance", matchId: f.matches[0].id });
    assert.equal(res.status, 409);
    assert.equal(f.matches[2].home_school_id, b);
    assert.equal(f.matches[2].revision, 2);
  }));
test("stale administration revisions fail without changing persisted policy", async () =>
  fixture(async (f) => {
    assert.equal(
      (
        await post({
          action: "policy",
          id,
          revision: 0,
          policy: {
            ruleId: "football-male",
            reserves: 3,
            eventQuotas: {},
            maxEventsPerAthlete: null,
          },
        })
      ).status,
      409,
    );
    assert.equal(f.writes.length, 0);
    assert.equal(f.competitions[0].registration_policy.management.revision, 1);
  }));

test("retrying a persisted draw recovers missing ready matches without replacing bracket IDs", async () =>
  fixture(async (f) => {
    assert.equal(
      (await post({ action: "draw", id, revision: 1, teams: [a, b, c, d] }))
        .status,
      200,
    );
    await scheduleAll(f);
    const fixtureIds =
      f.competitions[0].registration_policy.management.fixtures.map(
        (x: Row) => x.id,
      );
    f.matches.length = 0;
    const res = await post({
      action: "draw",
      id,
      revision: 5,
      teams: [a, b, c, d],
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.deepEqual(
      f.matches.map((x) => x.id),
      fixtureIds.slice(0, 2),
    );
    assert.equal(f.competitions[0].registration_policy.management.revision, 5);
  }));
test("competition edits persist names and points alongside management without reclassifying scope", async () =>
  fixture(async (f) => {
    const res = await post({
      action: "update",
      id,
      revision: 1,
      competition: {
        name: "รายการแก้ไข",
        winPoints: 5,
        drawPoints: 2,
        lossPoints: 0,
        details: "สนามใหม่",
        teamLimit: 8,
        format: "knockout",
        sport: "กรีฑา",
      },
    });
    assert.equal(res.status, 200);
    assert.equal(f.competitions[0].name, "รายการแก้ไข");
    assert.equal(f.competitions[0].win_points, 5);
    assert.equal(f.competitions[0].sport, "ฟุตบอล");
    assert.equal(
      f.competitions[0].registration_policy.management.details,
      "สนามใหม่",
    );
  }));

test("managed projection uses authoritative persisted match schedules after a concurrent result edit", async () => {
  const { managedFromHosted } = await import("../lib/production-competitions");
  await fixture(async (f) => {
    await post({ action: "draw", id, revision: 1, teams: [a, b, c, d] });
    await scheduleAll(f);
    Object.assign(f.matches[0], {
      starts_at: "2026-11-10T03:30:00Z",
      venue: "สนามจริง",
    });
    const row = managedFromHosted(f.competitions as any, f.matches as any)[0];
    assert.equal(row.fixtures[0].startsAt, "2026-11-10T10:30");
    assert.equal(row.fixtures[0].venue, "สนามจริง");
  });
});

test("a persisted production match cannot lose its required schedule", async () =>
  fixture(async (f) => {
    await post({ action: "draw", id, revision: 1, teams: [a, b, c, d] });
    await scheduleAll(f);
    const before = f.writes.length,
      original = f.matches[0].starts_at;
    assert.equal(
      (
        await post({
          action: "schedule",
          id,
          fixtureId: f.matches[0].id,
          startsAt: "",
          venue: "Court 1",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post({
          action: "schedule",
          id,
          fixtureId: f.matches[0].id,
          startsAt: "2026-11-10T09:00",
          venue: "",
        })
      ).status,
      400,
    );
    assert.equal(f.writes.length, before);
    assert.equal(f.matches[0].starts_at, original);
  }));
