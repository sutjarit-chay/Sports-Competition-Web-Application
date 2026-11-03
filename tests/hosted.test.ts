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
