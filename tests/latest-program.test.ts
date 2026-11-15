import test from "node:test";
import assert from "node:assert/strict";
import { buildLatestProgram } from "../lib/latest-program";
import { IMAGE_PROGRAM, buildImageCompetitions } from "../lib/image-program";
import { readManagement } from "../lib/production-competitions";
const schools = Object.entries(IMAGE_PROGRAM.schools).map(([key, name], i) => ({
  id: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name,
}));
const management = (c: any) => c.registration_policy.management;
test("latest program preserves eight original brackets and publishes 36 categories with 98 scheduled pairs", () => {
  const result = buildLatestProgram(schools);
  assert.equal(result.length, 36);
  const old = buildImageCompetitions(schools);
  assert.deepEqual(
    result.slice(0, 8).map((c) => c.id),
    old.map((c) => c.id),
  );
  assert.deepEqual(
    result
      .slice(0, 8)
      .map((c) =>
        management(c).fixtures.map((f: any) => [f.id, f.home, f.away]),
      ),
    old.map((c) =>
      management(c).fixtures.map((f: any) => [f.id, f.home, f.away]),
    ),
  );
  assert.equal(
    result.reduce((n, c) => n + management(c).fixtures.length, 0),
    98,
  );
  assert.ok(result.every((c) => readManagement(c.registration_policy)));
  for (const c of result)
    for (const f of management(c).fixtures) {
      assert.equal(f.startsAt, "");
      assert.equal(f.sessionStart, "09:00");
      assert.equal(f.timeMode, "session");
      assert.match(f.competitionDate, /^2026-11-(16|17|18)$/);
      assert.ok(f.venue);
    }
  assert.deepEqual(
    management(result[0]).fixtures.map((f: any) => f.competitionDate),
    Array(8).fill("2026-11-16").concat(Array(8).fill("2026-11-17")),
  );
});
test("athletics covers exactly the published 101–141 sequence and keeps 50 metre registration pending", () => {
  const rows = buildLatestProgram(schools).filter((c) => c.sport === "กรีฑา");
  assert.equal(rows.length, 20);
  const slots = rows.flatMap((c) => management(c).athleticsProgram.slots);
  assert.deepEqual(
    [...new Set(slots.map((s: any) => s.sourceNumber))].sort(
      (a: any, b: any) => a - b,
    ),
    Array.from({ length: 41 }, (_, i) => 101 + i),
  );
  assert.equal(slots.filter((s: any) => s.sourceNumber === 101).length, 4);
  const fifty = rows.filter(
    (c) => management(c).athleticsProgram.eventId === "run50",
  );
  assert.equal(fifty.length, 2);
  for (const c of fifty) {
    assert.deepEqual(c.registration_policy?.eventQuotas, {});
    assert.ok(management(c).registrationPendingReason);
  }
  for (const c of rows) {
    assert.deepEqual(management(c).fixtures, []);
    assert.equal(management(c).athleticsProgram.date, "2026-11-20");
  }
});
test("school aliases resolve to existing UUIDs and pending petanque does not invent a draw", () => {
  const aliases = schools.map((s) => ({
    ...s,
    name: s.name
      .replace("บ้านคงซ่อม", "บ้านดงซ่อม")
      .replace("โรงเรียนมะเดื่อชุมพร", "โรงเรียนบ้านมะเดื่อชุมพร"),
  }));
  assert.deepEqual(buildLatestProgram(aliases), buildLatestProgram(schools));
  assert.deepEqual(
    buildLatestProgram([...aliases].reverse()),
    buildLatestProgram(aliases),
  );
  const rows = buildLatestProgram(aliases).filter((c) => c.sport === "เปตอง");
  assert.equal(rows.length, 4);
  for (const c of rows) {
    assert.equal(management(c).drawPending, true);
    assert.deepEqual(management(c).teams, []);
    assert.deepEqual(management(c).fixtures, []);
    assert.deepEqual(management(c).dateRange, {
      start: "2026-11-16",
      end: "2026-11-17",
    });
  }
});

test("published day boundaries and new secondary opponents remain authoritative", () => {
  const rows = buildLatestProgram(schools);
  const fixtureDays = rows
    .slice(0, 8)
    .map((c) =>
      management(c).fixtures.map((f: any) =>
        Number(f.competitionDate.slice(-2)),
      ),
    );
  assert.deepEqual(fixtureDays, [
    [...Array(8).fill(16), ...Array(8).fill(17)],
    [...Array(5).fill(16), ...Array(5).fill(17)],
    [...Array(6).fill(16), ...Array(4).fill(17)],
    Array(7).fill(17),
    [...Array(4).fill(17), ...Array(4).fill(18)],
    Array(6).fill(17),
    [...Array(9).fill(17), ...Array(4).fill(18)],
    Array(10).fill(18),
  ]);
  const schoolId = (key: string) =>
    schools[Object.keys(IMAGE_PROGRAM.schools).indexOf(key)].id;
  const fixtures = rows.slice(8, 12).map((c) => management(c).fixtures);
  assert.deepEqual(
    fixtures.map((f) => f.length),
    [4, 6, 4, 4],
  );
  assert.deepEqual(
    fixtures[1].map((f: any) => [f.home, f.away]),
    [
      ["nongdaen", "khongsom"],
      ["thakhun", "nonsombun"],
      ["nongdaen", "thakhun"],
      ["khongsom", "nonsombun"],
      ["nonsombun", "nongdaen"],
      ["thakhun", "khongsom"],
    ].map((pair) => pair.map(schoolId)),
  );
  assert.deepEqual(
    fixtures[1].map((f: any) => f.competitionDate),
    [...Array(3).fill("2026-11-16"), ...Array(3).fill("2026-11-17")],
  );
  for (const c of rows.filter((c) => c.sport === "กรีฑา")) {
    const p = management(c).athleticsProgram;
    if (p.eventId !== "run50")
      assert.deepEqual(c.registration_policy.eventQuotas, { [p.eventId]: 1 });
    assert.ok(["อนุบาล", "ประถมศึกษา", "มัธยมศึกษา"].includes(c.age_group));
  }
  assert.equal(new Set(rows.map((c) => c.id)).size, 36);
  assert.throws(() => buildLatestProgram(schools.slice(1)), /โรงเรียน/);
  assert.throws(() => buildLatestProgram([...schools, schools[0]]), /ซ้ำ/);
});
