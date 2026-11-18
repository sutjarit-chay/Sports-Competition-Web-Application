import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MedalStandingsTable,
  SchoolMedalDialog,
} from "../components/school-medal-details";
const school = { id: "one", name: "โรงเรียนบ้านหนองแดน" };
test("medal standings retain row semantics and expose a native keyboard button for details", () => {
  const html = renderToStaticMarkup(
    createElement(MedalStandingsTable, {
      rows: [{ school: school.id, gold: 2, silver: 1, bronze: 0 }],
      schoolName: () => school.name,
      onSelect: () => {},
    }),
  );
  assert.match(html, /scope="row"/);
  assert.match(html, /type="button"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /ดูรายการเหรียญของ โรงเรียนบ้านหนองแดน/);
});
test("dialog has a labelled close button and does not reveal another school's awards", () => {
  const html = renderToStaticMarkup(
    createElement(SchoolMedalDialog, {
      school,
      awards: [
        {
          id: "a",
          event: "วิ่ง 60 เมตร",
          division: "ป.1–3",
          gender: "ชาย",
          medal: "gold",
          school_id: "one",
        },
        {
          id: "other",
          event: "รายการของโรงเรียนอื่น",
          division: "มัธยม",
          gender: "หญิง",
          medal: "silver",
          school_id: "two",
        },
      ],
      competitionName: () => "",
      onClose: () => {},
    }),
  );
  assert.match(html, /ปิดรายละเอียดเหรียญ/);
  assert.match(html, /วิ่ง 60 เมตร/);
  assert.match(html, /รวม 1 เหรียญ/);
  assert.doesNotMatch(html, /รายการของโรงเรียนอื่น/);
});
