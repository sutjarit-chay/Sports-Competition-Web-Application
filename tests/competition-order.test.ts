import assert from "node:assert/strict";
import test from "node:test";
import { sortCompetitionsByName } from "../lib/competition-order";

test("competition names use Thai dictionary collation including leading vowels", () => {
  const rows = [
    "วอลเลย์บอล",
    "ฟุตบอล",
    "เปตอง",
    "ตะกร้อ",
    "โยนบอล",
    "แชร์บอล",
    "กรีฑา",
  ].map((name, i) => ({ id: String(i), name }));
  assert.deepEqual(
    sortCompetitionsByName(rows).map((row) => row.name),
    ["กรีฑา", "แชร์บอล", "ตะกร้อ", "เปตอง", "ฟุตบอล", "โยนบอล", "วอลเลย์บอล"],
  );
  assert.equal(rows[0].name, "วอลเลย์บอล");
});
test("sorting retains IDs and stable order for equal names without mutating input", () => {
  const rows = [
    { id: "b", name: "ฟุตบอล" },
    { id: "a", name: "กรีฑา" },
    { id: "c", name: "ฟุตบอล" },
  ];
  const before = JSON.stringify(rows);
  assert.deepEqual(
    sortCompetitionsByName(rows).map((row) => row.id),
    ["a", "b", "c"],
  );
  assert.equal(JSON.stringify(rows), before);
});
