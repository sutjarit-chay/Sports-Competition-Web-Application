import { expect, test } from "@playwright/test";
import {
  fixture,
  enter,
  football,
  sid,
  sid2,
} from "./helpers/production-fixture";
import { defaultPolicy } from "../../lib/registration";
for (const viewport of [
  { width: 1365, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`overview progress includes planned matches and scrolls inside the table at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { db } = await fixture(page);
    const id = "40000000-0000-4000-8000-000000000001";
    db.competitions[0].registration_policy = {
      ...defaultPolicy("football-male"),
      management: {
        revision: 1,
        format: "round_robin",
        teamLimit: 2,
        details: "",
        teams: [sid, sid2],
        fixtures: [
          {
            id,
            round: "A",
            home: sid,
            away: sid2,
            startsAt: "",
            venue: "สนามกลาง",
            sourceNumber: 1,
            competitionDate: "2026-11-16",
            sessionStart: "09:00",
            timeMode: "session",
          },
          {
            id: "40000000-0000-4000-8000-000000000002",
            round: "A",
            home: sid2,
            away: sid,
            startsAt: "",
            venue: "สนามกลาง",
            sourceNumber: 2,
            competitionDate: "2026-11-17",
            sessionStart: "09:00",
            timeMode: "session",
          },
        ],
      },
    };
    db.matches.push({
      id,
      competition_id: football,
      group_name: "A",
      home_school_id: sid,
      away_school_id: sid2,
      starts_at: "2026-11-16T02:00:00Z",
      venue: "สนามกลาง",
      status: "finished",
      home_score: 2,
      away_score: 1,
      revision: 1,
      referee_id: null,
    });
    await enter(page);
    const panel = page.getByRole("region", {
      name: "ความคืบหน้าการแข่งขัน",
      exact: true,
    });
    const row = panel.getByRole("row").filter({ hasText: "ฟุตบอลชาย ประถม" });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell").nth(0)).toHaveText("2");
    await expect(row.getByRole("cell").nth(1)).toHaveText("1");
    await expect(row.getByRole("cell").nth(2)).toHaveText("1");
    await expect(row.getByRole("cell").nth(3)).toContainText("คู่ที่ 2");
    await expect(row.getByRole("cell").nth(3)).toContainText(
      "โรงเรียนจริง ข พบ โรงเรียนจริง ก",
    );
    const scroll = panel.getByRole("region", {
      name: "ตารางความคืบหน้าการแข่งขัน เลื่อนแนวนอนได้",
    });
    await scroll.focus();
    await expect(scroll).toBeFocused();
    const width = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
    if (viewport.width < 768) {
      expect(
        await scroll.evaluate((el) => el.scrollWidth > el.clientWidth),
      ).toBe(true);
      await expect(
        panel.getByText("บนมือถือ เลื่อนตารางแนวนอนเพื่อดูข้อมูลครบ"),
      ).toBeVisible();
    }
  });
}
