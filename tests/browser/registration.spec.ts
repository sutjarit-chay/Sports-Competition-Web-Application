import { test, expect } from "@playwright/test";
import { fixture, enter, login, sid } from "./helpers/production-fixture";

test("full football roster is saved atomically and further names are rejected", async ({
  page,
}) => {
  await fixture(page);
  await enter(page);
  await login(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  const form = page.getByRole("form", { name: "แบบฟอร์มรายชื่อนักกีฬา" });
  for (let i = 0; i < 10; i++)
    await form
      .locator(i === 0 ? 'input[name="name"]' : `input[name="name_${i}"]`)
      .fill(`ทีมฟุตบอล ${i + 1}`);
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  const summary = page.getByRole("region", {
    name: "สรุปรายชื่อและสถานะการสมัคร",
  });
  await expect(summary.getByRole("row")).toHaveCount(11);
  await page.getByLabel("ชื่อ–นามสกุล", { exact: true }).fill("เกินสิบคน");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(page.getByRole("status")).toContainText("เกิน");
  await expect(summary.getByRole("row")).toHaveCount(11);
  await page.reload();

  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "ทีมฟุตบอล 10", exact: true }),
  ).toBeVisible();
});

test("oversized CSV is rejected as a whole", async ({ page }) => {
  await fixture(page);
  await enter(page);
  await login(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page.getByLabel("นำเข้า CSV").setInputFiles({
    name: "oversized.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,school_id,sport,gender,division\n" +
        Array.from(
          { length: 11 },
          (_, i) => `นักกีฬา CSV ${i},${sid},ฟุตบอล,ชาย,ประถม`,
        ).join("\n"),
    ),
  });
  await expect(page.getByRole("status")).toContainText("เกิน");
  await expect(
    page
      .getByRole("region", { name: "สรุปรายชื่อและสถานะการสมัคร" })
      .getByRole("row"),
  ).toHaveCount(1);
});

test("school individual athletics enforces the server policy per event", async ({page}) => {
  const {db,writes} = await fixture(page);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  await enter(page); await login(page,"โรงเรียน");
  await page.getByRole("button",{name:"นักกีฬา",exact:true}).click();
  await page.getByRole("combobox",{name:"รายการแข่งขัน",exact:true}).selectOption("10000000-0000-4000-8000-000000000006");
  await page.getByRole("checkbox",{name:/วิ่ง 60 เมตร/}).check();
  await page.getByRole("checkbox",{name:/วิ่ง 100 เมตร/}).check();
  await page.getByLabel("ชื่อ–นามสกุล",{exact:true}).fill("นักวิ่งหลายรายการ");
  await page.getByRole("button",{name:"+ เพิ่มนักกีฬา"}).click();
  await expect(page.getByRole("cell",{name:"นักวิ่งหลายรายการ",exact:true})).toBeVisible();
  await page.getByRole("checkbox",{name:/วิ่ง 60 เมตร/}).check();
  await page.getByLabel("ชื่อ–นามสกุล",{exact:true}).fill("เกินโควตา");
  await page.getByRole("button",{name:"+ เพิ่มนักกีฬา"}).click();
  await expect(page.getByRole("status")).toContainText("เกินโควตา");
  expect(writes.filter(w=>w.table==="registrations")).toHaveLength(1);
});
