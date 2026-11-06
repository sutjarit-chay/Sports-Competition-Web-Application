import { expect, test } from "@playwright/test";
import {
  fixture,
  enter,
  login,
  football,
  sid,
  sid2,
} from "./helpers/production-fixture";

test("drawing a production competition persists its program through a full reload", async ({
  page,
}) => {
  const { db } = await fixture(page);
  await enter(page);
  await login(page);
  await page
    .getByRole("button", { name: "จัดการรายการแข่งขัน", exact: true })
    .click();
  await page
    .getByRole("button", { name: "จัดสายแข่งขัน", exact: true })
    .click();
  await page.getByLabel("เลือกรายการแข่งขัน").selectOption(football);
  await page.getByLabel("ทีม 1", { exact: true }).selectOption(sid);
  await page.getByLabel("ทีม 2", { exact: true }).selectOption(sid2);
  await page
    .getByRole("button", { name: "สร้างสายและบันทึกโปรแกรม", exact: true })
    .click();
  await expect(page.locator(".admin-fixture-row")).toHaveCount(1);
  expect(db.matches).toHaveLength(0);
  const fixtureRow = page.locator(".admin-fixture-row").first();
  await fixtureRow
    .getByLabel("วันเวลา", { exact: true })
    .fill("2026-11-07T09:00");
  await fixtureRow.getByLabel("สนาม", { exact: true }).fill("สนามแข่งขันจริง");
  await fixtureRow
    .getByRole("button", { name: "บันทึกโปรแกรม", exact: true })
    .click();
  await expect.poll(() => db.matches.length).toBe(1);
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(page.locator(".spider-match-card")).toHaveCount(1);
  await expect(page.locator(".spider-match-card")).toContainText(
    "โรงเรียนจริง ก",
  );
  await page.reload();
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(page.locator(".spider-match-card")).toHaveCount(1);
  await expect(page.locator(".spider-match-card")).toContainText(
    "โรงเรียนจริง ข",
  );
});
