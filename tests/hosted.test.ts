import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeHosted,
  findCompetition,
  toBangkokInput,
  fromBangkokInput,
  matchPayload,
  raceResultPayload,
} from "../lib/hosted";
import { parseAthletes, standings } from "../lib/domain";
const c = {
  id: "c1",
  sport: "ฟุตบอล",
  name: "ฟุตบอล U12",
  age_group: "U12",
  gender: "ผสม",
  win_points: 2,
  draw_points: 1,
  loss_points: 0,
};
const school = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "โรงเรียนตัวอย่าง",
};
const raw = {
  schools: [school],
  competitions: [c],
  registrations: [
    {
      id: "r1",
      school_id: school.id,
      competition_id: "c1",
      athlete_name: "สมชาย",
      bib: "101",
    },
  ],
  matches: [
    {
      id: "m1",
      competition_id: "c1",
      group_name: "A",
      home_school_id: school.id,
      away_school_id: "s2",
      starts_at: "2026-11-03T02:00:00Z",
      venue: "สนาม",
      status: "scheduled",
      home_score: null,
      away_score: null,
      revision: 4,
    },
  ],
  athletics_events: [],
  athletics_results: [],
  medals: [
    {
      id: "a1",
      competition_id: "c1",
      school_id: school.id,
      award: "gold",
      event_label: "รอบชิง",
    },
  ],
};
test("normalized records decode, null scores stay unplayed, payload excludes UI fields", () => {
  const s = decodeHosted(raw);
  assert.equal(s.athletes[0].name, "สมชาย");
  assert.equal(s.athletes[0].bib, "101");
  assert.equal(s.matches[0].starts_at, "2026-11-03T09:00");
  assert.equal(s.matches[0].home_score, undefined);
  assert.equal(s.awards[0].medal, "gold");
  const p = matchPayload(
    { ...s.matches[0], status: "finished", home_score: 2, away_score: 1 },
    "c1",
  );
  assert.equal(p.home_school_id, school.id);
  assert.equal(p.home_score, 2);
  assert.ok(!("sport" in p));
  assert.ok(!("revision" in p));
});

test("public legacy medals outside readable competition scope do not break a referee snapshot", () => {
  const state = decodeHosted({
    ...raw,
    medals: [
      ...raw.medals,
      {
        ...raw.medals[0],
        id: "unassigned-medal",
        competition_id: "unassigned",
      },
    ],
  });
  assert.deepEqual(
    state.awards.map((a) => a.id),
    ["a1"],
  );
});

test("editing a hosted registration updates only its existing identity", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { writeHosted } = await import("../lib/hosted");
  const calls: { method: string; url: URL; body: Record<string, unknown> }[] =
    [];
  const client = createClient("https://fixture.invalid", "fixture-public", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        calls.push({
          method: init?.method || "GET",
          url: new URL(String(input)),
          body: JSON.parse(String(init?.body)),
        });
        return new Response(JSON.stringify([{ id: "r1" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const state = decodeHosted(raw);
  await writeHosted(client, { rows: raw, state }, "athletes", [
    { ...state.athletes[0], name: "ชื่อใหม่" },
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url.searchParams.get("id"), "eq.r1");
  assert.equal(calls[0].url.searchParams.get("school_id"), `eq.${school.id}`);
  assert.deepEqual(calls[0].body, { athlete_name: "ชื่อใหม่", bib: "101" });
});
test("Thailand schedule conversion is independent of host timezone", () => {
  assert.equal(
    fromBangkokInput("2026-11-03T09:00"),
    "2026-11-03T02:00:00.000Z",
  );
  assert.equal(toBangkokInput(null), "");
  assert.equal(fromBangkokInput(""), null);
  assert.throws(() => fromBangkokInput("invalid"));
});
test("competition lookup refuses ambiguous rows", () => {
  assert.equal(
    findCompetition([c], {
      sport: "ฟุตบอล",
      division: "U12",
      gender: "ผสม",
      competition_id: "c1",
    }).id,
    "c1",
  );
  assert.throws(
    () =>
      findCompetition([c, { ...c, id: "c2" }], {
        sport: "ฟุตบอล",
        division: "U12",
        gender: "ผสม",
      }),
    /รายการ/,
  );
});
test("CSV accepts UUID and exact unique school name, not positional school numbers", () => {
  const csv =
    "name,school_id,sport,gender,division,bib\nสมชาย,โรงเรียนตัวอย่าง,ฟุตบอล,ผสม,U12,101";
  const a = parseAthletes(csv, [school]);
  assert.equal(a[0].school_id, school.id);
  assert.equal(a[0].bib, "101");
  assert.throws(() =>
    parseAthletes(csv.replace("โรงเรียนตัวอย่าง", "1"), [school]),
  );
});
test("configured competition points affect standings", () => {
  const r = standings(
    [{ home: "a", away: "b", homeScore: 1, awayScore: 0, status: "finished" }],
    { win: 2, draw: 1, loss: 0 },
  );
  assert.equal(r[0].points, 2);
});
test("race identity uses school + bib + competition and keeps direction/unit", () => {
  const run = { ...c, id: "track", sport: "กรีฑา" };
  const data = {
    ...raw,
    competitions: [run],
    registrations: [{ ...raw.registrations[0], competition_id: "track" }],
    matches: [],
    medals: [],
    athletics_events: [
      {
        id: "e1",
        competition_id: "track",
        name: "วิ่ง",
        kind: "track",
        round: "heat",
        heat: 1,
        direction: "asc",
        unit: "s",
      },
    ],
    athletics_results: [
      {
        id: "result1",
        event_id: "e1",
        school_id: school.id,
        bib: "101",
        value: 12,
        status: "OK",
      },
    ],
  };
  const s = decodeHosted(data);
  assert.equal(s.races[0].athlete_id, "r1");
  assert.equal(s.races[0].event_id, "e1");
  const p = raceResultPayload(s.races[0], s.athletes, "e1");
  assert.equal(p.bib, "101");
  assert.ok(!("athlete_id" in p));
  assert.ok(!("rank" in p));
  assert.equal(
    decodeHosted({ ...data, registrations: [] }).races[0].bib,
    "101",
  );
  assert.throws(() =>
    raceResultPayload(
      { ...s.races[0], athlete_id: "missing" },
      s.athletes,
      "e1",
    ),
  );
});

test("stale revision never overwrites a newer result", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { writeHosted } = await import("../lib/hosted");
  const snapshot = { rows: structuredClone(raw), state: decodeHosted(raw) };
  const persisted = {
    ...raw.matches[0],
    revision: 5,
    home_score: 9,
    away_score: 0,
    status: "finished",
  };
  const client = createClient("https://fixture.invalid", "fixture-public", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        assert.equal(init?.method, "PATCH");
        const matches =
          url.searchParams.get("id") === `eq.${persisted.id}` &&
          (!url.searchParams.has("revision") ||
            url.searchParams.get("revision") === `eq.${persisted.revision}`);
        if (matches) Object.assign(persisted, JSON.parse(String(init?.body)));
        return new Response(
          JSON.stringify(matches ? [{ id: persisted.id }] : []),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  });
  await assert.rejects(
    writeHosted(client, snapshot, "matches", [
      {
        ...snapshot.state.matches[0],
        home_score: 1,
        away_score: 0,
        status: "finished",
      },
    ]),
    /ถูกแก้ไขแล้ว/,
  );
  assert.equal(persisted.home_score, 9);
  assert.equal(persisted.revision, 5);
});
test("ambiguous bib prevents creating either an event or a result", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { writeHosted } = await import("../lib/hosted");
  const data = {
    ...raw,
    competitions: [{ ...c, id: "track", sport: "กรีฑา" }],
    registrations: [
      { ...raw.registrations[0], competition_id: "track" },
      { ...raw.registrations[0], id: "r2", competition_id: "track" },
    ],
    matches: [],
    medals: [],
  };
  let writes = 0;
  const client = createClient("https://fixture.invalid", "fixture-public", {
    auth: { persistSession: false },
    global: {
      fetch: async () => {
        writes++;
        throw Error("Unexpected request");
      },
    },
  });
  await assert.rejects(
    writeHosted(client, { rows: data, state: decodeHosted(data) }, "races", [
      {
        id: "new",
        competition_id: "track",
        event: "วิ่ง",
        division: "U12",
        gender: "ผสม",
        stage: "heat",
        heat: 1,
        athlete_id: "r1",
        value: 12,
        status: "OK",
      },
    ]),
    /bib ซ้ำ/,
  );
  assert.equal(writes, 0);
});
test("existing field event retains direction, unit and scheduling metadata", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { writeHosted } = await import("../lib/hosted");
  const event = {
    id: "e1",
    competition_id: "track",
    name: "กระโดดไกล",
    kind: "field",
    round: "final",
    heat: 1,
    direction: "desc",
    unit: "m",
    starts_at: "2026-11-03T02:00:00Z",
    venue: "สนามเดิม",
    referee_id: "referee1",
  };
  const data = {
    ...raw,
    competitions: [{ ...c, id: "track", sport: "กรีฑา" }],
    registrations: [{ ...raw.registrations[0], competition_id: "track" }],
    matches: [],
    medals: [],
    athletics_events: [event],
    athletics_results: [
      {
        id: "result1",
        event_id: "e1",
        school_id: school.id,
        bib: "101",
        value: 4,
        status: "OK",
      },
    ],
  };
  const snapshot = { rows: data, state: decodeHosted(data) };
  let resultValue = 4;
  let calls = 0;
  const client = createClient("https://fixture.invalid", "fixture-public", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        calls++;
        assert.ok(String(input).includes("/athletics_results"));
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(Object.keys(body).sort(), ["status", "value"]);
        resultValue = body.value;
        return new Response(JSON.stringify([{ id: "result1" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  await writeHosted(client, snapshot, "races", [
    { ...snapshot.state.races[0], value: 5 },
  ]);
  assert.equal(resultValue, 5);
  assert.equal(calls, 1);
  assert.deepEqual(data.athletics_events[0], event);
});

test("an unconfigured legacy competition cannot accept new registrations", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { writeHosted } = await import("../lib/hosted");
  let writes = 0;
  const client = createClient("https://fixture.invalid", "fixture-public", {
    auth: { persistSession: false },
    global: {
      fetch: async () => {
        writes++;
        return new Response("[]");
      },
    },
  });
  await assert.rejects(
    () =>
      writeHosted(client, { rows: raw, state: decodeHosted(raw) }, "athletes", [
        {
          ...decodeHosted(raw).athletes[0],
          id: "new-registration",
          name: "new",
          bib: "102",
        },
      ]),
    /ยังไม่ได้ตั้งค่ากติกา/,
  );
  assert.equal(writes, 0);
});

test("confirmed knockout winners cannot change after persistence, while score-only corrections keep their winner", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { writeHosted } = await import("../lib/hosted");
  let writes = 0;
  const client = createClient("https://fixture.invalid", "fixture-public", {
    auth: { persistSession: false },
    global: {
      fetch: async () => {
        writes++;
        return new Response(JSON.stringify([{ id: "m1" }]), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const source = {
    ...raw,
    competitions: [
      {
        ...c,
        registration_policy: {
          ruleId: "football-male",
          reserves: 3,
          eventQuotas: {},
          maxEventsPerAthlete: null,
          management: {
            revision: 1,
            format: "knockout",
            teamLimit: 2,
            details: "",
            teams: [],
            fixtures: [],
          },
        },
      },
    ],
    matches: [
      { ...raw.matches[0], status: "confirmed", home_score: 2, away_score: 1 },
    ],
  };
  const snapshot = { rows: source, state: decodeHosted(source) };
  const match = snapshot.state.matches[0];
  await assert.rejects(
    () =>
      writeHosted(client, snapshot, "matches", [
        { ...match, home_score: 0, away_score: 1 },
      ]),
    /เปลี่ยนผู้ชนะ/,
  );
  assert.equal(writes, 0);
  await writeHosted(client, snapshot, "matches", [
    { ...match, home_score: 3, away_score: 1 },
  ]);
  assert.equal(writes, 1);
});

test("new athletics events require a real schedule and persist required hosted columns", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { writeHosted } = await import("../lib/hosted");
  const bodies: { table: string; body: Record<string, unknown> }[] = [];
  const client = createClient("https://fixture.invalid", "fixture-public", {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const table = new URL(String(input)).pathname.split("/").pop()!;
        const body = JSON.parse(String(init?.body));
        bodies.push({ table, body });
        return new Response(JSON.stringify([body]), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const source = {
    ...raw,
    competitions: [{ ...c, sport: "กรีฑา" }],
    matches: [],
    medals: [],
  };
  const snapshot = { rows: source, state: decodeHosted(source) };
  const race = {
    id: "new-result",
    event: "วิ่ง 100 เมตร",
    division: "U12",
    gender: "ผสม",
    stage: "heat",
    heat: 1,
    athlete_id: "r1",
    value: 12,
    status: "OK",
  };
  await assert.rejects(
    () => writeHosted(client, snapshot, "races", [race]),
    /วันเวลา/,
  );
  assert.equal(bodies.length, 0);
  await writeHosted(client, snapshot, "races", [
    { ...race, starts_at: "2026-11-30T09:00", venue: "สนามจริง" },
  ]);
  assert.equal(bodies[0].table, "athletics_events");
  assert.equal(bodies[0].body.starts_at, "2026-11-30T02:00:00.000Z");
  assert.equal(bodies[0].body.venue, "สนามจริง");
});

test("hosted athletics lower/higher direction maps to UI ranking and back", async () => {
  const { normalizedRaceDirection, storedRaceDirection } =
    await import("../lib/hosted");
  assert.equal(normalizedRaceDirection("lower"), "asc");
  assert.equal(normalizedRaceDirection("higher"), "desc");
  assert.equal(storedRaceDirection("asc"), "lower");
  assert.equal(storedRaceDirection("desc"), "higher");
  assert.throws(() => normalizedRaceDirection("unknown"));
});

test("managed decoding preserves trusted phase, format and expected fixture count", () => {
  const fixtures = Array.from({ length: 10 }, (_, i) => ({
    id: i === 0 ? "m1" : `m${i + 1}`,
    round: "A",
    home: school.id,
    away: "s2",
    startsAt: "",
    venue: "",
    phase: "group",
  }));
  const state = decodeHosted({
    ...raw,
    competitions: [
      {
        ...c,
        registration_policy: {
          management: {
            revision: 1,
            format: "round_robin",
            teamLimit: 5,
            details: "",
            teams: [school.id, "s2"],
            fixtures,
          },
        },
      },
    ],
  } as any);
  assert.equal(state.matches[0].expectedFixtureCount, 10);
  assert.equal(state.matches[0].phase, "group");
  assert.equal(state.matches[0].format, "round_robin");
});
