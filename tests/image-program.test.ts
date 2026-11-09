import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_PROGRAM, buildImageCompetitions } from "../lib/image-program";
const schools = Object.entries(IMAGE_PROGRAM.schools).map(([key, name], i) => ({
  id: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name: key === "railampang" ? "banrailampang" : name,
}));
test("image program preserves exactly eight categories and eighty original-number fixtures", () => {
  const comps = buildImageCompetitions(schools);
  assert.equal(comps.length, 8);
  assert.equal(
    comps.reduce(
      (n, c) => n + c.registration_policy.management.fixtures.length,
      0,
    ),
    80,
  );
  assert.deepEqual(
    comps.map((c) => c.registration_policy.management.fixtures.length),
    [16, 10, 10, 7, 8, 6, 13, 10],
  );
  assert.deepEqual(
    comps[1].registration_policy.management.fixtures.map((f) => f.sourceNumber),
    [1, 2, 3, 4, 5, 9, 10, 12, 15, 16],
  );
  assert.equal(
    comps.some((c) => c.sport === "เปตอง" || c.sport === "กรีฑา"),
    false,
  );
  assert.equal(comps.filter((c) => c.age_group === "มัธยมศึกษา").length, 1);
});
test("image group stages contain every unordered pair exactly once and final references point backward", () => {
  for (const c of buildImageCompetitions(schools)) {
    const m = c.registration_policy.management;
    for (const group of m.groups || []) {
      const games = m.fixtures.filter(
        (f) => f.phase === "group" && f.round === `รอบแรก สาย ${group.name}`,
      );
      assert.equal(
        games.length,
        (group.teams.length * (group.teams.length - 1)) / 2,
      );
      assert.equal(
        new Set(games.map((f) => [f.home, f.away].sort().join("|"))).size,
        games.length,
      );
      assert.ok(
        games.every(
          (f) => group.teams.includes(f.home) && group.teams.includes(f.away),
        ),
      );
    }
    const prior = new Set<number>();
    for (const f of m.fixtures) {
      for (const participant of [f.home, f.away]) {
        const ref = /^ผู้(?:ชนะ|แพ้)คู่ (\d+)$/.exec(participant);
        if (ref)
          assert.ok(prior.has(Number(ref[1])), `${c.name}: ${participant}`);
      }
      prior.add(f.sourceNumber!);
    }
  }
});
test("image program leaves all timestamps/venues unresolved, keeps organizer quotas unknown and athletics pending", () => {
  const comps = buildImageCompetitions(schools);
  assert.ok(
    comps.every((c) =>
      c.registration_policy.management.fixtures.every(
        (f) => f.startsAt === "" && f.venue === "",
      ),
    ),
  );
  assert.equal(
    comps.find((c) => c.sport === "แชร์บอล")?.registration_policy.reserves,
    null,
  );
  assert.equal(
    comps.find((c) => c.sport === "โยนบอล")?.registration_policy.reserves,
    null,
  );
  assert.equal(
    IMAGE_PROGRAM.pendingAthletics.individualQuotaPerSchoolPerEvent,
    1,
  );
  assert.equal(IMAGE_PROGRAM.pendingAthletics.maxEventsPerAthlete, null);
  assert.equal(IMAGE_PROGRAM.pendingAthletics.genderAgeTablePending, true);
  assert.equal(IMAGE_PROGRAM.pendingAthletics.relayStarters, 4);
});
test("image import maps school aliases uniquely and is deterministic without positional fake IDs", () => {
  const first = buildImageCompetitions(schools),
    second = buildImageCompetitions([...schools].reverse());
  assert.deepEqual(first, second);
  assert.throws(() => buildImageCompetitions(schools.slice(1)), /โรงเรียน/);
  assert.throws(
    () =>
      buildImageCompetitions([
        ...schools,
        { id: "duplicate", name: schools[0].name },
      ]),
    /ซ้ำ/,
  );
  const ids = new Set(schools.map((s) => s.id));
  assert.ok(
    first.every((c) =>
      c.registration_policy.management.teams.every((id) => ids.has(id)),
    ),
  );
});
