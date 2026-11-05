import { test, expect, type Page } from "@playwright/test";

async function seedSchools(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("kosamphi-demo-v1")) {
      localStorage.setItem(
        "kosamphi-demo-v1",
        JSON.stringify({
          schools: [{ id: "1", name: "โรงเรียนทดสอบ" }],
          athletes: [],
          matches: [],
          races: [],
          awards: [],
        }),
      );
    }
  });
}

async function useDemoAdmin(page: Page) {
  await page.getByRole("button", { name: /โปรไฟล์/ }).click();
  await page
    .getByRole("menuitemradio", { name: "ผู้ดูแลระบบ", exact: true })
    .click();
}

test("catalog and roster slots match every fixed sports category", async ({
  page,
}) => {
  await seedSchools(page);
  await page.goto("/");
  await useDemoAdmin(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  const catalog = page.getByRole("region", {
    name: "ตารางประเภทการแข่งขันและจำนวนผู้สมัคร",
  });
  await expect(catalog.getByRole("columnheader")).toHaveCount(7);
  for (const [id, starters, reserves] of [
    ["football-male", 7, 3],
    ["volleyball-male", 6, 6],
    ["volleyball-female", 6, 6],
    ["takraw-male", 3, 2],
    ["takraw-female", 3, 2],
    ["petanque-male", 3, 0],
    ["petanque-female", 3, 0],
    ["athletics-relay", 4, 4],
  ] as const) {
    await page.getByLabel("ประเภทการแข่งขัน", { exact: true }).selectOption(id);
    const form = page.getByRole("form", { name: "แบบฟอร์มรายชื่อนักกีฬา" });
    await expect(form.locator(".roster-slot")).toHaveCount(starters + reserves);
    await expect(form.getByRole("group", { name: /นักกีฬาสำรอง/ })).toHaveCount(
      reserves ? 1 : 0,
    );
    if (id.startsWith("petanque"))
      await expect(page.locator(".roster-panel")).toContainText(
        "ไม่มีการเปลี่ยนตัวระหว่างเกม",
      );
  }
});

test("full football roster is saved atomically and further names are rejected", async ({
  page,
}) => {
  await seedSchools(page);
  await page.goto("/");
  await useDemoAdmin(page);
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
  await useDemoAdmin(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "ทีมฟุตบอล 10", exact: true }),
  ).toBeVisible();
});

test("organizer reserves can be configured later and persist without touching other sports", async ({
  page,
}) => {
  await seedSchools(page);
  await page.goto("/");
  await useDemoAdmin(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page
    .getByLabel("ประเภทการแข่งขัน", { exact: true })
    .selectOption("chairball-female");
  await expect(
    page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }),
  ).toBeDisabled();
  await page
    .getByText("ตั้งค่าจำนวนสำรองและโควตา (ผู้ดูแลระบบ)", { exact: true })
    .click();
  await page.getByLabel("จำนวนสำรองตามระเบียบผู้จัด").fill("2");
  await page.getByRole("button", { name: "บันทึกกติกาการสมัคร" }).click();
  await expect(page.locator(".roster-panel .roster-slot")).toHaveCount(8);
  await page.reload();
  await useDemoAdmin(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page
    .getByLabel("ประเภทการแข่งขัน", { exact: true })
    .selectOption("chairball-female");
  await expect(page.locator(".roster-panel .roster-slot")).toHaveCount(8);
  await page
    .getByLabel("ประเภทการแข่งขัน", { exact: true })
    .selectOption("football-male");
  await expect(page.locator(".roster-panel .roster-slot")).toHaveCount(10);
});

test("individual athletics accepts multiple configured events and enforces per-event quota", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedSchools(page);
  await page.goto("/");
  await useDemoAdmin(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page
    .getByLabel("ประเภทการแข่งขัน", { exact: true })
    .selectOption("athletics-individual");
  await expect(page.locator(".athletics-choices")).toHaveCount(0);
  await page
    .getByText("ตั้งค่าจำนวนสำรองและโควตา (ผู้ดูแลระบบ)", { exact: true })
    .click();
  await page.getByLabel("โควตา วิ่ง 60 เมตร", { exact: true }).fill("1");
  await page.getByLabel("โควตา วิ่ง 100 เมตร", { exact: true }).fill("2");
  await page.getByRole("button", { name: "บันทึกกติกาการสมัคร" }).click();
  const eventPicker = page.locator(".athletics-choices");
  await expect(eventPicker).toHaveCount(1);
  await expect(eventPicker).toContainText(
    "เลือกรายการแข่งขันกรีฑาก่อนกรอกชื่อนักกีฬา",
  );
  await expect(eventPicker.locator('input[type="checkbox"]')).toHaveCount(2);
  await expect(page.locator(".roster-panel .roster-slot")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "เพิ่มช่องนักกีฬา", exact: true }),
  ).toHaveCount(0);
  expect(
    await eventPicker.evaluate((picker) =>
      picker.compareDocumentPosition(document.querySelector(".roster-group")!),
    ),
  ).toBe(4);
  await eventPicker.getByRole("checkbox", { name: /วิ่ง 60 เมตร/ }).check();
  await eventPicker.getByRole("checkbox", { name: /วิ่ง 100 เมตร/ }).check();
  await page
    .getByLabel("ชื่อ–นามสกุล", { exact: true })
    .fill("นักวิ่งหลายรายการ");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  const summary = page.getByRole("region", {
    name: "สรุปรายชื่อและสถานะการสมัคร",
  });
  await expect(summary).toContainText("วิ่ง 60 เมตร, วิ่ง 100 เมตร");
  await page
    .getByLabel("ชื่อ–นามสกุล", { exact: true })
    .fill("นักวิ่งเกินโควตา");
  await eventPicker.getByRole("checkbox", { name: /วิ่ง 60 เมตร/ }).check();
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(page.getByRole("status")).toContainText("เกินโควตา");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("oversized CSV is rejected as a whole", async ({ page }) => {
  await seedSchools(page);
  await page.goto("/");
  await useDemoAdmin(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page.getByLabel("นำเข้า CSV").setInputFiles({
    name: "oversized.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "name,school_id,sport,gender,division\n" +
        Array.from(
          { length: 11 },
          (_, i) => `นักกีฬา CSV ${i},1,ฟุตบอล,ชาย,ประถม`,
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
