import { test, expect, type Page } from "@playwright/test";

async function seedSchools(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("kosamphi-demo-v1")) {
      localStorage.setItem(
        "kosamphi-demo-v1",
        JSON.stringify({
          schools: [
            { id: "1", name: "โรงเรียนทดสอบ ก" },
            { id: "2", name: "โรงเรียนทดสอบ ข" },
          ],
          athletes: [],
          matches: [
            {
              id: "workflow-match",
              sport: "ฟุตบอล",
              division: "ประถม",
              gender: "ชาย",
              pool: "A",
              home: "1",
              away: "2",
              starts_at: "",
              venue: "",
              status: "scheduled",
            },
          ],
          races: [],
          awards: [],
        }),
      );
    }
  });
}

async function useDemoRole(page: Page, role: string) {
  await page.getByRole("button", { name: /โปรไฟล์/ }).click();
  await page.getByRole("menuitemradio", { name: role, exact: true }).click();
}

test("register, persist, view schedule, score and print", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (dialog) => dialog.accept());
  await seedSchools(page);
  await page.goto("/");
  await useDemoRole(page, "ผู้ดูแลระบบ");
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
  await useDemoRole(page, "ผู้ดูแลระบบ");
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "เด็กชาย ทดสอบ", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "สร้างตารางแข่งขัน" }),
  ).toHaveCount(0);
  await expect(page.locator(".spider-match-card")).toHaveCount(1);
  await expect(page.locator(".spider-match-card")).toContainText(
    "โรงเรียนทดสอบ ก",
  );
  await expect(page.locator(".spider-match-card")).toContainText(
    "โรงเรียนทดสอบ ข",
  );
  await page.getByRole("button", { name: "บันทึกผล", exact: true }).click();
  await page.getByLabel("เจ้าบ้าน").fill("2");
  await page.getByLabel("ทีมเยือน").fill("0");
  await page.getByRole("button", { name: "ยืนยันผล" }).click();
  await expect(page.getByText(/ยืนยันผลแล้ว/)).toBeVisible();
  await page.getByRole("button", { name: "ตารางคะแนน", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "โรงเรียนทดสอบ ก" }),
  ).toContainText("3");
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: "/tmp/kosamphi-report.pdf", format: "A4" });
  expect(errors).toEqual([]);
});
test("CSV import validates and school demonstration cannot score", async ({
  page,
}) => {
  await seedSchools(page);
  await page.goto("/");
  await useDemoRole(page, "ผู้ดูแลระบบ");
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
  await useDemoRole(page, "โรงเรียน");
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "สร้างตารางแข่งขัน" }),
  ).toHaveCount(0);
});
test("athletics heats advance to final and mobile has no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSchools(page);
  await page.goto("/");
  await useDemoRole(page, "ผู้ดูแลระบบ");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "เมนูทั้งหมด", exact: true }).click();
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page
    .getByRole("combobox", { name: "กีฬา", exact: true })
    .selectOption("กรีฑา");
  await page
    .getByText("ตั้งค่าจำนวนสำรองและโควตา (ผู้ดูแลระบบ)", { exact: true })
    .click();
  await page.getByLabel("โควตา วิ่ง 100 เมตร", { exact: true }).fill("2");
  await page.getByRole("button", { name: "บันทึกกติกาการสมัคร" }).click();
  await page.getByLabel("ชื่อ–นามสกุล").fill("นักวิ่ง ทดสอบ");
  await page.getByRole("checkbox", { name: /วิ่ง 100 เมตร/ }).check();
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
