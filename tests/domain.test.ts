import { test } from "node:test";
import assert from "node:assert/strict";
import {
  roundRobin,
  standings,
  parseAthletes,
  rankRace,
  medals,
} from "../lib/domain";
test("round robin generates unique pairs and no self match", () => {
  const m = roundRobin(["a", "b", "c", "d"]);
  assert.equal(m.length, 6);
  assert.equal(new Set(m.map((x) => [x.home, x.away].sort().join())).size, 6);
  assert.ok(m.every((x) => x.home !== x.away));
});
test("only finished matches count; points and goal difference determine rank", () => {
  const rows = standings([
    { home: "a", away: "b", homeScore: 2, awayScore: 0, status: "finished" },
    { home: "b", away: "c", homeScore: 1, awayScore: 1, status: "finished" },
    { home: "a", away: "c", status: "scheduled" },
  ]);
  assert.equal(rows[0].school, "a");
  assert.equal(rows[0].points, 3);
  assert.equal(rows.find((x) => x.school === "c")?.played, 1);
});
test("CSV handles quoted names and rejects malformed and duplicate rows", () => {
  assert.equal(
    parseAthletes(
      'name,school_id,sport,gender,division\n"สมชาย, ใจดี",1,ฟุตบอล,ชาย,ประถม',
    )[0].name,
    "สมชาย, ใจดี",
  );
  assert.throws(() =>
    parseAthletes(
      "name,school_id,sport,gender,division\nA,11,ฟุตบอล,ชาย,ประถม",
    ),
  );
  assert.throws(() =>
    parseAthletes(
      "name,school_id,sport,gender,division\nA,1,ฟุตบอล,ชาย,ประถม\nA,1,ฟุตบอล,ชาย,ประถม",
    ),
  );
});
test("race ranking keeps ties and excludes DNS", () => {
  assert.deepEqual(
    rankRace([
      { id: "a", value: 12, status: "OK" },
      { id: "b", value: 12, status: "OK" },
      { id: "c", value: 13, status: "OK" },
      { id: "d", value: null, status: "DNS" },
    ]).map((x) => x.rank),
    [1, 1, 3, null],
  );
});
test("medal table sorts gold before total", () => {
  assert.equal(
    medals([
      { school: "a", medal: "silver" },
      { school: "a", medal: "bronze" },
      { school: "b", medal: "gold" },
    ])[0].school,
    "b",
  );
});
