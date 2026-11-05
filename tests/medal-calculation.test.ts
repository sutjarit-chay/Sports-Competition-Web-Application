import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateMedalAwards,
  groupSchoolsByMedalCategory,
  hasMultiplePoolsAwaitingFinal,
} from "../lib/medal-calculation";
import type { Match, Race } from "../lib/domain";

const makeMatch = (overrides: Partial<Match>): Match => ({
  id: crypto.randomUUID(),
  sport: "ฟุตบอล",
  division: "ประถม",
  gender: "ชาย",
  pool: "A",
  home: "school-a",
  away: "school-b",
  starts_at: "",
  venue: "",
  home_score: 1,
  away_score: 0,
  status: "finished",
  competition_id: "competition-1",
  ...overrides,
});

test("third-place wording never also awards gold or silver", () => {
  const awards = calculateMedalAwards({
    matches: [makeMatch({ pool: "รอบชิงอันดับ 3" })],
    races: [],
    athletes: [],
  });
  assert.deepEqual(
    awards.map((a) => [a.school_id, a.medal]),
    [["school-a", "bronze"]],
  );
});

test("English semifinals do not award final medals", () => {
  assert.deepEqual(
    calculateMedalAwards({
      matches: [makeMatch({ pool: "semifinal" })],
      races: [],
      athletes: [],
    }),
    [],
  );
});

test("playing rounds of one round-robin competition share the same medal standings", async () => {
  const { createDemoCompetitionData, demoFixturesAsMatches } =
    await import("../lib/demo-seed");
  const seed = createDemoCompetitionData();
  const competition = seed.competitions.find((c) => c.sport === "ฟุตบอล")!;
  const matches = demoFixturesAsMatches([competition]).map((m) => ({
    ...m,
    status: "finished",
    home_score: 2,
    away_score: 0,
  }));
  assert.equal(matches.length, 45);
  assert.ok(
    calculateMedalAwards({ matches, races: [], athletes: [] }).length >= 3,
  );
});

test("knockout awards wait for confirmed final and third-place results", () => {
  const matches = [
    makeMatch({
      pool: "รอบคัดเลือก",
      home: "school-c",
      away: "school-d",
    }),
    makeMatch({
      pool: "รอบรองชนะเลิศ",
      home: "school-a",
      away: "school-c",
    }),
    makeMatch({
      pool: "รอบชิงชนะเลิศ",
      home: "school-a",
      away: "school-b",
    }),
    makeMatch({
      pool: "ชิงอันดับ 3",
      home: "school-c",
      away: "school-d",
      home_score: 0,
      away_score: 2,
    }),
  ];
  const awards = calculateMedalAwards({
    matches,
    races: [],
    athletes: [],
  });
  assert.deepEqual(
    awards.map(({ school_id, medal }) => [school_id, medal]),
    [
      ["school-a", "gold"],
      ["school-b", "silver"],
      ["school-d", "bronze"],
    ],
  );
  assert.deepEqual(
    calculateMedalAwards({
      matches: matches.map((match) =>
        match.pool === "รอบชิงชนะเลิศ"
          ? { ...match, status: "scheduled", home_score: undefined }
          : match,
      ),
      races: [],
      athletes: [],
    }).map((award) => award.medal),
    ["bronze"],
  );
});

test("qualifying and semifinal results alone never produce medals", () => {
  const awards = calculateMedalAwards({
    matches: [
      makeMatch({ pool: "รอบคัดเลือก" }),
      makeMatch({ pool: "รอบรองชนะเลิศ" }),
    ],
    races: [],
    athletes: [],
  });
  assert.deepEqual(awards, []);
});

test("round-robin medals are calculated only after every scheduled match is finished", () => {
  const matches = [
    makeMatch({ home: "school-a", away: "school-b", home_score: 2 }),
    makeMatch({
      home: "school-a",
      away: "school-c",
      home_score: 3,
      away_score: 0,
    }),
    makeMatch({
      home: "school-b",
      away: "school-c",
      home_score: 1,
      away_score: 0,
    }),
  ];
  const awards = calculateMedalAwards({
    matches,
    races: [],
    athletes: [],
  });
  assert.deepEqual(
    awards.map(({ school_id, medal }) => [school_id, medal]),
    [
      ["school-a", "gold"],
      ["school-b", "silver"],
      ["school-c", "bronze"],
    ],
  );
  assert.deepEqual(
    calculateMedalAwards({
      matches: [
        ...matches,
        makeMatch({ status: "scheduled", home_score: undefined }),
      ],
      races: [],
      athletes: [],
    }),
    [],
  );
  assert.deepEqual(
    calculateMedalAwards({
      matches: matches.map((match, index) => ({
        ...match,
        pool: index === 0 ? "A" : "B",
      })),
      races: [],
      athletes: [],
    }),
    [],
  );
});

test("round-robin ties share a medal place and skip the next rank", () => {
  const awards = calculateMedalAwards({
    matches: [
      makeMatch({
        home: "school-a",
        away: "school-b",
        home_score: 0,
        away_score: 0,
      }),
      makeMatch({
        home: "school-a",
        away: "school-c",
        home_score: 1,
        away_score: 0,
      }),
      makeMatch({
        home: "school-b",
        away: "school-c",
        home_score: 1,
        away_score: 0,
      }),
    ],
    races: [],
    athletes: [],
  });
  assert.deepEqual(
    awards.map(({ school_id, medal }) => [school_id, medal]),
    [
      ["school-a", "gold"],
      ["school-b", "gold"],
      ["school-c", "bronze"],
    ],
  );
});

test("athletics medals use confirmed final results and shared placements", () => {
  const races: Race[] = [
    {
      id: "race-a",
      event: "วิ่ง 100 เมตร",
      division: "ประถม",
      gender: "หญิง",
      stage: "final",
      heat: 1,
      athlete_id: "athlete-a",
      school_id: "school-a",
      value: 12.1,
      status: "OK",
    },
    {
      id: "race-b",
      event: "วิ่ง 100 เมตร",
      division: "ประถม",
      gender: "หญิง",
      stage: "final",
      heat: 1,
      athlete_id: "athlete-b",
      school_id: "school-b",
      value: 12.4,
      status: "OK",
    },
    {
      id: "race-c",
      event: "วิ่ง 100 เมตร",
      division: "ประถม",
      gender: "หญิง",
      stage: "final",
      heat: 1,
      athlete_id: "athlete-c",
      school_id: "school-c",
      value: 12.8,
      status: "OK",
    },
    {
      id: "race-heat",
      event: "วิ่ง 100 เมตร",
      division: "ประถม",
      gender: "หญิง",
      stage: "heat",
      heat: 1,
      athlete_id: "athlete-d",
      school_id: "school-d",
      value: 11,
      status: "OK",
    },
  ];
  assert.deepEqual(
    calculateMedalAwards({ matches: [], races, athletes: [] }).map(
      ({ school_id, medal }) => [school_id, medal],
    ),
    [
      ["school-a", "gold"],
      ["school-b", "silver"],
      ["school-c", "bronze"],
    ],
  );
});

test("school groups keep unclassified schools in the overall total only", () => {
  const groups = groupSchoolsByMedalCategory([
    { id: "small", name: "โรงเรียนเล็ก", school_type: "ขนาดเล็ก" },
    { id: "extended", name: "โรงเรียนขยาย", school_type: "ขยายโอกาส" },
    { id: "old", name: "โรงเรียนเดิม" },
  ]);
  assert.deepEqual(
    groups.small.map((school) => school.id),
    ["small"],
  );
  assert.deepEqual(
    groups.extended.map((school) => school.id),
    ["extended"],
  );
  assert.deepEqual(
    groups.unclassified.map((school) => school.id),
    ["old"],
  );
});

test("multiple pools wait for a final before overall medals are calculated", () => {
  assert.equal(
    hasMultiplePoolsAwaitingFinal([
      makeMatch({ pool: "A" }),
      makeMatch({ pool: "B" }),
    ]),
    true,
  );
  assert.equal(
    hasMultiplePoolsAwaitingFinal([
      makeMatch({ pool: "A" }),
      makeMatch({ pool: "B" }),
      makeMatch({ pool: "รอบชิงชนะเลิศ" }),
    ]),
    false,
  );
});
