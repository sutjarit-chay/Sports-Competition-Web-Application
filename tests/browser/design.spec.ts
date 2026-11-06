import { test, expect, type Page } from "@playwright/test";

async function seedSchools(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("kosamphi-demo-v1")) {
      localStorage.setItem(
        "kosamphi-demo-v1",
        JSON.stringify({
          schools: [{ id: "1", name: "โรงเรียนตัวอย่างทดสอบ" }],
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

test("hero actions navigate and wheel scrolling is not trapped", async ({
  page,
}) => {
  await page.goto("/");
  await useDemoAdmin(page);
  const hero = page.getByRole("region", {
    name: "นครโกสัมพีเกมส์ ปีการศึกษา 2569",
  });
  await expect(
    hero.getByRole("heading", { name: /ทุกความพยายาม/ }),
  ).toBeVisible();
  await hero.hover();
  await page.mouse.wheel(0, 650);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await hero
    .getByRole("button", { name: "ลงทะเบียนนักกีฬา", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ลงทะเบียนนักกีฬา", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("ยังไม่มีข้อมูลในรายการนี้", { exact: false }),
  ).toBeVisible();
});

test("reduced motion keeps hero content visible and disables its depth animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hero = page.getByRole("region", {
    name: "นครโกสัมพีเกมส์ ปีการศึกษา 2569",
  });
  await expect(hero).toHaveAttribute("data-motion", "reduced");
  await expect(hero.locator(".tunnel-card")).toHaveCount(0);
  await expect(hero.getByRole("heading")).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(hero.locator(".tunnel-card")).toHaveCount(9);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(hero.locator(".tunnel-card")).toHaveCount(0);
  await hero
    .getByRole("button", { name: "ดูตารางแข่งขัน", exact: true })
    .click();
  await expect(page.locator("#page-title")).toHaveText("ตารางแข่งขัน");
});

test("mobile menu exposes only viewer pages and keyboard focus is visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "เมนูทั้งหมด", exact: true }).click();
  const navigation = page.locator("#main-navigation nav");
  await expect(navigation.getByRole("button")).toHaveText([
    "ภาพรวม",
    "ตารางแข่งขัน",
    "ตารางคะแนน",
    "เหรียญรางวัล",
    "โรงเรียน / บัญชี",
  ]);
  await expect(navigation.getByRole("button", { name: "กรีฑา" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(page.locator("#page-title")).toHaveText("ตารางแข่งขัน");
  await expect(
    page.getByRole("button", { name: "เมนูทั้งหมด", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("#page-title")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() => {
      const el = document.activeElement;
      return (
        el instanceof HTMLElement &&
        getComputedStyle(el).outlineStyle !== "none"
      );
    }),
  ).toBe(true);
});

test("print keeps report content and hides the decorative hero", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "นครโกสัมพีเกมส์ ปีการศึกษา 2569" }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("region", { name: "นครโกสัมพีเกมส์ ปีการศึกษา 2569" }),
  ).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "ภาพรวม", exact: true }),
  ).toBeVisible();
});

test("saving and duplicate errors show distinct text feedback", async ({
  page,
}) => {
  await seedSchools(page);
  await page.goto("/");
  await useDemoAdmin(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page.getByLabel("ชื่อ–นามสกุล").fill("ทดสอบสถานะ");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(page.getByRole("status")).toContainText("สำเร็จ");
  await page.getByLabel("ชื่อ–นามสกุล").fill("ทดสอบสถานะ");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(page.getByRole("status")).toContainText("เกิดข้อผิดพลาด");
  await expect(page.getByRole("status")).toContainText("ข้อมูลนักกีฬาซ้ำ");
  await expect(
    page.getByRole("cell", { name: "ทดสอบสถานะ", exact: true }),
  ).toHaveCount(1);
});

test("an open mobile drawer closes when the viewport becomes desktop", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "เมนูทั้งหมด", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "เมนูหลัก" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole("dialog", { name: "เมนูหลัก" })).toHaveCount(0);
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "ตารางแข่งขัน", exact: true }).first(),
  ).toBeVisible();
});
