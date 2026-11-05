import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateFixtures,
  fixturesConflict,
  parseCompetitionCsv,
  parseFixtureCsv,
  parseTeamCsv,
  type ManagedCompetition,
} from "../lib/admin-competitions";

const competitionCsv = [
  "name,sport,age_group,gender,details,starters,reserves,team_limit,format,win_points,draw_points,loss_points",
  '"ฟุตบอล, 7 คน",ฟุตบอล,ประถม,ชาย,กติกาทั่วไป,7,3,10,knockout,3,1,0',
].join("\n");
const competitions: ManagedCompetition[] = [
  {
    id: "c1",
    name: "ฟุตบอล 7 คน",
    sport: "ฟุตบอล",
    ageGroup: "ประถม",
    gender: "ชาย",
    details: "",
    starters: 7,
    reserves: 3,
    teamLimit: 10,
    format: "round_robin",
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    teams: ["s1", "s2"],
    fixtures: [],
  },
];
const schools = [
  { id: "s1", name: "โรงเรียนหนึ่ง" },
  { id: "s2", name: "โรงเรียนสอง" },
];

test("competition CSV parses quoted fields and validates quota and format", () => {
  const [competition] = parseCompetitionCsv(competitionCsv);
  assert.equal(competition.name, "ฟุตบอล, 7 คน");
  assert.equal(competition.format, "knockout");
  assert.equal(competition.reserves, 3);
  assert.throws(
    () => parseCompetitionCsv(competitionCsv.replace("knockout", "unknown")),
    /format ต้องเป็น/,
  );
  assert.throws(
    () => parseCompetitionCsv(competitionCsv.replace(",7,3,10,", ",0,3,10,")),
    /ต้องเป็นจำนวนเต็มมากกว่า 0/,
  );
});

test("team CSV rejects unknown, duplicate, or already assigned schools", () => {
  const unassigned = { ...competitions[0], teams: [] };
  assert.deepEqual(
    parseTeamCsv(
      "competition_name,school_name\nฟุตบอล 7 คน,โรงเรียนหนึ่ง",
      [unassigned],
      schools,
    ),
    [{ competition: "c1", school: "s1" }],
  );
  assert.throws(
    () =>
      parseTeamCsv(
        "competition_name,school_name\nฟุตบอล 7 คน,โรงเรียนหนึ่ง\nฟุตบอล 7 คน,โรงเรียนหนึ่ง",
        [unassigned],
        schools,
      ),
    /โรงเรียนซ้ำ/,
  );
  assert.throws(
    () =>
      parseTeamCsv(
        "competition_name,school_name\nฟุตบอล 7 คน,โรงเรียนที่ไม่มี",
        [unassigned],
        schools,
      ),
    /ไม่พบชื่อโรงเรียน/,
  );
  assert.throws(
    () =>
      parseTeamCsv(
        "competition_name,school_name\nฟุตบอล 7 คน,โรงเรียนหนึ่ง",
        [competitions[0]],
        schools,
      ),
    /อยู่ในรายการแล้ว/,
  );
});

test("fixture CSV requires two assigned schools and rejects duplicate pairings", () => {
  const csv = [
    "competition_name,round,home_school,away_school,starts_at,venue",
    "ฟุตบอล 7 คน,รอบ 1,โรงเรียนหนึ่ง,โรงเรียนสอง,2026-11-20T09:00,สนาม 1",
  ].join("\n");
  assert.equal(parseFixtureCsv(csv, competitions, schools)[0].home, "s1");
  assert.throws(
    () =>
      parseFixtureCsv(
        csv.replace("โรงเรียนสอง", "โรงเรียนหนึ่ง"),
        competitions,
        schools,
      ),
    /แข่งกับตัวเอง/,
  );
  assert.throws(
    () =>
      parseFixtureCsv(
        `${csv}\nฟุตบอล 7 คน,รอบ 1,โรงเรียนสอง,โรงเรียนหนึ่ง,,`,
        competitions,
        schools,
      ),
    /คู่แข่งขันซ้ำ/,
  );
  assert.throws(
    () =>
      parseFixtureCsv(
        csv.replace("2026-11-20T09:00", "วันแข่งขัน"),
        competitions,
        schools,
      ),
    /วันเวลาต้องเป็น/,
  );
});

test("schedule conflict detection protects team and venue availability", () => {
  const first = {
    home: "s1",
    away: "s2",
    startsAt: "2026-11-20T09:00",
    venue: "สนาม 1",
  };
  assert.equal(
    fixturesConflict(first, {
      home: "s1",
      away: "s3",
      startsAt: "2026-11-20T09:00",
      venue: "สนาม 2",
    }),
    true,
  );
  assert.equal(
    fixturesConflict(first, {
      home: "s3",
      away: "s4",
      startsAt: "2026-11-20T09:00",
      venue: "สนาม 1",
    }),
    true,
  );
  assert.equal(
    fixturesConflict(first, {
      home: "s3",
      away: "s4",
      startsAt: "2026-11-20T10:00",
      venue: "สนาม 1",
    }),
    false,
  );
});

test("scheduling builds every round-robin pairing and knockout byes", () => {
  const id = () => "fixture";
  const robin = generateFixtures("round_robin", ["a", "b", "c", "d"], id);
  assert.equal(robin.length, 6);
  assert.equal(
    new Set(
      robin.map((fixture) => [fixture.home, fixture.away].sort().join(":")),
    ).size,
    6,
  );
  const knockout = generateFixtures("knockout", ["a", "b", "c"], id);
  assert.equal(knockout.length, 2);
  assert.deepEqual(knockout[0], {
    id: "fixture",
    round: "รอบ 1",
    home: "a",
    away: "b",
    startsAt: "",
    venue: "",
  });
  assert.equal(knockout[1].round, "รอบชิงชนะเลิศ");
  assert.match(knockout[1].home + knockout[1].away, /ผู้ชนะคู่/);
});
