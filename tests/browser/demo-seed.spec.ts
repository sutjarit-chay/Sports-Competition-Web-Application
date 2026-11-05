import { expect, test } from "@playwright/test";

test("admin can seed complete sample registrations for ten demo schools", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "kosamphi-demo-v1",
      JSON.stringify({
        schools: [{ id: "school-existing", name: "โรงเรียนเดิม" }],
        athletes: [
          {
            id: "preexisting-athlete",
            name: "ข้อมูลเดิม",
            school_id: "school-existing",
            sport: "ฟุตบอล",
            gender: "ชาย",
            division: "ประถม",
          },
        ],
        matches: [],
        races: [],
        awards: [],
      }),
    );
    localStorage.setItem("kosamphi-admin-competitions-v1", "[]");
  });
  await page.goto("/");
  await page.getByRole("button", { name: /โปรไฟล์/ }).click();
  await page
    .getByRole("menuitemradio", { name: "ผู้ดูแลระบบ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "สร้างข้อมูลจำลอง 10 โรงเรียน · สมัคร จัดสาย และโปรแกรมแข่งครบทุกประเภทกีฬา",
    })
    .click();

  await expect(page.getByRole("status")).toContainText(
    "ครบ 10 โรงเรียน ทุกรายการแข่งขัน และโปรแกรมแข่ง",
  );
  const counts = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("kosamphi-demo-v1") || "{}");
    const competitions = JSON.parse(
      localStorage.getItem("kosamphi-admin-competitions-v1") || "[]",
    );
    const policies = JSON.parse(
      localStorage.getItem("kosamphi-registration-policies-v1") || "{}",
    );
    return {
      schools: state.schools.length,
      athletes: state.athletes.length,
      preservedAthlete: state.athletes.some(
        (athlete: { id: string }) => athlete.id === "preexisting-athlete",
      ),
      competitions: competitions.filter((item: { id: string }) =>
        item.id.startsWith("demo-"),
      ).length,
      matches: state.matches.length,
      fixtures: competitions
        .filter((item: { id: string }) => item.id.startsWith("demo-"))
        .reduce(
          (total: number, item: { fixtures: unknown[] }) =>
            total + item.fixtures.length,
          0,
        ),
      scheduledFixtures: competitions
        .filter((item: { id: string }) => item.id.startsWith("demo-"))
        .flatMap(
          (item: { fixtures: { startsAt: string; venue: string }[] }) =>
            item.fixtures,
        )
        .filter(
          (fixture: { startsAt: string; venue: string }) =>
            fixture.startsAt && fixture.venue,
        ).length,
      policies: Object.keys(policies).length,
      coveredRuleIds: new Set(
        state.athletes
          .map(
            (athlete: { roster?: { ruleId: string } }) =>
              athlete.roster?.ruleId,
          )
          .filter(Boolean),
      ).size,
    };
  });
  expect(counts).toEqual({
    schools: 10,
    athletes: 831,
    preservedAthlete: true,
    competitions: 11,
    matches: 495,
    fixtures: 495,
    scheduledFixtures: 495,
    policies: 11,
    coveredRuleIds: 11,
  });

  await page.evaluate(() => {
    const competitions = JSON.parse(
      localStorage.getItem("kosamphi-admin-competitions-v1") || "[]",
    );
    competitions[0].fixtures[0].startsAt = "2026-11-16T07:30";
    competitions[0].fixtures[0].venue = "สนามที่แก้ไขไว้";
    localStorage.setItem(
      "kosamphi-admin-competitions-v1",
      JSON.stringify(competitions),
    );
  });
  await page
    .getByRole("button", {
      name: "สร้างข้อมูลจำลอง 10 โรงเรียน · สมัคร จัดสาย และโปรแกรมแข่งครบทุกประเภทกีฬา",
    })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "ครบ 10 โรงเรียน ทุกรายการแข่งขัน และโปรแกรมแข่ง",
  );
  const repeatedSeed = await page.evaluate(() => {
    const competitions = JSON.parse(
      localStorage.getItem("kosamphi-admin-competitions-v1") || "[]",
    );
    const demos = competitions.filter((item: { id: string }) =>
      item.id.startsWith("demo-"),
    );
    return {
      fixtures: demos.reduce(
        (total: number, item: { fixtures: unknown[] }) =>
          total + item.fixtures.length,
        0,
      ),
      editedStart: demos[0].fixtures[0].startsAt,
      editedVenue: demos[0].fixtures[0].venue,
    };
  });
  expect(repeatedSeed).toEqual({
    fixtures: 495,
    editedStart: "2026-11-16T07:30",
    editedVenue: "สนามที่แก้ไขไว้",
  });

  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "สร้างตารางแข่งขัน" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "ผังจับคู่ รอบ 1" }),
  ).toBeVisible();
  await expect(page.locator(".schedule-bracket-game")).toHaveCount(5);
  await expect(page.locator(".spider-match-card")).toHaveCount(5);
  await expect(page.locator(".spider-match-card").first()).toContainText(
    "สนามที่แก้ไขไว้",
  );
  await page.getByRole("button", { name: "ผังพบกันหมด" }).click();
  await expect(page.getByRole("region", { name: "ผังพบกันหมด" })).toBeVisible();
  await expect(page.locator(".round-robin-matrix tbody tr")).toHaveCount(10);
  await expect(page.locator(".round-robin-matrix tbody td")).toHaveCount(100);
  await page.getByRole("button", { name: "ผังจับคู่รายรอบ" }).click();
  await page.getByRole("button", { name: /รอบ 2/ }).click();
  await expect(
    page.getByRole("img", { name: "ผังจับคู่ รอบ 2" }),
  ).toBeVisible();
  await page.locator(".filters select").first().selectOption("กรีฑา");
  await expect(page.getByLabel("เลือกรายการแข่งขันในผัง")).toBeVisible();
  await expect(page.locator(".spider-match-card")).toHaveCount(5);
  await page
    .getByLabel("เลือกรายการแข่งขันในผัง")
    .selectOption({ label: "กรีฑา วิ่งผลัด" });
  await expect(
    page.getByRole("img", { name: "ผังจับคู่ รอบ 1" }),
  ).toBeVisible();
});
