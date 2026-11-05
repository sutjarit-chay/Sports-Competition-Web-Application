import { expect, test } from "@playwright/test";

test("drawing a demo competition updates the schedule and survives a reload", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("audit-initialized")) return;
    localStorage.setItem("audit-initialized", "yes");
    localStorage.setItem(
      "kosamphi-demo-v1",
      JSON.stringify({
        schools: [
          { id: "a", name: "โรงเรียน ก" },
          { id: "b", name: "โรงเรียน ข" },
        ],
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
          id: "manual-football",
          name: "ฟุตบอลทดสอบ",
          sport: "ฟุตบอล",
          ageGroup: "ประถม",
          gender: "ชาย",
          details: "",
          starters: 7,
          reserves: 3,
          teamLimit: 10,
          format: "round_robin",
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
    .getByRole("menuitemradio", { name: "ผู้ดูแลระบบ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "จัดการรายการแข่งขัน", exact: true })
    .click();
  await page.getByRole("tab", { name: "จัดสายแข่งขัน", exact: true }).click();
  await page.getByLabel("เลือกรายการแข่งขัน").selectOption("manual-football");
  await page.getByLabel("ทีม 1", { exact: true }).selectOption("a");
  await page.getByLabel("ทีม 2", { exact: true }).selectOption("b");
  await page
    .getByRole("button", { name: "สร้างตัวอย่างสายและโปรแกรม", exact: true })
    .click();
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(page.locator(".spider-match-card")).toHaveCount(1);
  await expect(page.locator(".spider-match-card")).toContainText("โรงเรียน ก");
  await page.reload();
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(page.locator(".spider-match-card")).toHaveCount(1);
});

test("a confirmed knockout winner advances and an already played final is protected", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    localStorage.setItem(
      "kosamphi-demo-v1",
      JSON.stringify({
        schools: [
          { id: "a", name: "โรงเรียน ก" },
          { id: "b", name: "โรงเรียน ข" },
          { id: "c", name: "โรงเรียน ค" },
        ],
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
          id: "knockout-test",
          name: "ฟุตบอลคัดออก",
          sport: "ฟุตบอล",
          ageGroup: "ประถม",
          gender: "ชาย",
          details: "",
          starters: 7,
          reserves: 3,
          teamLimit: 3,
          format: "knockout",
          winPoints: 3,
          drawPoints: 1,
          lossPoints: 0,
          teams: ["a", "b", "c"],
          fixtures: [
            {
              id: "semi",
              round: "รอบ 1",
              home: "a",
              away: "b",
              startsAt: "",
              venue: "",
            },
            {
              id: "final",
              round: "รอบชิงชนะเลิศ",
              home: "ผู้ชนะคู่ 1",
              away: "c",
              startsAt: "",
              venue: "",
            },
          ],
        },
      ]),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: /โปรไฟล์/ }).click();
  await page
    .getByRole("menuitemradio", { name: "ผู้ดูแลระบบ", exact: true })
    .click();
  await page.getByRole("button", { name: "บันทึกผล", exact: true }).click();
  const semi = page.locator(".match-form").filter({ hasText: "สาย รอบ 1" });
  await semi.getByLabel("เจ้าบ้าน", { exact: true }).fill("2");
  await semi.getByLabel("ทีมเยือน", { exact: true }).fill("0");
  await semi.getByRole("button", { name: "ยืนยันผล", exact: true }).click();
  const final = page
    .locator(".match-form")
    .filter({ hasText: "รอบชิงชนะเลิศ" });
  await expect(final).toContainText("โรงเรียน ก — โรงเรียน ค");
  await final.getByLabel("เจ้าบ้าน", { exact: true }).fill("1");
  await final.getByLabel("ทีมเยือน", { exact: true }).fill("0");
  await final.getByRole("button", { name: "ยืนยันผล", exact: true }).click();
  await expect(final).toContainText("ยืนยันผลแล้ว");
  await semi.getByLabel("เจ้าบ้าน", { exact: true }).fill("0");
  await semi.getByLabel("ทีมเยือน", { exact: true }).fill("2");
  await semi.getByRole("button", { name: "ยืนยันผล", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("รอบถัดไปยืนยันผลแล้ว");
  const results = await page.evaluate(
    () => JSON.parse(localStorage.getItem("kosamphi-demo-v1") || "{}").matches,
  );
  expect(results.find((m: { id: string }) => m.id === "semi").home_score).toBe(
    2,
  );
  expect(results.find((m: { id: string }) => m.id === "final").home).toBe("a");
});
