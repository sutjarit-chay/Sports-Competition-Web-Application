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
