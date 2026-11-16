import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchResultProgram } from "../components/match-result-program";
import type { ScheduleMatch } from "../lib/schedule-view";
const planned: ScheduleMatch = {
  id: "planned",
  competition_id: "competition",
  sport: "ฟุตบอล",
  division: "ประถมศึกษา",
  gender: "ชาย",
  pool: "A",
  home: "home",
  away: "away",
  starts_at: "",
  venue: "สนามฟุตบอล",
  status: "pending",
  fixtureOnly: true,
  sourceNumber: 1,
  competitionDate: "2026-11-16",
  sessionStart: "09:00",
  timeMode: "session",
};
const actual: ScheduleMatch = {
  ...planned,
  id: "actual",
  fixtureOnly: false,
  status: "scheduled",
  starts_at: "2026-11-16T10:00",
  referee_id: "referee",
  revision: 1,
};
function render(matches: ScheduleMatch[], admin = true) {
  return renderToStaticMarkup(
    createElement(MatchResultProgram, {
      matches,
      admin,
      profileId: "referee",
      busy: false,
      schoolName: (id: string) =>
        id === "home" ? "โรงเรียนบ้านหนองแดน" : "โรงเรียนบ้านไร่ลำปาง",
      onSave: () => {},
    }),
  );
}
test("admin sees imported programme and scheduling controls before match materialization", () => {
  const html = render([planned]);
  assert.match(html, /โรงเรียนบ้านหนองแดน/);
  assert.match(html, /โรงเรียนบ้านไร่ลำปาง/);
  assert.match(html, /กำหนดเวลา/);
  assert.match(html, /datetime-local/);
  assert.doesNotMatch(html, /ยืนยันผล/);
});
test("referee sees why planned or unassigned matches cannot accept results without acquiring edit rights", () => {
  const html = render([planned, { ...actual, referee_id: undefined }], false);
  assert.match(html, /มอบหมาย/);
  assert.match(html, /โรงเรียนบ้านหนองแดน/);
  assert.doesNotMatch(html, /datetime-local|ยืนยันผล/);
});
test("already ready matches do not duplicate score forms in the setup panel", () => {
  assert.equal(render([actual]), "");
  assert.equal(render([actual], false), "");
});
test("empty programme explains pending draw or missing schedule", () => {
  assert.match(render([]), /ยังไม่มีคู่แข่งขัน/);
  assert.doesNotMatch(render([]), /datetime-local|ยืนยันผล/);
});

test("referee without assignments receives actionable instructions instead of generic empty state", () => {
  const html = render([], false);
  assert.match(html, /ยังไม่มีคู่แข่งขันที่มอบหมายให้บัญชีนี้/);
  assert.match(html, /ผู้ดูแล/);
});
test("admin can assign existing unassigned matches from result entry", () => {
  const html = render([{ ...actual, referee_id: undefined }]);
  assert.match(html, /name="refereeId"/);
});
