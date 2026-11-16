import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST } from "../app/api/competitions/route";
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
    if (url.pathname.startsWith("/storage/v1/"))
      return new Response(
        JSON.stringify({ statusCode: "404", message: "Object not found" }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
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
            : key === "registration_policy->>matchReportsVersion"
              ? row.registration_policy?.matchReportsVersion
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
    f.setRole("referee");
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
test("schedules allow simultaneous starts across competitions even in the same venue", async () =>
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
      200,
    );
    assert.ok(f.writes.length > 0);
  }));

test("any recorder can advance another referee match but tied scores are still rejected", async () =>
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
      409,
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

test("pending group qualifiers accept a schedule without creating fake participants", async () =>
  fixture(async (f) => {
    f.competitions[0].registration_policy.management.fixtures = [
      {
        id: a,
        round: "รองชนะเลิศ",
        home: "ที่ 1 สาย A",
        away: "ที่ 2 ดีที่สุด",
        phase: "knockout",
        sourceNumber: 7,
        startsAt: "",
        venue: "",
      },
    ];
    const response = await post({
      action: "schedule",
      id,
      fixtureId: a,
      startsAt: "2026-11-10T09:00",
      venue: "สนาม",
    });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
    assert.equal(f.matches.length, 0);
  }));
test("qualifier choices are validated against group membership and preserve labels", async () =>
  fixture(async (f) => {
    const m = f.competitions[0].registration_policy.management;
    m.groups = [
      { name: "A", teams: [a, b] },
      { name: "B", teams: [c, d] },
    ];
    m.fixtures = [
      {
        id: a,
        round: "รองชนะเลิศ",
        home: "ที่ 1 สาย A",
        away: "ที่ 2 สาย B",
        startsAt: "",
        venue: "",
      },
    ];
    const base = {
      action: "schedule",
      id,
      fixtureId: a,
      startsAt: "2026-11-10T09:00",
      venue: "สนาม",
    };
    assert.equal((await post({ ...base, resolvedHome: c })).status, 400);
    assert.equal(
      (await post({ ...base, resolvedHome: a, resolvedAway: d })).status,
      200,
    );
    assert.equal(f.matches[0].home_school_id, a);
    assert.equal(m.fixtures[0].home, "ที่ 1 สาย A");
    assert.equal(
      f.competitions[0].registration_policy.management.fixtures[0].resolvedHome,
      a,
    );
  }));
test("source numbers propagate confirmed losers into the bronze fixture", async () =>
  fixture(async (f) => {
    const m = f.competitions[0].registration_policy.management;
    m.fixtures = [
      {
        id: a,
        round: "รองชนะเลิศ",
        home: a,
        away: b,
        sourceNumber: 9,
        startsAt: "",
        venue: "",
      },
      {
        id: c,
        round: "ชิงที่ 3",
        home: "ผู้แพ้คู่ 9",
        away: d,
        sourceNumber: 12,
        startsAt: "2026-11-10T10:00",
        venue: "สนาม",
      },
    ];
    f.matches.push({
      id: a,
      competition_id: id,
      home_school_id: a,
      away_school_id: b,
      status: "finished",
      home_score: 2,
      away_score: 0,
    });
    const res = await post({ action: "advance", matchId: a });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.equal(f.matches[1].home_school_id, b);
  }));

test("manual qualification cannot override winner or loser references", async () =>
  fixture(async (f) => {
    f.competitions[0].registration_policy.management.fixtures = [
      {
        id: a,
        round: "รอบชิง",
        home: "ผู้ชนะคู่ 1",
        away: "ผู้แพ้คู่ 2",
        startsAt: "",
        venue: "",
      },
    ];
    const res = await post({
      action: "schedule",
      id,
      fixtureId: a,
      startsAt: "2026-11-10T09:00",
      venue: "สนาม",
      resolvedHome: b,
    });
    assert.equal(res.status, 400);
    assert.equal(f.writes.length, 0);
  }));
test("materialized qualifier participants cannot be replaced", async () =>
  fixture(async (f) => {
    f.competitions[0].registration_policy.management.fixtures = [
      {
        id: a,
        round: "รอบชิง",
        home: "ที่ 1 สาย A",
        away: "ที่ 2 สาย B",
        resolvedHome: a,
        resolvedAway: c,
        startsAt: "",
        venue: "",
      },
    ];
    f.matches.push({
      id: a,
      competition_id: id,
      home_school_id: a,
      away_school_id: c,
      status: "scheduled",
      revision: 1,
    });
    const res = await post({
      action: "schedule",
      id,
      fixtureId: a,
      startsAt: "2026-11-10T09:00",
      venue: "สนาม",
      resolvedHome: b,
    });
    assert.equal(res.status, 409);
    assert.equal(f.writes.length, 0);
  }));

test("management rejects malformed phase and duplicate source numbers", async () => {
  const { readManagement } = await import("../lib/production-competitions");
  await fixture(async (f) => {
    const m = f.competitions[0].registration_policy.management;
    const base = {
      id: a,
      round: "A",
      home: a,
      away: b,
      startsAt: "",
      venue: "",
    };
    m.fixtures = [{ ...base, phase: "pretend" }];
    assert.equal(readManagement(f.competitions[0].registration_policy), null);
    m.fixtures = [
      { ...base, sourceNumber: 2 },
      { ...base, id: c, sourceNumber: 2 },
    ];
    assert.equal(readManagement(f.competitions[0].registration_policy), null);
  });
});

test("management validates complete session metadata and real calendar dates", async () => {
  const { readManagement } = await import("../lib/production-competitions");
  await fixture(async (f) => {
    const policy = f.competitions[0].registration_policy;
    const base = {
      id: a,
      round: "A",
      home: a,
      away: b,
      startsAt: "",
      venue: "สนาม",
    };
    const session = {
      timeMode: "session",
      competitionDate: "2028-02-29",
      sessionStart: "09:00",
    };
    for (const metadata of [
      session,
      { ...session, competitionDate: "2026-11-15", sessionStart: "23:59" },
    ]) {
      policy.management.fixtures = [{ ...base, ...metadata }];
      assert.ok(readManagement(policy));
    }
    for (const metadata of [
      { timeMode: "session" },
      { competitionDate: "2026-11-15" },
      { sessionStart: "09:00" },
      { ...session, timeMode: "exact" },
      { ...session, competitionDate: "2026-02-29" },
      { ...session, competitionDate: "2026-04-31" },
      { ...session, competitionDate: "2026-13-01" },
      { ...session, competitionDate: "0000-01-01" },
      { ...session, competitionDate: "2026-01-00" },
      { ...session, competitionDate: "26-01-01" },
      { ...session, sessionStart: "24:00" },
      { ...session, sessionStart: "09:60" },
      { ...session, sessionStart: "9:00" },
      { ...session, competitionDate: null },
    ]) {
      policy.management.fixtures = [{ ...base, ...metadata }];
      assert.equal(readManagement(policy), null, JSON.stringify(metadata));
    }
  });
});

test("session-only fixtures survive policy saves and do not materialize invented match times", async () =>
  fixture(async (f) => {
    const session = {
      id: a,
      round: "A",
      home: a,
      away: b,
      startsAt: "",
      venue: "สนาม",
      timeMode: "session",
      competitionDate: "2026-11-15",
      sessionStart: "09:00",
    };
    f.competitions[0].registration_policy.management.fixtures = [session];
    const saved = await post({
      action: "policy",
      id,
      policy: f.competitions[0].registration_policy,
    });
    assert.equal(saved.status, 200, JSON.stringify(await saved.json()));
    assert.deepEqual(
      f.competitions[0].registration_policy.management.fixtures,
      [session],
    );
    const res = await post({ action: "draw", id, teams: [a, b, c, d] });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.equal(f.matches.length, 0);
    assert.deepEqual(
      f.competitions[0].registration_policy.management.fixtures,
      [session],
    );
  }));

test("exact scheduling clears session metadata only for the edited fixture", async () =>
  fixture(async (f) => {
    const session = {
      round: "A",
      startsAt: "",
      venue: "สนาม",
      timeMode: "session",
      competitionDate: "2026-11-15",
      sessionStart: "09:00",
    };
    f.competitions[0].registration_policy.management.fixtures = [
      { ...session, id: a, home: a, away: b },
      { ...session, id: c, home: c, away: d },
    ];
    const res = await post({
      action: "schedule",
      id,
      fixtureId: a,
      startsAt: "2026-11-16T10:00",
      venue: "สนาม",
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    const [edited, untouched] =
      f.competitions[0].registration_policy.management.fixtures;
    assert.equal(edited.startsAt, "2026-11-16T10:00");
    for (const key of ["timeMode", "competitionDate", "sessionStart"])
      assert.equal(key in edited, false);
    assert.equal(untouched.timeMode, "session");
    assert.equal(untouched.startsAt, "");
    assert.equal(f.matches.length, 1);
  }));

test("session projections preserve actual times and confirmed matches remain unchanged", async () => {
  const { managedFromHosted } = await import("../lib/production-competitions");
  await fixture(async (f) => {
    const session = {
      id: a,
      round: "A",
      home: a,
      away: b,
      startsAt: "",
      venue: "สนาม",
      timeMode: "session",
      competitionDate: "2026-11-15",
      sessionStart: "09:00",
    };
    f.competitions[0].registration_policy.management.fixtures = [session];
    const actual = {
      id: a,
      competition_id: id,
      group_name: "A",
      home_school_id: a,
      away_school_id: b,
      starts_at: "2026-11-10T10:00:00+07:00",
      venue: "สนาม",
      status: "confirmed",
      home_score: 2,
      away_score: 0,
      revision: 3,
    };
    f.matches.push(actual);
    const projected = managedFromHosted(
      f.competitions as any,
      f.matches as any,
    )[0].fixtures[0];
    assert.equal(projected.startsAt, "2026-11-10T10:00");
    assert.equal(projected.competitionDate, "2026-11-15");
    assert.equal(projected.sessionStart, "09:00");
    const before = structuredClone(actual);
    const res = await post({ action: "draw", id, teams: [a, b, c, d] });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    assert.deepEqual(f.matches, [before]);
  });
});

test("venue-only saves retain source session metadata when the actual exact time is unchanged", async () =>
  fixture(async (f) => {
    const metadata = {
      timeMode: "session",
      competitionDate: "2026-11-15",
      sessionStart: "09:00",
    };
    f.competitions[0].registration_policy.management.fixtures = [
      {
        id: a,
        round: "A",
        home: a,
        away: b,
        startsAt: "",
        venue: "สนามเดิม",
        ...metadata,
      },
    ];
    f.matches.push({
      id: a,
      competition_id: id,
      group_name: "A",
      home_school_id: a,
      away_school_id: b,
      starts_at: "2026-11-10T10:00:00+07:00",
      venue: "สนามเดิม",
      status: "scheduled",
      revision: 1,
      home_score: null,
      away_score: null,
    });
    const res = await post({
      action: "schedule",
      id,
      fixtureId: a,
      startsAt: "2026-11-10T10:00",
      venue: "สนามใหม่",
    });
    assert.equal(res.status, 200, JSON.stringify(await res.json()));
    const saved = f.competitions[0].registration_policy.management.fixtures[0];
    assert.equal(saved.timeMode, metadata.timeMode);
    assert.equal(saved.competitionDate, metadata.competitionDate);
    assert.equal(saved.sessionStart, metadata.sessionStart);
    assert.equal(saved.venue, "สนามใหม่");
    assert.equal(saved.startsAt, "2026-11-10T10:00");
    assert.equal(f.matches[0].venue, "สนามใหม่");
  }));

test("admin policy CAS refuses to clobber a report staged after its snapshot", async () =>
  fixture(async (f) => {
    const previous = globalThis.fetch;
    let raced = false;
    globalThis.fetch = async (input, init) => {
      if (
        !raced &&
        String(input).includes("/rest/v1/competitions") &&
        init?.method === "PATCH"
      ) {
        raced = true;
        Object.assign(f.competitions[0].registration_policy, {
          matchReportsVersion: 1,
          matchReports: { winner: { retained: true } },
        });
      }
      return previous(input, init);
    };
    const result = await post({
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
    assert.equal(result.status, 409);
    assert.deepEqual(
      f.competitions[0].registration_policy.matchReports.winner,
      { retained: true },
    );
    assert.equal(f.competitions[0].registration_policy.management.revision, 1);
  }));

test("same competition materializes multiple fixtures sharing a start and venue", async () =>
  fixture(async (f) => {
    f.competitions[0].registration_policy.management.fixtures = [
      { id: a, round: "รอบ 1", home: a, away: b, startsAt: "", venue: "" },
      {
        id: c,
        round: "รอบ 1",
        home: c,
        away: d,
        startsAt: "2026-11-16T09:00",
        venue: "สนามร่วม",
      },
    ];
    const response = await post({
      action: "schedule",
      id,
      revision: 1,
      fixtureId: a,
      startsAt: "2026-11-16T09:00",
      venue: "สนามร่วม",
    });
    assert.equal(response.status, 200);
    assert.equal(f.matches.length, 2);
    assert.ok(
      f.matches.every(
        (match) =>
          match.starts_at === "2026-11-16T09:00+07:00" &&
          match.venue === "สนามร่วม",
      ),
    );
  }));

test("referees and recorders can load and edit competition management while school accounts cannot", async () =>
  fixture(async (f) => {
    const request = () =>
      new Request("http://localhost/api/competitions", {
        headers: { Authorization: "Bearer fixture-token" },
      });
    for (const role of ["school", "school_admin", "viewer"]) {
      f.setRole(role);
      assert.equal((await GET(request())).status, 403);
      assert.equal((await post({ action: "draw", id })).status, 403);
    }
    assert.equal(f.writes.length, 0);
    for (const role of ["referee", "recorder"]) {
      f.setRole(role);
      const read = await GET(request());
      assert.equal(read.status, 200);
      assert.equal((await read.json()).competitions.length, 1);
      const result = await post({
        action: "update",
        id,
        revision: f.competitions[0].registration_policy.management.revision,
        competition: { name: `Football ${role}`, teamLimit: 4, details: "" },
      });
      assert.equal(result.status, 200, JSON.stringify(await result.json()));
      assert.equal(f.competitions[0].name, `Football ${role}`);
    }
  }));
