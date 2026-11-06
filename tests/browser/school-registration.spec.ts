import { test, expect } from "@playwright/test";

test("school registration sends a username-only request after confirmation", async ({
  page,
}) => {
  const submitted: Record<string, unknown>[] = [];
  await page.route("**/api/school-account", async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({
      json: { account: { status: "pending", role: "school" } },
    });
  });
  await page.goto("/school-registration");
  await page.getByLabel("ชื่อโรงเรียน", { exact: true }).fill("โรงเรียนทดสอบ");
  await page.getByLabel("โรงเรียนขยายโอกาส").check();
  await page
    .getByLabel("ชื่อผู้บริหาร / ผู้ประสานงาน", { exact: true })
    .fill("ผู้บริหารทดสอบ");
  await page.getByLabel("ชื่อบัญชี", { exact: true }).fill("test-school");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("test-password-123");
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "ตรวจสอบข้อมูล", exact: true })
    .click();
  await expect(page.locator(".registration-preview")).toContainText(
    "โรงเรียนทดสอบ",
  );
  expect(submitted).toHaveLength(0);
  await page.getByRole("button", { name: "ส่งคำขอสมัคร", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("รอผู้ดูแลระบบอนุมัติ");
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({
    mode: "register",
    role: "school",
    username: "test-school",
    fullName: "ผู้บริหารทดสอบ",
    schoolName: "โรงเรียนทดสอบ",
  });
  expect(submitted[0]).not.toHaveProperty("email");
});

test("referees can register without a school or email and receive pending status", async ({
  page,
}) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/school-account", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      json: { account: { status: "pending", role: "referee" } },
    });
  });
  await page.goto("/school-registration");
  await page.getByLabel("กรรมการ", { exact: true }).check();
  await expect(page.getByLabel("ชื่อโรงเรียน", { exact: true })).toHaveCount(0);
  await page.getByLabel("ชื่อ–นามสกุล", { exact: true }).fill("กรรมการทดสอบ");
  await page.getByLabel("ชื่อบัญชี", { exact: true }).fill("referee-test");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("test-password-123");
  await page
    .getByRole("button", { name: "ตรวจสอบข้อมูล", exact: true })
    .click();
  await page.getByRole("button", { name: "ส่งคำขอสมัคร", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("รอผู้ดูแลระบบอนุมัติ");
  expect(submitted).toMatchObject({
    role: "referee",
    username: "referee-test",
    fullName: "กรรมการทดสอบ",
  });
});
