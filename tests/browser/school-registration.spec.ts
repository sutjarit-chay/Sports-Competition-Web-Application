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

test("viewer is the default and demo users can switch directly between roles", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".role")).toContainText("ผู้ชม");
  await expect(page.locator(".profile-avatar")).toBeVisible();
  await page.getByRole("button", { name: /โปรไฟล์/ }).click();
  await page
    .getByRole("menuitemradio", { name: "โรงเรียน", exact: true })
    .click();

  await expect(page.locator(".role")).toContainText("โรงเรียน");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "ข้อมูลโรงเรียน", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /โปรไฟล์ โรงเรียน/ }),
  ).toBeVisible();

  for (const [label, expected] of [
    ["ผู้ดูแลระบบ", "ผู้ดูแลระบบ"],
    ["กรรมการ", "กรรมการ"],
    ["ผู้ชม", "ผู้ชม"],
  ]) {
    await page.getByRole("button", { name: /โปรไฟล์/ }).click();
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
    await expect(page.locator(".role")).toContainText(expected);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  const viewerNavigation = page.locator('nav[aria-label="การจัดการแข่งขัน"]');
  await expect(viewerNavigation.getByRole("button")).toHaveText([
    "ภาพรวม",
    "ตารางแข่งขัน",
    "ตารางคะแนน",
    "เหรียญรางวัล",
    "โรงเรียน / บัญชี",
  ]);
  await expect(
    viewerNavigation.getByRole("button", { name: "นักกีฬา", exact: true }),
  ).toHaveCount(0);
});

test("school registers athletes and coach together after selecting a competition", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "kosamphi-demo-v1",
      JSON.stringify({
        schools: [{ id: "school-1", name: "โรงเรียนทดสอบ" }],
        athletes: [],
        matches: [],
        races: [],
        awards: [],
      }),
    );
    localStorage.setItem(
      "kosamphi-admin-competitions-v1",
      JSON.stringify([
        {
          id: "football-comp",
          name: "ฟุตบอลชาย",
          sport: "ฟุตบอล",
          ageGroup: "ประถม",
          gender: "ชาย",
          details: "",
          starters: 7,
          reserves: 3,
          teamLimit: 10,
          format: "knockout",
          winPoints: 3,
          drawPoints: 1,
          lossPoints: 0,
          teams: [],
          fixtures: [],
        },
      ]),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: /โปรไฟล์/ }).click();
  await page
    .getByRole("menuitemradio", { name: "โรงเรียน", exact: true })
    .click();
  await page
    .getByRole("button", { name: "นักกีฬาและครูผู้ฝึกซ้อม", exact: true })
    .click();

  const competition = page.getByRole("combobox", {
    name: "รายการแข่งขันของโรงเรียน",
  });
  await expect(competition).toHaveValue("football-comp");
  await expect(page.locator('select[name="school_id"]')).toHaveCount(0);
  await competition.selectOption("football-comp");
  const athleteForm = page.getByRole("form", {
    name: "แบบฟอร์มรายชื่อนักกีฬา",
  });
  const athleteSlots = athleteForm.locator(".roster-group").last();
  const coachSection = athleteForm.locator(".school-portal-registration-staff");
  await expect(coachSection).toBeVisible();
  const athleteBox = await athleteSlots.boundingBox();
  const coachBox = await coachSection.boundingBox();
  expect(athleteBox).not.toBeNull();
  expect(coachBox).not.toBeNull();
  expect(coachBox!.y).toBeGreaterThan(athleteBox!.y + athleteBox!.height);
  expect(coachBox!.width).toBeGreaterThan(athleteBox!.width * 0.9);
  await page.getByLabel("ชื่อ–นามสกุล", { exact: true }).fill("นักกีฬาทดสอบ");
  await page
    .getByLabel("ชื่อ–นามสกุลครู/ผู้ฝึกสอน", { exact: true })
    .fill("ครูทดสอบ");
  await page.locator('select[name="staff-title"]').selectOption({
    label: "ครูผู้ฝึกสอน",
  });
  await page.getByRole("button", { name: "ลงทะเบียน", exact: true }).click();

  await expect(
    page
      .locator(".school-portal-roster-section")
      .nth(0)
      .locator("article")
      .filter({ hasText: "นักกีฬาทดสอบ" }),
  ).toBeVisible();
  await expect(
    page
      .locator(".school-portal-roster-section")
      .nth(1)
      .locator("article")
      .filter({ hasText: "ครูทดสอบ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "เพิ่มผู้ฝึกสอน", exact: true }),
  ).toHaveCount(0);
});
