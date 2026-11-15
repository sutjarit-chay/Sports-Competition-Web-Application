import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SpiderSchedule from "../components/spider-schedule";
import { buildScheduleMatches } from "../lib/schedule-view";
import { IMAGE_PROGRAM, buildImageCompetitions } from "../lib/image-program";
import { managedFromHosted } from "../lib/production-competitions";
const schools = Object.values(IMAGE_PROGRAM.schools).map((name, i) => ({
  id: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name,
}));
const comps = managedFromHosted(buildImageCompetitions(schools), []);
test("schedule includes all 80 undated image fixtures, preserving source numbers and qualifying labels", () => {
  const rows = buildScheduleMatches(comps, []);
  assert.equal(rows.length, 80);
  assert.ok(
    rows.every((m) => m.starts_at === "" && m.venue === "" && m.fixtureOnly),
  );
  assert.deepEqual(
    rows
      .filter((m) => m.competition_id === comps[1].id)
      .map((m) => m.sourceNumber),
    [1, 2, 3, 4, 5, 9, 10, 12, 15, 16],
  );
  assert.equal(
    rows.find((m) => m.competition_id === comps[0].id && m.sourceNumber === 13)
      ?.home,
    "ที่ 1 สาย A",
  );
  assert.ok(
    rows.every((m) => m.home_score === undefined && m.away_score === undefined),
  );
});
test("persisted results and participants override fixture labels without duplication or mutation", () => {
  const c = comps[0],
    f = c.fixtures[12];
  const actual = {
    id: f.id,
    competition_id: c.id,
    sport: c.sport,
    division: c.ageGroup,
    gender: c.gender,
    pool: f.round,
    home: c.teams[0],
    away: c.teams[1],
    starts_at: "2026-11-20T13:00",
    venue: "สนามจริง",
    status: "finished",
    home_score: 2,
    away_score: 1,
  };
  const before = JSON.stringify([comps, actual]);
  const rows = buildScheduleMatches(comps, [actual]);
  const match = rows.find((m) => m.id === f.id)!;
  assert.equal(rows.length, 80);
  assert.equal(match.home, actual.home);
  assert.equal(match.home_score, 2);
  assert.equal(match.venue, "สนามจริง");
  assert.equal(match.fixtureOnly, false);
  assert.equal(match.sourceNumber, 13);
  assert.equal(JSON.stringify([comps, actual]), before);
});
test("bracket connector canvas uses paired rows, not unique school count", () => {
  const matches = buildScheduleMatches([comps[1]], []);
  const html = renderToStaticMarkup(
    createElement(SpiderSchedule, {
      matches,
      schoolName: (id: string) => schools.find((s) => s.id === id)?.name || id,
      canEdit: false,
      busy: false,
      canAssign: false,
      onSave: () => {},
    }),
  );
  assert.match(html, /viewBox="0 0 104 1520"/);
  assert.match(html, /คู่ที่ 16/);
  const teamLabels = [
    ...html.matchAll(
      /class="schedule-bracket-team"[^>]*>[\s\S]*?<strong[^>]*>(.*?)<\/strong>/g,
    ),
  ].map((m) => m[1]);
  assert.equal(teamLabels.length, 20);
  assert.ok(
    teamLabels.every((name) => schools.some((s) => s.name === name)),
    "visible bracket labels must contain full school names",
  );
  assert.match(html, /รอกำหนดเวลา/);
});

test("every source round renders all its pairs with aligned connectors and original labels", () => {
  const rows = buildScheduleMatches(comps, []);
  let renderedPairs = 0;
  for (const c of comps) {
    const rounds = new Set(c.fixtures.map((f) => f.round));
    for (const pool of rounds) {
      const matches = rows.filter(
        (m) => m.competition_id === c.id && m.pool === pool,
      );
      const html = renderToStaticMarkup(
        createElement(SpiderSchedule, {
          matches,
          schoolName: (id: string) =>
            schools.find((s) => s.id === id)?.name || id,
          canEdit: false,
          busy: false,
          canAssign: false,
          onSave: () => {},
        }),
      );
      assert.ok(html.includes(`viewBox="0 0 104 ${matches.length * 152}"`));
      assert.equal(
        (html.match(/class="schedule-bracket-game"/g) || []).length,
        matches.length,
      );
      assert.equal(
        (html.match(/class="schedule-bracket-team"/g) || []).length,
        matches.length * 2,
      );
      for (const match of matches)
        assert.ok(html.includes(`คู่ที่ ${match.sourceNumber}`));
      if (
        matches.every((m) => m.format === "knockout" && m.phase !== "group")
      ) {
        assert.match(html, /disabled=""[^>]*>ผังพบกันหมด/);
        assert.match(html, /การแข่งขันแบบคัดออก/);
      }
      renderedPairs += matches.length;
    }
  }
  assert.equal(renderedPairs, 80);
});

test("source dates precede reset source numbers and survive persisted actual times", () => {
  const c = structuredClone(comps[0]);
  c.fixtures = [
    {
      ...c.fixtures[0],
      sourceNumber: 1,
      competitionDate: "2026-11-17",
      sessionStart: "09:00",
      timeMode: "session",
    },
    {
      ...c.fixtures[1],
      sourceNumber: 16,
      competitionDate: "2026-11-16",
      sessionStart: "09:00",
      timeMode: "session",
    },
  ];
  const rows = buildScheduleMatches([c], []);
  assert.deepEqual(
    rows.map((m) => m.sourceNumber),
    [16, 1],
  );
  const actual = { ...rows[0], starts_at: "2026-12-01T14:30" };
  const persisted = buildScheduleMatches([c], [actual]);
  assert.equal(persisted[0].competitionDate, "2026-11-16");
  const html = renderToStaticMarkup(
    createElement(SpiderSchedule, {
      matches: persisted,
      schoolName: (id: string) => id,
      canEdit: false,
      busy: false,
      canAssign: false,
      onSave: () => {},
    }),
  );
  assert.match(html, /16 พ.ย. 2569 · เริ่ม 09:00 น. เป็นต้นไป/);
  assert.doesNotMatch(html, /14:30/);
});

test("one source day combines pools in source order and disables mixed knockout matrix", () => {
  const c = structuredClone(comps[0]);
  c.fixtures = c.fixtures.slice(0, 3).map((f, i) => ({
    ...f,
    sourceNumber: [3, 1, 2][i],
    round: i === 1 ? "สาย B" : "สาย A",
    phase: i === 2 ? "knockout" : "group",
    competitionDate: "2026-11-16",
    sessionStart: "09:00",
    timeMode: "session",
  }));
  const html = renderToStaticMarkup(
    createElement(SpiderSchedule, {
      matches: buildScheduleMatches([c], []),
      schoolName: (id: string) => id,
      canEdit: false,
      busy: false,
      canAssign: false,
      onSave: () => {},
    }),
  );
  assert.match(html, /viewBox="0 0 104 456"/);
  assert.ok(html.indexOf("คู่ที่ 1") < html.indexOf("คู่ที่ 2"));
  assert.ok(html.indexOf("คู่ที่ 2") < html.indexOf("คู่ที่ 3"));
  assert.match(html, /สาย B · คู่ที่ 1/);
  assert.match(html, /disabled=""[^>]*>ผังพบกันหมด/);
});

test("athletics program keeps shared event numbers and session time for four mini categories", async () => {
  const { default: AthleticsProgram } =
    await import("../components/athletics-program");
  const competitions = ["ป.1 ชาย", "ป.1 หญิง", "ป.2 ชาย", "ป.2 หญิง"].map(
    (name, i) => ({
      id: `mini-${i}`,
      name,
      sport: "กรีฑา",
      age_group: name.split(" ")[0],
      gender: name.split(" ")[1],
      win_points: 3,
      draw_points: 1,
      loss_points: 0,
      registration_policy: {
        management: {
          athleticsProgram: [
            {
              eventId: `mini-${i}`,
              eventName: "วิ่ง 50 เมตร",
              levelBand: "ป.1–ป.2",
              date: "2026-11-16",
              sessionStart: "09:00",
              slots: [{ sourceNumber: 101, stage: "final", heat: 1 }],
            },
          ],
        },
      },
    }),
  );
  const html = renderToStaticMarkup(
    createElement(AthleticsProgram, { competitions: competitions as never }),
  );
  assert.equal((html.match(/<td>101<\/td>/g) || []).length, 4);
  for (const c of competitions)
    assert.ok(html.includes(c.age_group) && html.includes(c.gender));
  assert.match(html, /เริ่ม 09:00 น. เป็นต้นไป/);
  assert.doesNotMatch(html, /09:0[1-9]/);
});

test("pending petanque draw is an explicit dated notice without invented fixtures", async () => {
  const { default: AthleticsProgram } =
    await import("../components/athletics-program");
  const html = renderToStaticMarkup(
    createElement(AthleticsProgram, {
      competitions: [
        {
          id: "petanque",
          sport: "เปตอง",
          name: "เปตอง ประถม ชาย",
          age_group: "ประถม",
          gender: "ชาย",
          win_points: 3,
          draw_points: 1,
          loss_points: 0,
          registration_policy: {
            management: {
              drawPending: true,
              dateRange: { start: "2026-11-16", end: "2026-11-17" },
            },
          },
        },
      ] as never,
    }),
  );
  assert.match(html, /รอจับสลาก/);
  assert.match(html, /16 พ.ย. 2569/);
  assert.match(html, /17 พ.ย. 2569/);
  assert.doesNotMatch(html, /คู่ที่/);
});

test("exact dated matches sort with session dates before source numbers and unknown dates", () => {
  const c = structuredClone(comps[0]);
  c.fixtures = [
    { ...c.fixtures[0], sourceNumber: 1, startsAt: "2026-11-18T10:00" },
    {
      ...c.fixtures[1],
      sourceNumber: 2,
      competitionDate: "2026-11-16",
      sessionStart: "09:00",
      timeMode: "session",
    },
    { ...c.fixtures[2], sourceNumber: 3, startsAt: "2026-11-15T10:00" },
    { ...c.fixtures[3], sourceNumber: 4, startsAt: "" },
  ];
  assert.deepEqual(
    buildScheduleMatches([c], []).map((row) => row.sourceNumber),
    [3, 2, 1, 4],
  );
});

test("latest source program renders every athletics slot and shared mini number", async () => {
  const { default: AthleticsProgram } =
    await import("../components/athletics-program");
  const { buildLatestProgram } = await import("../lib/latest-program");
  const html = renderToStaticMarkup(
    createElement(AthleticsProgram, {
      competitions: buildLatestProgram(schools),
    }),
  );
  assert.equal((html.match(/<td>101<\/td>/g) || []).length, 4);
  assert.equal(
    (html.match(/<tbody>[\s\S]*?<\/tbody>/g) || []).join("").match(/<tr>/g)
      ?.length,
    44,
  );
  assert.match(html, /รอจับสลาก/);
  assert.match(html, /ป\.1–3/);
});
