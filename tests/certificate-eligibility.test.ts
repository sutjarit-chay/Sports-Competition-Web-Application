import test from "node:test";
import assert from "node:assert/strict";
import { buildCertificateCandidates } from "../lib/certificate-eligibility";
import type { Snapshot } from "../lib/hosted";
const athlete = (id: string, school_id = "a") => ({
  id,
  name: id,
  school_id,
  sport: "ฟุตบอล",
  division: "ป",
  gender: "ชาย",
  competition_id: "c",
});
function snapshot(): Snapshot {
  return {
    rows: {
      schools: [],
      competitions: [
        {
          id: "c",
          name: "ฟุตบอล",
          sport: "ฟุตบอล",
          age_group: "ป",
          gender: "ชาย",
          win_points: 3,
          draw_points: 1,
          loss_points: 0,
        },
      ],
      registrations: [],
      matches: [],
      athletics_events: [],
      athletics_results: [],
      medals: [],
    },
    state: {
      schools: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      athletes: [
        athlete("starter"),
        {
          ...athlete("reserve"),
          roster: { ruleId: "football", position: "reserve", events: [] },
        },
        athlete("loser", "b"),
      ],
      matches: [
        {
          id: "m",
          sport: "ฟุตบอล",
          division: "ป",
          gender: "ชาย",
          competition_id: "c",
          pool: "รอบชิงชนะเลิศ",
          home: "a",
          away: "b",
          starts_at: "",
          venue: "",
          status: "finished",
          home_score: 2,
          away_score: 1,
        },
      ],
      races: [],
      awards: [],
    },
  };
}
test("all registered teammates including reserves and coaches receive team medals", () => {
  const result = buildCertificateCandidates(snapshot(), [
    {
      id: "coach",
      name: "Coach",
      school_id: "a",
      competition_id: "c",
      title: "",
      phone: "",
    },
  ]);
  assert.equal(result.blocked.length, 0);
  assert.deepEqual(
    result.candidates.map((x) => [x.recipientId, x.award]).sort(),
    [
      ["coach", "gold"],
      ["loser", "silver"],
      ["reserve", "gold"],
      ["starter", "gold"],
    ],
  );
});
test("unfinished competitions produce no participation or medals", () => {
  const s = snapshot();
  s.state.matches[0].status = "scheduled";
  assert.equal(buildCertificateCandidates(s, []).candidates.length, 0);
});
function athletics() {
  const s = snapshot();
  s.rows.competitions[0].sport = "กรีฑา";
  s.state.matches = [];
  s.state.athletes = [
    {
      ...athlete("one"),
      sport: "กรีฑา",
      bib: "1",
      roster: {
        ruleId: "athletics",
        position: "individual",
        events: ["run60"],
      },
    },
    {
      ...athlete("two"),
      sport: "กรีฑา",
      bib: "2",
      roster: {
        ruleId: "athletics",
        position: "individual",
        events: ["run100"],
      },
    },
  ];
  s.state.races = [
    {
      id: "r1",
      competition_id: "c",
      event: "วิ่ง 60 เมตร",
      division: "ป",
      gender: "ชาย",
      stage: "final",
      heat: 1,
      athlete_id: "one",
      school_id: "a",
      bib: "1",
      value: 10,
      status: "OK",
    },
    {
      id: "r2",
      competition_id: "c",
      event: "วิ่ง 100 เมตร",
      division: "ป",
      gender: "ชาย",
      stage: "final",
      heat: 1,
      athlete_id: "two",
      school_id: "a",
      bib: "2",
      value: 20,
      status: "OK",
    },
  ];
  return s;
}
test("athletics isolates each athlete event rather than school medals", () => {
  const r = buildCertificateCandidates(athletics(), []);
  assert.equal(r.candidates.length, 2);
  assert.deepEqual(
    r.candidates.map((x) => [x.recipientId, x.event]),
    [
      ["one", "วิ่ง 60 เมตร"],
      ["two", "วิ่ง 100 เมตร"],
    ],
  );
});
test("athletics equal results retain tied gold awards", () => {
  const s = athletics();
  s.state.athletes[1].roster!.events = ["run60"];
  s.state.races[1].event = "วิ่ง 60 เมตร";
  s.state.races[1].value = 10;
  assert.deepEqual(
    buildCertificateCandidates(s, []).candidates.map((x) => x.award),
    ["gold", "gold"],
  );
});
test("ambiguous bib and DNS-only events fail closed", () => {
  const s = athletics();
  s.state.athletes[1].bib = "1";
  assert.equal(buildCertificateCandidates(s, []).candidates.length, 0);
  const t = athletics();
  t.state.races.forEach((r) => {
    r.status = "DNS";
    r.value = null;
  });
  assert.equal(buildCertificateCandidates(t, []).candidates.length, 0);
});
test("completed losing teams receive participation and pending fixtures block all awards", () => {
  const s = snapshot();
  s.state.athletes.push(athlete("other", "c-school"));
  s.state.schools.push({ id: "c-school", name: "C" });
  s.state.matches.push({
    ...s.state.matches[0],
    id: "semi",
    pool: "รอบรองชนะเลิศ",
    away: "c-school",
  });
  assert.equal(
    buildCertificateCandidates(s, []).candidates.find(
      (c) => c.recipientId === "other",
    )?.award,
    "participation",
  );
  s.state.matches[1].status = "pending";
  assert.equal(buildCertificateCandidates(s, []).candidates.length, 0);
});
test("missing finals and missing registered events block athletics", () => {
  const s = athletics();
  s.state.races[1].stage = "heat";
  assert.equal(buildCertificateCandidates(s, []).candidates.length, 0);
  const t = athletics();
  t.state.athletes[0].roster!.events = [];
  assert.equal(buildCertificateCandidates(t, []).candidates.length, 0);
});
test("relay medals apply only to registered relay members", () => {
  const s = athletics();
  s.state.athletes[0].roster!.events = ["relay"];
  s.state.races[0].event = "วิ่งผลัด";
  s.state.races[0].kind = "relay";
  s.state.races[0].athlete_id = "";
  const r = buildCertificateCandidates(s, []);
  assert.deepEqual(
    r.candidates
      .filter((c) => c.event === "วิ่งผลัด")
      .map((c) => c.recipientId),
    ["one"],
  );
});
test("pending bronze match blocks even an already completed final", () => {
  const s = snapshot();
  s.state.matches.push({
    ...s.state.matches[0],
    id: "bronze",
    pool: "ชิงอันดับ 3",
    status: "scheduled",
  });
  const result = buildCertificateCandidates(s, []);
  assert.equal(result.candidates.length, 0);
  assert.ok(result.blocked.length);
});

test("settled heat nonqualifiers receive participation after the event final", () => {
  const s = athletics();
  s.state.athletes[1].roster!.events = ["run60"];
  s.state.races[1] = {
    ...s.state.races[1],
    event: "วิ่ง 60 เมตร",
    stage: "heat",
  };
  const result = buildCertificateCandidates(s, []);
  assert.equal(result.blocked.length, 0);
  assert.deepEqual(
    result.candidates.map((c) => [c.recipientId, c.award]),
    [
      ["one", "gold"],
      ["two", "participation"],
    ],
  );
});

test("unconfirmed heats block issuance even with a settled final", () => {
  const s = athletics();
  s.state.athletes[1].roster!.events = ["run60"];
  s.state.races[1] = {
    ...s.state.races[1],
    event: "วิ่ง 60 เมตร",
    stage: "heat",
    status: "pending",
  };
  assert.equal(buildCertificateCandidates(s, []).candidates.length, 0);
});

test("DNS-only athletes are excluded while identified finalists receive medals", () => {
  const s = athletics();
  s.state.athletes[1].roster!.events = ["run60"];
  s.state.races[1] = {
    ...s.state.races[1],
    event: "วิ่ง 60 เมตร",
    stage: "heat",
    status: "DNS",
    value: null,
  };
  assert.deepEqual(
    buildCertificateCandidates(s, []).candidates.map((c) => [
      c.recipientId,
      c.award,
    ]),
    [["one", "gold"]],
  );
});

test("relay finals from schools without registered relay members block issuance", () => {
  const s = athletics();
  s.state.athletes[0].roster!.events = ["relay"];
  s.state.races[0] = {
    ...s.state.races[0],
    event: "วิ่งผลัด",
    kind: "relay",
    athlete_id: "",
  };
  s.state.races.push({
    ...s.state.races[0],
    id: "unknown-relay",
    school_id: "b",
    value: 5,
  });
  const result = buildCertificateCandidates(s, []);
  assert.equal(result.candidates.length, 0);
  assert.ok(
    result.blocked.some((reason) =>
      reason.includes("ผลการแข่งขันไม่ตรงกับผู้ลงทะเบียน"),
    ),
  );
});
