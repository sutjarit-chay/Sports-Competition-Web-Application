import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { initialState } from "../lib/domain";

// Isolated browser context only: seed demo localStorage, never hosted tables.
const sample = initialState();
sample.athletes = Array.from({ length: 48 }, (_, i) => ({
  id: `preview-athlete-${i}`,
  name: `นักกีฬาสาธิต ${i + 1}`,
  school_id: String((i % 10) + 1),
  sport: "ฟุตบอล",
  division: "ประถม",
  gender: "ชาย",
  bib: String(101 + i),
}));
sample.matches = Array.from({ length: 6 }, (_, i) => ({
  id: `preview-match-${i}`,
  sport: "ฟุตบอล",
  division: "ประถม",
  gender: "ชาย",
  pool: "A",
  home: String(i + 1),
  away: String(i + 2),
  starts_at: "2026-11-03T09:00",
  venue: "สนามกีฬาโรงเรียน",
  status: i < 4 ? "finished" : "scheduled",
  home_score: i < 4 ? 2 : undefined,
  away_score: i < 4 ? 0 : undefined,
}));
for (const [index, counts] of [
  [8, 5, 3],
  [6, 4, 5],
  [4, 6, 2],
  [3, 2, 4],
].entries()) {
  for (const [medalIndex, count] of counts.entries()) {
    for (let n = 0; n < count; n++)
      sample.awards.push({
        id: `preview-award-${index}-${medalIndex}-${n}`,
        event: "กีฬาสาธิต รอบชิง",
        division: "ประถม",
        gender: "ชาย",
        school_id: String(index + 1),
        medal: ["gold", "silver", "bronze"][medalIndex],
      });
  }
}

async function capture() {
  const output = resolve("docs/design-review");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.platform === "darwin" ? "chrome" : undefined,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const results: unknown[] = [];
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
    ["tablet", 820, 1180],
  ] as const) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(
      (data) => localStorage.setItem("kosamphi-demo-v1", JSON.stringify(data)),
      sample,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.DESIGN_PREVIEW_URL || "http://127.0.0.1:3000");
    await page
      .getByRole("button", { name: "ลงทะเบียนนักกีฬา", exact: true })
      .waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".tunnel-hero button:disabled"),
    );
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() =>
      Promise.all([...document.images].map((image) => image.decode())),
    );
    await page.screenshot({
      path: `${output}/${name}-overview.png`,
      fullPage: true,
    });
    await page.screenshot({ path: `${output}/${name}-viewport.png` });
    const tabs = [
      "นักกีฬา",
      "จัดสาย / ตารางแข่ง",
      "บันทึกผล",
      "กรีฑา",
      "ตารางคะแนน",
      "เหรียญรางวัล",
      "โรงเรียน / บัญชี",
    ];
    const overflow: string[] = [];
    for (const label of tabs) {
      // Scope to navigation: overview also has a medals shortcut.
      let control = page
        .getByRole("navigation")
        .getByRole("button", { name: label, exact: true });
      if (!(await control.isVisible())) {
        await page
          .getByRole("button", { name: "เมนูทั้งหมด", exact: true })
          .click();
        control = page
          .getByRole("navigation")
          .getByRole("button", { name: label, exact: true });
      }
      await control.click();
      if (
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        overflow.push(label);
      if (label === "นักกีฬา")
        await page.screenshot({
          path: `${output}/${name}-athletes.png`,
          fullPage: true,
        });
      if (label === "เหรียญรางวัล") {
        await page.screenshot({
          path: `${output}/${name}-medals.png`,
          fullPage: true,
        });
        if (name === "desktop") {
          await page.emulateMedia({ media: "print" });
          await page.pdf({
            path: `${output}/medals-demo.pdf`,
            format: "A4",
            landscape: true,
          });
          await page.screenshot({
            path: `${output}/desktop-print.png`,
            fullPage: true,
          });
          await page.emulateMedia({ media: "screen" });
        }
      }
    }
    results.push({ viewport: name, width, errors, overflow });
    if (errors.length || overflow.length) throw Error(JSON.stringify(results));
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

capture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
