import { test, expect } from "@playwright/test";
test("register, persist, schedule, score, medal and print", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "ภาพรวม", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page.getByLabel("ชื่อ–นามสกุล").fill("เด็กชาย ทดสอบ");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(
    page.getByRole("cell", { name: "เด็กชาย ทดสอบ", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "เด็กชาย ทดสอบ", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "จัดสาย / ตารางแข่ง", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "โรงเรียน 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "โรงเรียน 2", exact: true }).check();
  await page.getByRole("button", { name: "สร้างตารางแข่งขัน" }).click();
  await expect(
    page.getByRole("cell", { name: "โรงเรียน 1 — โรงเรียน 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "บันทึกผล", exact: true }).click();
  await page.getByLabel("เจ้าบ้าน").fill("2");
  await page.getByLabel("ทีมเยือน").fill("0");
  await page.getByRole("button", { name: "ยืนยันผล" }).click();
  await expect(page.getByText("จบการแข่งขัน", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ตารางคะแนน", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "โรงเรียน 1" }),
  ).toContainText("3");
  await page.getByRole("button", { name: "เหรียญรางวัล", exact: true }).click();
  await page.getByLabel("รายการรอบชิง").fill("ฟุตบอล");
  await page.getByRole("button", { name: "เพิ่มเหรียญ" }).click();
  await expect(
    page.getByRole("cell", { name: "gold", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: "/tmp/kosamphi-report.pdf", format: "A4" });
  expect(errors).toEqual([]);
});
test("CSV import validates and school demonstration cannot score", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page.getByLabel("นำเข้า CSV").setInputFiles({
    name: "athletes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,school_id,sport,gender,division\nเด็กหญิง ตัวอย่าง,2,ฟุตบอล,ชาย,ประถม",
    ),
  });
  await expect(
    page.getByRole("cell", { name: "เด็กหญิง ตัวอย่าง", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
    .click();
  await page.getByLabel("ทดลองสิทธิ์ (เฉพาะสาธิต)").selectOption("school");
  await page
    .getByRole("button", { name: "จัดสาย / ตารางแข่ง", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "สร้างตารางแข่งขัน" }),
  ).toHaveCount(0);
});
test("athletics heats advance to final and mobile has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page
    .getByRole("combobox", { name: "กีฬา", exact: true })
    .selectOption("กรีฑา");
  await page.getByText("ตั้งค่าจำนวนสำรองและโควตา (ผู้ดูแลระบบ)", {exact:true}).click();
  await page.getByLabel("โควตา วิ่ง 100 เมตร", {exact:true}).fill("2");
  await page.getByRole("button", {name:"บันทึกกติกาการสมัคร"}).click();
  await page.getByLabel("ชื่อ–นามสกุล").fill("นักวิ่ง ทดสอบ");
  await page.getByRole("checkbox", {name:/วิ่ง 100 เมตร/}).check();
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(
    page.getByRole("cell", { name: "นักวิ่ง ทดสอบ", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "เมนูทั้งหมด", exact: true }).click();
  await page.getByRole("button", { name: "กรีฑา", exact: true }).click();
  await page.getByLabel("เวลา (วินาที)").fill("12.5");
  await page.getByRole("button", { name: "บันทึกเวลา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "12.5", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ส่งเข้ารอบชิง" }).click();
  await page
    .getByRole("combobox", { name: "รอบ", exact: true })
    .selectOption("final");
  await expect(
    page.getByRole("cell", { name: "นักวิ่ง ทดสอบ", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "DNS", exact: true }),
  ).toBeVisible();
});
