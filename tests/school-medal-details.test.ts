import assert from "node:assert/strict";
import test from "node:test";
import type { Award } from "../lib/domain";
import { schoolMedalDetails } from "../lib/school-medal-details";
const award = (
  id: string,
  event: string,
  medal: string,
  school_id = "one",
): Award => ({
  id,
  event,
  medal,
  school_id,
  division: "ประถมศึกษา",
  gender: "ชาย",
  competition_id: id,
});
test("school details retain one row per counted award and exactly match the selected school's totals", () => {
  const result = schoolMedalDetails(
    [
      award("g", "ฟุตบอล", "gold"),
      award("s", "วอลเลย์บอล", "silver"),
      award("b", "เปตอง", "bronze"),
      award("other", "ฟุตบอล", "gold", "two"),
    ],
    "one",
    (id) => (id === "g" ? "ฟุตบอลชาย ประถมศึกษา" : ""),
  );
  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.totals, { gold: 1, silver: 1, bronze: 1, total: 3 });
  assert.equal(result.rows[0].name, "ฟุตบอลชาย ประถมศึกษา");
  assert.equal(result.rows[0].division, "ประถมศึกษา");
  assert.equal(result.rows[0].gender, "ชาย");
});
test("gold precedes silver and bronze, then Thai dictionary order, without mutating source awards", () => {
  const source = [
    award("s", "กรีฑา", "silver"),
    award("g2", "ฟุตบอล", "gold"),
    award("g1", "แชร์บอล", "gold"),
  ];
  const before = JSON.stringify(source);
  assert.deepEqual(
    schoolMedalDetails(source, "one").rows.map((row) => row.id),
    ["g1", "g2", "s"],
  );
  assert.equal(JSON.stringify(source), before);
});
test("legacy athletics events remain distinct and duplicate counted rows are not silently deduplicated", () => {
  const first = award("track", "วิ่ง 60 เมตร", "gold");
  const result = schoolMedalDetails(
    [first, { ...first, event: "วิ่ง 100 เมตร" }, first],
    "one",
    () => "กรีฑาชาย",
  );
  assert.equal(result.rows.length, 3);
  assert.equal(result.totals.gold, 3);
  assert.ok(result.rows.some((row) => row.event === "วิ่ง 100 เมตร"));
  assert.deepEqual(schoolMedalDetails([], "one").totals, {
    gold: 0,
    silver: 0,
    bronze: 0,
    total: 0,
  });
});
