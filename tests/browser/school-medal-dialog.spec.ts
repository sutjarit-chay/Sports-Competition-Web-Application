import { expect, test } from "@playwright/test";
import {
  fixture,
  enter,
  football,
  sid,
  sid2,
} from "./helpers/production-fixture";
for (const viewport of [
  { width: 1365, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`school medal rows open scoped details with totals, focus and dismissal at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { db, writes } = await fixture(page);
    const volleyball = "10000000-0000-4000-8000-000000000009";
    db.competitions.push({
      ...db.competitions[0],
      id: volleyball,
      name: "วอลเลย์บอลหญิง มัธยมศึกษา",
      sport: "วอลเลย์บอล",
      age_group: "มัธยมศึกษา",
      gender: "หญิง",
    });
    const base = {
      group_name: "รอบชิงชนะเลิศ",
      starts_at: "2026-11-18T02:00:00Z",
      venue: "สนามกลาง",
      status: "finished",
      revision: 1,
      referee_id: null,
    };
    db.matches.push(
      {
        ...base,
        id: "40000000-0000-4000-8000-000000000001",
        competition_id: football,
        home_school_id: sid,
        away_school_id: sid2,
        home_score: 3,
        away_score: 1,
      },
      {
        ...base,
        id: "40000000-0000-4000-8000-000000000002",
        competition_id: volleyball,
        home_school_id: sid2,
        away_school_id: sid,
        home_score: 2,
        away_score: 0,
      },
    );
    await enter(page);
    await page
      .getByRole("button", { name: "เหรียญรางวัล", exact: true })
      .last()
      .click();
    const standings = page.locator(".school-medal-standings").first();
    const trigger = standings.getByRole("button", {
      name: "ดูรายการเหรียญของ โรงเรียนจริง ก",
      exact: true,
    });
    const row = standings
      .getByRole("row")
      .filter({ hasText: "โรงเรียนจริง ก" });
    await expect(row.getByRole("cell").last()).toHaveText("2");
    await row.getByRole("cell").last().click();
    const dialog = page.getByRole("dialog", {
      name: "รายการเหรียญของ โรงเรียนจริง ก",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".school-medal-summary")).toContainText(
      "รวม 2 เหรียญ",
    );
    const detailRows = dialog.locator("tbody tr");
    await expect(detailRows).toHaveCount(2);
    await expect(detailRows.nth(0)).toContainText("ฟุตบอลชาย ประถม");
    await expect(detailRows.nth(0)).toContainText("🥇 ทอง");
    await expect(detailRows.nth(1)).toContainText("วอลเลย์บอลหญิง มัธยมศึกษา");
    await expect(detailRows.nth(1)).toContainText("🥈 เงิน");
    await expect(
      dialog.getByRole("button", { name: "ปิดรายละเอียดเหรียญ", exact: true }),
    ).toBeFocused();
    const dimensions = await dialog.evaluate((el) => ({
      width: el.scrollWidth,
      client: el.clientWidth,
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      center:
        el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2,
    }));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.client + 1);
    expect(
      Math.abs(dimensions.center - dimensions.viewport / 2),
    ).toBeLessThanOrEqual(2);
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("button", { name: "ปิดรายละเอียดเหรียญ", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await trigger.press("Enter");
    await expect(dialog).toBeVisible();
    await page.mouse.click(0, 0);
    await expect(dialog).not.toBeVisible();
    expect(writes).toHaveLength(0);
  });
}
