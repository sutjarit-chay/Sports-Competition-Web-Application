import assert from "node:assert/strict";
import test from "node:test";
import {
  isSetSport,
  validateSetScores,
  normalizedMatchStamp,
} from "../lib/set-scores";
test("set sports and optional legacy totals", () => {
  for (const sport of ["วอลเลย์บอล", "เซปักตะกร้อ", "volleyball", "takraw"])
    assert.ok(isSetSport(sport));
  assert.equal(isSetSport("ฟุตบอล"), false);
  assert.equal(validateSetScores(undefined, 2, 1, "ฟุตบอล"), undefined);
  assert.equal(validateSetScores(null, 2, 1, "ฟุตบอล"), undefined);
});
test("best of three sets validate totals, points, ties and completed winner", () => {
  const valid = [
    { home: 25, away: 20 },
    { home: 21, away: 25 },
    { home: 15, away: 10 },
  ];
  assert.deepEqual(validateSetScores(valid, 2, 1, "volleyball"), valid);
  for (const sets of [
    [],
    valid.slice(0, 1),
    [
      { home: 1, away: 0 },
      { home: 2, away: 0 },
      { home: 0, away: 2 },
    ],
    [
      { home: 1, away: 0 },
      { home: 0, away: 1 },
    ],
    [
      { home: 1, away: 1 },
      { home: 1, away: 0 },
    ],
    [
      { home: 1000, away: 0 },
      { home: 1, away: 0 },
    ],
    [
      { home: 1.5, away: 0 },
      { home: 1, away: 0 },
    ],
    [
      { home: "2", away: 0 },
      { home: 1, away: 0 },
    ],
  ])
    assert.throws(() => validateSetScores(sets, 2, 1, "volleyball"));
  assert.throws(() => validateSetScores(valid, 2, 0, "volleyball"));
  assert.throws(() => validateSetScores(valid, 2, 1, "ฟุตบอล"));
});
test("timestamp binding normalizes timezone and fractional padding without losing microseconds", () => {
  assert.equal(
    normalizedMatchStamp("2026-11-15T07:00:00.123001+07:00"),
    normalizedMatchStamp("2026-11-15T00:00:00.123001Z"),
  );
  assert.notEqual(
    normalizedMatchStamp("2026-11-15T00:00:00.123001Z"),
    normalizedMatchStamp("2026-11-15T00:00:00.123002Z"),
  );
});
