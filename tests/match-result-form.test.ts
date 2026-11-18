import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchResultForm } from "../components/match-result-form";
import type { Match } from "../lib/domain";
import type { ScheduleMatch } from "../lib/schedule-view";

const fixture: Match = {
  id: "set-entry",
  sport: "วอลเลย์บอล",
  division: "ประถม",
  gender: "ชาย",
  pool: "A",
  home: "one",
  away: "two",
  starts_at: "",
  venue: "สนาม 1",
  status: "pending",
};
function render(match: ScheduleMatch) {
  return renderToStaticMarkup(
    createElement(MatchResultForm, {
      match,
      schoolName: (id: string) => (id === "one" ? "โรงเรียน ก" : "โรงเรียน ข"),
      busy: false,
      canEdit: true,
      onSubmit: () => {},
    }),
  );
}

test("new set sport offers two empty required sets and derived totals", () => {
  const html = render(fixture);
  assert.match(html, /type="checkbox" checked=""/);
  assert.match(html, /เซตที่ 1 · โรงเรียน ก/);
  assert.match(html, /เซตที่ 2 · โรงเรียน ข/);
  assert.match(html, /เพิ่มเซตที่ 3/);
  assert.match(html, /readOnly=""/);
});

test("legacy result preserves totals without inventing set points", () => {
  const html = render({
    ...fixture,
    status: "finished",
    home_score: 2,
    away_score: 1,
  });
  assert.match(html, /ยังไม่มีแต้มรายเซต/);
  assert.doesNotMatch(html, /<fieldset/);
  assert.match(html, /name="home"[^>]*value="2"/);
  assert.match(html, /ยืนยันผลแล้ว · 2 – 1/);
});

test("existing set points are prefilled and football keeps manual scores", () => {
  const html = render({
    ...fixture,
    status: "finished",
    home_score: 2,
    away_score: 0,
    setScores: [
      { home: 25, away: 12 },
      { home: 25, away: 18 },
    ],
  });
  assert.match(html, /value="25"/);
  assert.match(html, /value="18"/);
  const football = render({ ...fixture, sport: "ฟุตบอล" });
  assert.doesNotMatch(football, /บันทึกแต้มรายเซต|readOnly/);
});

test("result form labels the original source match number", () => {
  const html = render({ ...fixture, sourceNumber: 12 });
  assert.match(html, /คู่ที่ 12/);
  assert.match(html, /โรงเรียน ก — โรงเรียน ข/);
});

test("completed results offer an explicit edit button before fields can be changed", () => {
  const html = render({
    ...fixture,
    status: "finished",
    home_score: 2,
    away_score: 1,
  });
  assert.match(html, /แก้ไขผล/);
  assert.match(
    html.match(/<input[^>]*name="home"[^>]*>/)?.[0] || "",
    /disabled=""/,
  );
  assert.doesNotMatch(html, /type="submit"/);
});
