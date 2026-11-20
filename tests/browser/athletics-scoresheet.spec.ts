import { expect, test } from "@playwright/test";
import {
  INITIAL_ATHLETICS_DATA,
  type AthleticsRow,
} from "../../lib/athletics-scoresheet-model";
import { enter, fixture, login, sid, sid2 } from "./helpers/production-fixture";

const cloneRows = (): AthleticsRow[] => structuredClone(INITIAL_ATHLETICS_DATA);

test("empty Supabase scoresheet ignores stale device-local athletics data", async ({
  page,
}) => {
  await page.addInitScript((staleRows) => {
    localStorage.setItem("nkg2569_athletics_preview", JSON.stringify(staleRows));
  }, (() => {
    const staleRows = cloneRows();
    staleRows[0].r3Lanes[0] = {
      ...staleRows[0].r3Lanes[0],
      schoolName: "โรงเรียนบ้านหนองแดน",
      athleteName: "ข้อมูลเฉพาะเครื่องเก่า",
    };
    staleRows[0].r3[0] = "โรงเรียนบ้านหนองแดน";
    return staleRows;
  })());
  await fixture(page);
  await page.route("**/api/athletics-scoresheet", async (route) => {
    await route.fulfill({ json: { rows: cloneRows(), version: null } });
  });

  await enter(page);
  await login(page);
  await page.getByRole("button", { name: "กรีฑา", exact: true }).click();

  const panel = page.getByRole("region", {
    name: "หน้าลงทะเบียนและจัดลู่วิ่งกรีฑา",
  });
  await expect(panel.locator("tbody select").first()).toHaveValue("");
  await expect(
    panel.getByPlaceholder("ชื่อ-สกุล นักกีฬา (ถ้ามี)").first(),
  ).toHaveValue("");
  await expect(page.getByText(/บันทึกในเครื่อง|โหมดบันทึกในเครื่อง/)).toHaveCount(0);
});

test("stale athletics save merges unrelated edits and latest Supabase wins the same field", async ({
  page,
}) => {
  await fixture(page);
  let rows = cloneRows();
  let version = "version-1";
  let putCount = 0;
  let getCount = 0;
  let latestSchool = "";
  const putBodies: Array<{
    rows: AthleticsRow[];
    expectedVersion: string | null;
  }> = [];

  await page.route("**/api/athletics-scoresheet", async (route) => {
    if (route.request().method() === "GET") {
      getCount += 1;
      await route.fulfill({ json: { rows, version } });
      return;
    }
    putCount += 1;
    const body = route.request().postDataJSON();
    putBodies.push(body);
    if (putCount === 1) {
      rows = cloneRows();
      rows[0].r3Lanes[0] = {
        ...rows[0].r3Lanes[0],
        schoolName: latestSchool,
        athleteName: "ข้อมูลล่าสุดจากกรรมการอีกคน",
      };
      rows[0].r3[0] = latestSchool;
      version = "version-2";
      await route.fulfill({
        status: 409,
        json: { error: "ข้อมูลเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดข้อมูลล่าสุด" },
      });
      return;
    }
    rows = structuredClone(body.rows);
    version = "version-3";
    await route.fulfill({ json: { ok: true, rows, version } });
  });

  await enter(page);
  await login(page);
  await page.getByRole("button", { name: "กรีฑา", exact: true }).click();

  const panel = page.getByRole("region", {
    name: "หน้าลงทะเบียนและจัดลู่วิ่งกรีฑา",
  });
  const schoolSelect = panel.locator("tbody select").first();
  const staleSchool = await schoolSelect
    .locator("option")
    .nth(1)
    .getAttribute("value");
  latestSchool =
    (await schoolSelect.locator("option").nth(2).getAttribute("value")) || "";
  expect(staleSchool).toBeTruthy();
  expect(latestSchool).toBeTruthy();
  await schoolSelect.selectOption(staleSchool!);
  await panel
    .getByPlaceholder("ชื่อ-สกุล นักกีฬา (ถ้ามี)")
    .first()
    .fill("ข้อมูลที่ล้าสมัย");
  await panel
    .getByPlaceholder("ชื่อ-สกุล นักกีฬา (ถ้ามี)")
    .nth(1)
    .fill("ข้อมูลอีกลู่จากเครื่องนี้");
  await panel
    .getByRole("button", { name: "บันทึก", exact: true })
    .first()
    .click();

  await expect(page.getByText("✓ ซิงค์ Supabase แล้ว", { exact: true })).toBeVisible();
  await expect(schoolSelect).toHaveValue(latestSchool);
  await expect(
    panel.getByPlaceholder("ชื่อ-สกุล นักกีฬา (ถ้ามี)").first(),
  ).toHaveValue("ข้อมูลล่าสุดจากกรรมการอีกคน");
  await expect(
    panel.getByPlaceholder("ชื่อ-สกุล นักกีฬา (ถ้ามี)").nth(1),
  ).toHaveValue("ข้อมูลอีกลู่จากเครื่องนี้");
  expect(putCount).toBe(2);
  expect(putBodies[1].expectedVersion).toBe("version-2");
  expect(putBodies[1].rows[0].r3Lanes[0].schoolName).toBe(latestSchool);
  expect(putBodies[1].rows[0].r3Lanes[0].athleteName).toBe(
    "ข้อมูลล่าสุดจากกรรมการอีกคน",
  );
  expect(putBodies[1].rows[0].r3Lanes[1].athleteName).toBe(
    "ข้อมูลอีกลู่จากเครื่องนี้",
  );
  expect(getCount).toBeGreaterThanOrEqual(2);
});

test("viewer can inspect athletics scoresheets but cannot edit or save", async ({
  page,
}) => {
  const { db } = await fixture(page);
  db.profiles[0].role = "viewer";
  await page.route("**/api/athletics-scoresheet", async (route) => {
    await route.fulfill({ json: { rows: cloneRows(), version: "version-1" } });
  });
  await enter(page);
  await login(page, "ผู้ชม");
  await page.getByRole("button", { name: "กรีฑา", exact: true }).click();
  await expect(
    page.getByText("👁️ โหมดผู้ชม (อ่านอย่างเดียว)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "บันทึก", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "หน้าลงทะเบียนและจัดลู่วิ่งกรีฑา" })
      .locator("tbody select")
      .first(),
  ).toBeDisabled();
});

test("edits made during an in-flight save are queued and never rolled back by the older response", async ({
  page,
}) => {
  await fixture(page);
  let rows = cloneRows();
  let version = "version-1";
  const putBodies: Array<{ rows: AthleticsRow[]; expectedVersion: string | null }> = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  await page.route("**/api/athletics-scoresheet", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { rows, version } });
      return;
    }
    const body = route.request().postDataJSON();
    putBodies.push(body);
    if (putBodies.length === 1) await firstGate;
    expect(body.expectedVersion).toBe(version);
    rows = structuredClone(body.rows);
    version = `version-${putBodies.length + 1}`;
    await route.fulfill({ json: { ok: true, rows, version } });
  });

  await enter(page);
  await login(page);
  await page.getByRole("button", { name: "กรีฑา", exact: true }).click();
  const panel = page.getByRole("region", {
    name: "หน้าลงทะเบียนและจัดลู่วิ่งกรีฑา",
  });
  const schoolSelect = panel.locator("tbody select").first();
  const school = await schoolSelect.locator("option").nth(1).getAttribute("value");
  await schoolSelect.selectOption(school!);
  await panel
    .getByRole("button", { name: "บันทึก", exact: true })
    .first()
    .click();
  await expect.poll(() => putBodies.length).toBe(1);

  await panel
    .getByPlaceholder("ชื่อ-สกุล นักกีฬา (ถ้ามี)")
    .nth(1)
    .fill("แก้ไขระหว่างรอบันทึก");
  await page.waitForTimeout(900);
  expect(putBodies).toHaveLength(1);

  releaseFirst();
  await expect.poll(() => putBodies.length).toBe(2);
  expect(putBodies[1].expectedVersion).toBe("version-2");
  expect(putBodies[1].rows[0].r3Lanes[1].athleteName).toBe(
    "แก้ไขระหว่างรอบันทึก",
  );
  await expect(
    panel.getByPlaceholder("ชื่อ-สกุล นักกีฬา (ถ้ามี)").nth(1),
  ).toHaveValue("แก้ไขระหว่างรอบันทึก");
});
