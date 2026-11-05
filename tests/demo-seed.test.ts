import assert from "node:assert/strict";
import test from "node:test";
import { fixturesConflict } from "../lib/admin-competitions";
import {
  createDemoCompetitionData,
  demoFixturesAsMatches,
} from "../lib/demo-seed";
import { RULES, validateRoster } from "../lib/registration";

test("demo seed creates ten schools with a complete valid roster for every rule", () => {
  const seed = createDemoCompetitionData();

  assert.equal(seed.schools.length, 10);
  assert.equal(seed.competitions.length, RULES.length);
  assert.equal(new Set(seed.schools.map((school) => school.id)).size, 10);
  assert.equal(
    seed.competitions.reduce(
      (total, competition) => total + competition.fixtures.length,
      0,
    ),
    RULES.length * 45,
  );
  for (const competition of seed.competitions) {
    assert.equal(competition.fixtures.length, 45, competition.name);
    assert.equal(
      new Set(
        competition.fixtures.map((fixture) =>
          [fixture.home, fixture.away].sort().join(":"),
        ),
      ).size,
      45,
      `${competition.name} has every unique pair`,
    );
    assert.ok(competition.fixtures.every((fixture) => fixture.startsAt));
    assert.ok(competition.fixtures.every((fixture) => fixture.venue));
    assert.deepEqual(
      new Set(competition.fixtures.map((fixture) => fixture.round)),
      new Set(Array.from({ length: 9 }, (_, index) => `รอบ ${index + 1}`)),
    );
  }

  const allFixtures = seed.competitions.flatMap(
    (competition) => competition.fixtures,
  );
  const timeSlots = new Map<string, typeof allFixtures>();
  for (const fixture of allFixtures)
    timeSlots.set(fixture.startsAt, [
      ...(timeSlots.get(fixture.startsAt) || []),
      fixture,
    ]);
  assert.equal(timeSlots.size, 99);
  for (const [startsAt, fixtures] of timeSlots) {
    assert.equal(fixtures.length, 5, startsAt);
    for (let first = 0; first < fixtures.length; first++)
      for (let second = first + 1; second < fixtures.length; second++)
        assert.equal(
          fixturesConflict(fixtures[first], fixtures[second]),
          false,
          `Schedule conflict at ${startsAt}`,
        );
  }

  const matches = demoFixturesAsMatches(seed.competitions);
  assert.equal(matches.length, 495);
  assert.ok(matches.every((match) => match.status === "scheduled"));
  assert.ok(matches.every((match) => match.starts_at && match.venue));

  for (const school of seed.schools)
    for (const rule of RULES) {
      const roster = seed.athletes.filter(
        (athlete) =>
          athlete.school_id === school.id && athlete.roster?.ruleId === rule.id,
      );
      assert.ok(roster.length > 0, `${school.name} has ${rule.name}`);
      validateRoster([], roster, seed.policies[rule.id]);
    }

  assert.equal(
    seed.athletes.filter(
      (athlete) => athlete.roster?.ruleId === "football-male",
    ).length,
    100,
  );
  assert.equal(
    seed.athletes.filter(
      (athlete) => athlete.roster?.ruleId === "athletics-individual",
    ).length,
    100,
  );
});

test("demo seed preserves the provided school identity and fills to ten", () => {
  const seed = createDemoCompetitionData([
    { id: "school-login", name: "โรงเรียนบัญชีที่เลือก" },
  ]);
  assert.equal(seed.schools.length, 10);
  assert.equal(seed.schools[0].id, "school-login");
  assert.ok(
    seed.athletes.some((athlete) => athlete.school_id === "school-login"),
  );
});

test("manually created competitions project to the operational match list too", () => {
  const competition = {
    ...createDemoCompetitionData().competitions[0],
    id: "manual-competition",
  };
  const matches = demoFixturesAsMatches([competition]);
  assert.equal(matches.length, 45);
  assert.ok(matches.every((m) => m.competition_id === "manual-competition"));
});

test("reprojecting fixtures preserves confirmed scores and advances knockout winners", () => {
  const competition = {
    ...createDemoCompetitionData().competitions[0],
    id: "manual-knockout",
    format: "knockout" as const,
    teams: ["a", "b", "c"],
    fixtures: [
      {
        id: "semi",
        round: "รอบ 1",
        home: "a",
        away: "b",
        startsAt: "",
        venue: "",
      },
      {
        id: "final",
        round: "รอบชิงชนะเลิศ",
        home: "ผู้ชนะคู่ 1",
        away: "c",
        startsAt: "",
        venue: "",
      },
    ],
  };
  const played = [
    {
      id: "semi",
      competition_id: competition.id,
      sport: "ฟุตบอล",
      division: "ประถม",
      gender: "ชาย",
      pool: "รอบ 1",
      home: "a",
      away: "b",
      starts_at: "",
      venue: "",
      status: "finished",
      home_score: 2,
      away_score: 0,
    },
  ];
  const projected = demoFixturesAsMatches([competition], played);
  assert.equal(projected.length, 2);
  assert.equal(projected[0].status, "finished");
  assert.equal(projected[1].home, "a");
  assert.equal(projected[1].pool, "รอบชิงชนะเลิศ");
});

test("imported knockout rounds retain third-place and semifinal labels", () => {
  const base = createDemoCompetitionData().competitions[0];
  const fixtures = ["รอบชิงชนะเลิศ", "รอบชิงอันดับ 3", "semifinal"].map(
    (round, i) => ({
      id: `imported-${i}`,
      round,
      home: base.teams[0],
      away: base.teams[1],
      startsAt: "",
      venue: "",
    }),
  );
  const matches = demoFixturesAsMatches([
    { ...base, format: "knockout", fixtures },
  ]);
  assert.deepEqual(
    matches.map((m) => m.pool),
    ["รอบชิงชนะเลิศ", "รอบชิงอันดับ 3", "semifinal"],
  );
});
