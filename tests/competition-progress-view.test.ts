import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CompetitionProgress from "../components/competition-progress";
const props = {
  competitions: [],
  matches: [],
  athleticsEvents: [],
  athleticsResults: [],
  schoolName: (id: string) => id,
  loading: false,
  error: false,
};
test("loading, read error and empty states never show fabricated zero totals", () => {
  for (const [extra, text] of [
    [{ loading: true }, "กำลังโหลด"],
    [{ error: true }, "โหลดความคืบหน้าไม่สำเร็จ"],
    [{}, "ยังไม่มีรายการแข่งขัน"],
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(CompetitionProgress, { ...props, ...extra }),
    );
    assert.ok(html.includes(text));
    assert.ok(!html.includes("<table"));
  }
});
test("a populated progress table exposes row headers, units and keyboard scrolling", () => {
  const html = renderToStaticMarkup(
    createElement(CompetitionProgress, {
      ...props,
      competitions: [
        {
          id: "c",
          name: "เปตองหญิง",
          sport: "เปตอง",
          gender: "หญิง",
          age_group: "ประถมศึกษา",
          win_points: 3,
          draw_points: 1,
          loss_points: 0,
        },
      ],
    }),
  );
  assert.match(html, /tabindex="0"/);
  assert.match(html, /scope="row"/);
  assert.match(html, /คงเหลือ/);
  assert.match(html, /รอจัดการแข่งขัน/);
  assert.match(html, /—/);
});
