import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MatchResultsReport, {
  MatchResultDialog,
} from "../components/match-results-report";
import type { Match } from "../lib/domain";
const schoolName = (id: string) =>
  id === "home" ? "โรงเรียนบ้านต้นไม้" : "โรงเรียนบ้านสายน้ำ";
const match: Match = {
  id: "match-1",
  sport: "วอลเลย์บอล",
  gender: "หญิง",
  division: "ประถมศึกษา",
  pool: "รอบชิงชนะเลิศ",
  home: "home",
  away: "away",
  starts_at: "2026-11-15T09:00",
  venue: "สนามกลาง",
  status: "finished",
  home_score: 2,
  away_score: 0,
  setScores: [
    { home: 25, away: 18 },
    { home: 25, away: 20 },
  ],
};
const noop = () => {};
test("finished result cards show full schools, totals, set points and accessible dialog trigger", () => {
  const html = renderToStaticMarkup(
    createElement(MatchResultsReport, {
      matches: [match, { ...match, id: "scheduled", status: "scheduled" }],
      schoolName,
      onSelect: noop,
    }),
  );
  assert.match(html, /โรงเรียนบ้านต้นไม้/);
  assert.match(html, /โรงเรียนบ้านสายน้ำ/);
  assert.match(html, /2 : 0/);
  assert.match(html, /25–18/);
  assert.match(html, /ผู้ชนะ: โรงเรียนบ้านต้นไม้/);
  assert.equal((html.match(/aria-haspopup="dialog"/g) || []).length, 1);
});
test("dialog SSR shows sequential set table and metadata without invoking browser APIs", () => {
  const html = renderToStaticMarkup(
    createElement(MatchResultDialog, { match, schoolName, onClose: noop }),
  );
  assert.match(html, /<dialog/);
  assert.match(html, /แต้มรายเซต/);
  assert.match(html, /<th scope="row">1<\/th>/);
  assert.match(html, /<td>18<\/td>/);
  assert.match(html, /สนามกลาง/);
  assert.match(html, /15 พ.ย. 2569/);
});
test("legacy set results explicitly lack set details and never invent them", () => {
  const html = renderToStaticMarkup(
    createElement(MatchResultDialog, {
      match: { ...match, setScores: undefined },
      schoolName,
      onClose: noop,
    }),
  );
  assert.match(html, /ยังไม่มีข้อมูลแต้มรายเซต/);
  assert.doesNotMatch(html, /<tbody>/);
});
test("draw and league points are shown only for league or group fixtures", () => {
  const tied = { ...match, home_score: 1, away_score: 1, setScores: undefined };
  const render = (fixture: Match) =>
    renderToStaticMarkup(
      createElement(MatchResultDialog, {
        match: fixture,
        schoolName,
        onClose: noop,
        points: { win: 3, draw: 1, loss: 0 },
      }),
    );
  assert.match(
    render({ ...tied, phase: "group" }),
    /คะแนนตาราง: โรงเรียนบ้านต้นไม้ 1 · โรงเรียนบ้านสายน้ำ 1/,
  );
  assert.match(render(tied), /เสมอ/);
  assert.doesNotMatch(
    render({ ...tied, phase: "knockout", format: "round_robin" }),
    /คะแนนตาราง/,
  );
});
test("empty report and null dialog render safely", () => {
  assert.match(
    renderToStaticMarkup(
      createElement(MatchResultsReport, {
        matches: [],
        schoolName,
        onSelect: noop,
      }),
    ),
    /ยังไม่มีผลการแข่งขันที่ยืนยันแล้ว/,
  );
  assert.doesNotThrow(() =>
    renderToStaticMarkup(
      createElement(MatchResultDialog, {
        match: null,
        schoolName,
        onClose: noop,
      }),
    ),
  );
});
