import assert from "node:assert/strict";
import test from "node:test";
import { buildCompetitionProgress } from "../lib/competition-progress";
import type {
  Competition,
  AthleticsEvent,
  AthleticsResult,
} from "../lib/hosted";
import type { ScheduleMatch } from "../lib/schedule-view";
const competition: Competition = {
  id: "football",
  name: "ฟุตบอลชาย ประถมศึกษา",
  sport: "ฟุตบอล",
  age_group: "ประถมศึกษา",
  gender: "ชาย",
  win_points: 3,
  draw_points: 1,
  loss_points: 0,
};
const match = (
  id: string,
  number: number,
  date: string,
  status = "pending",
): ScheduleMatch => ({
  id,
  competition_id: competition.id,
  sport: competition.sport,
  division: competition.age_group,
  gender: competition.gender,
  pool: "A",
  home: "home",
  away: "away",
  starts_at: "",
  venue: "",
  status,
  fixtureOnly: status === "pending",
  sourceNumber: number,
  competitionDate: date,
  sessionStart: "09:00",
  timeMode: "session",
});
const build = (
  competitions: Competition[],
  matches: ScheduleMatch[] = [],
  athleticsEvents: AthleticsEvent[] = [],
  athleticsResults: AthleticsResult[] = [],
) =>
  buildCompetitionProgress({
    competitions,
    matches,
    athleticsEvents,
    athleticsResults,
    schoolName: (id) =>
      id === "home"
        ? "โรงเรียนบ้านหนองแดน"
        : id === "away"
          ? "โรงเรียนบ้านไร่ลำปาง"
          : id,
  });
test("team totals include unresolved programme slots and select next by date then numeric source number", () => {
  const rows = [
    match("later", 1, "2026-11-18"),
    match("ten", 10, "2026-11-17"),
    { ...match("two", 2, "2026-11-17"), home: "ผู้ชนะคู่ 1" },
    match("done", 1, "2026-11-17", "finished"),
  ];
  const before = JSON.stringify(rows);
  const [progress] = build([competition], rows);
  assert.deepEqual(
    [progress.total, progress.completed, progress.remaining],
    [4, 1, 3],
  );
  assert.match(progress.nextLabel, /คู่ที่ 2/);
  assert.match(progress.nextLabel, /ผู้ชนะคู่ 1/);
  assert.equal(JSON.stringify(rows), before);
});
test("finished and legacy confirmed results count once; fully complete and no-programme states are distinct", () => {
  const done = match("done", 1, "2026-11-17", "confirmed");
  const [complete] = build([competition], [done, done]);
  assert.deepEqual(
    [complete.total, complete.completed, complete.remaining],
    [1, 1, 0],
  );
  assert.equal(complete.nextLabel, "แข่งขันครบแล้ว");
  const [pending] = build([competition]);
  assert.equal(pending.total, null);
  assert.match(pending.nextLabel, /รอจัดการแข่งขัน/);
});
const athletics: Competition = {
  ...competition,
  id: "track",
  name: "วิ่ง 100 เมตร ชาย",
  sport: "กรีฑา",
  registration_policy: {
    ruleId: "athletics-individual",
    reserves: 0,
    eventQuotas: {},
    maxEventsPerAthlete: null,
    management: {
      athleticsProgram: {
        eventName: "วิ่ง 100 เมตร",
        date: "2026-11-20",
        sessionStart: "09:00",
        slots: [
          { sourceNumber: 110, stage: "heat", heat: 1 },
          { sourceNumber: 120, stage: "final", heat: 1 },
        ],
      },
    },
  } as any,
};
const event: AthleticsEvent = {
  id: "heat",
  competition_id: "track",
  name: "วิ่ง 100 เมตร",
  kind: "track",
  round: "heat",
  heat: 1,
  direction: "lower",
  unit: "s",
  starts_at: "2026-11-20T02:00:00Z",
};
const result: AthleticsResult = {
  id: "r",
  event_id: "heat",
  school_id: "home",
  bib: "101",
  value: 12,
  status: "OK",
};
test("athletics merge programme and actual heats; athlete results never inflate completed heat counts", () => {
  const [progress] = build(
    [athletics],
    [],
    [event],
    [result, { ...result, id: "r2", bib: "102" }],
  );
  assert.deepEqual(
    [progress.total, progress.completed, progress.remaining],
    [2, 1, 1],
  );
  assert.equal(progress.unit, "ฮีต/รอบ");
  assert.match(progress.nextLabel, /120.*รอบชิง/);
  assert.match(progress.note || "", /ไม่ใช่.*จบ/);
});
test("athletics without any saved results remain pending, even if an event exists", () => {
  const [progress] = build([athletics], [], [event]);
  assert.equal(progress.completed, 0);
  assert.equal(progress.remaining, 2);
  assert.match(progress.nextLabel, /110/);
});
test("ambiguous athletics round/heat definitions are disclosed rather than inventing totals", () => {
  const [progress] = build(
    [athletics],
    [],
    [event, { ...event, id: "duplicate" }],
    [result],
  );
  assert.equal(progress.total, null);
  assert.match(progress.nextLabel, /ฮีต.*ซ้ำ/);
});
test("competitions use Thai dictionary order and retain gender and level", () => {
  const rows = build([competition, athletics]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["football", "track"],
  );
  assert.equal(rows[0].level, "ประถมศึกษา");
  assert.equal(rows[0].gender, "ชาย");
});

test("latest programme retains 98 team slots and 44 athletics slots without persisted matches", async () => {
  const { buildLatestProgram } = await import("../lib/latest-program");
  const { IMAGE_PROGRAM } = await import("../lib/image-program");
  const { managedFromHosted } = await import("../lib/production-competitions");
  const { buildScheduleMatches } = await import("../lib/schedule-view");
  const schools = Object.values(IMAGE_PROGRAM.schools).map((name, i) => ({
    id: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    name,
  }));
  const competitions = buildLatestProgram(schools);
  const projected = build(
    competitions,
    buildScheduleMatches(managedFromHosted(competitions, []), []),
  );
  assert.equal(projected.length, 36);
  assert.equal(
    projected
      .filter((row) => row.unit === "คู่/แมตช์")
      .reduce((sum, row) => sum + (row.total || 0), 0),
    98,
  );
  assert.equal(
    projected
      .filter((row) => row.unit === "ฮีต/รอบ")
      .reduce((sum, row) => sum + (row.total || 0), 0),
    44,
  );
  assert.ok(
    projected.every((row) => row.completed === 0 || row.completed === null),
  );
});

test("pending draw cannot look complete because a legacy finished match exists", () => {
  const pending = {
    ...competition,
    registration_policy: {
      management: { drawPending: true, fixtures: [] },
    } as any,
  };
  const [row] = build(
    [pending],
    [match("legacy", 1, "2026-11-16", "finished")],
  );
  assert.equal(row.total, null);
  assert.equal(row.remaining, null);
  assert.match(row.nextLabel, /รอจับสลาก/);
});
test("a published fixture programme takes precedence over a stale pending-draw flag", () => {
  const drawn = {
    ...competition,
    registration_policy: {
      management: { drawPending: true, fixtures: [{ id: "done" }] },
    } as any,
  };
  const [row] = build([drawn], [match("done", 1, "2026-11-16", "finished")]);
  assert.equal(row.remaining, 0);
  assert.equal(row.nextLabel, "แข่งขันครบแล้ว");
});
test("athletics source programme date precedes conflicting actual event timestamps", () => {
  const [row] = build(
    [athletics],
    [],
    [
      { ...event, starts_at: "2026-11-21T02:00:00Z" },
      {
        ...event,
        id: "final",
        round: "final",
        starts_at: "2026-11-20T02:00:00Z",
      },
    ],
  );
  assert.match(row.nextLabel, /110/);
  assert.match(row.nextWhen, /20 พ.ย. 2569/);
});
