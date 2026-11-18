import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AdminSchoolDialog from "../components/admin-school-dialog";
import AdminSchoolManager from "../components/admin-school-manager";
const school = { id: "two", name: "โรงเรียนบ้านไร่ลำปาง" };
test("school editor identifies its pinned school, exposes both sections and blocks closing while saving", () => {
  const html = renderToStaticMarkup(
    createElement(AdminSchoolDialog, {
      school,
      page: "profile",
      busy: true,
      onPageChange: () => {},
      onClose: () => {},
      children: "private editor",
    }),
  );
  assert.match(html, /จัดการโรงเรียน: โรงเรียนบ้านไร่ลำปาง/);
  assert.match(html, /ข้อมูลโรงเรียนและโลโก้/);
  assert.match(html, /นักกีฬาและผู้ฝึกสอน/);
  assert.match(html, /กำลังบันทึกข้อมูล/);
  assert.equal((html.match(/disabled=""/g) || []).length, 3);
  const closed = renderToStaticMarkup(
    createElement(AdminSchoolDialog, {
      school: null,
      page: "profile",
      busy: false,
      onPageChange: () => {},
      onClose: () => {},
      children: "private editor",
    }),
  );
  assert.doesNotMatch(closed, /private editor/);
});
test("admin school list opens full modal editing and displays current public logo and school type", () => {
  const html = renderToStaticMarkup(
    createElement(AdminSchoolManager, {
      schools: [
        {
          ...school,
          school_type: "ขยายโอกาส",
          logo: "/api/school-profile/logo?schoolId=two&v=1",
        },
      ],
      onChanged: async () => {},
      onManage: () => {},
    }),
  );
  assert.match(html, /แก้ไขข้อมูล โรงเรียนบ้านไร่ลำปาง/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /ขยายโอกาส/);
  assert.match(html, /<img/);
  assert.doesNotMatch(html, /ชื่อโรงเรียนที่แก้ไข/);
});
