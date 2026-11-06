import { test, expect } from "@playwright/test";
import {
  fixture,
  enter,
  login,
  sid,
  sid2,
  football,
  track,
  type Row,
} from "./helpers/production-fixture";
test("migrated school_admin roster keeps legacy registrations and persists starter metadata", async ({
  page,
}) => {
  const { db, writes } = await fixture(page, false, true);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  db.registrations.push({
    id: "40000000-0000-4000-8000-000000000006",
    competition_id: football,
    school_id: sid,
    athlete_name: "นักกีฬาเดิมก่อนย้าย",
    bib: "001",
    roster_details: null,
  });
  await enter(page);
  await login(page, "โรงเรียน");
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "นักกีฬาเดิมก่อนย้าย", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", {
      name: "ข้อมูลเดิม · ยังไม่ระบุตัวจริง/สำรอง",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("ชื่อ–นามสกุล", { exact: true })
    .fill("นักกีฬาตัวจริงใหม่");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(
    page.getByRole("cell", { name: "นักกีฬาตัวจริงใหม่", exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].payload[0]).toMatchObject({
    school_id: sid,
    competition_id: football,
    roster_details: {
      ruleId: "football-male",
      position: "starter",
      events: [],
    },
  });
  expect(db.registrations[0].roster_details).toBeNull();
  await expect(
    page.getByRole("form", { name: "ตั้งค่ากติกาการสมัคร" }),
  ).toHaveCount(0);
});
for (const role of ["school_admin", "school"]) {
  test(`${role} reads registrations, registers only its school and has no result/admin controls`, async ({
    page,
  }) => {
    const { db, writes } = await fixture(page);
    db.profiles[0].role = role;
    db.profiles[0].school_id = sid;
    db.registrations.push({
      id: "40000000-0000-4000-8000-000000000007",
      school_id: sid,
      competition_id: football,
      athlete_name: "นักกีฬาเดิม",
      bib: "101",
    });
    db.registrations.push({
      id: "40000000-0000-4000-8000-000000000008",
      school_id: sid,
      competition_id: track,
      athlete_name: "นักวิ่งเดิม",
      bib: "201",
    });
    db.matches.push({
      id: "40000000-0000-4000-8000-000000000001",
      competition_id: football,
      group_name: "A",
      home_school_id: sid,
      away_school_id: sid2,
      starts_at: "2026-11-07T02:00:00Z",
      venue: "สนามเดิม",
      status: "scheduled",
      home_score: null,
      away_score: null,
      revision: 0,
    });
    db.athletics_events.push({
      id: "40000000-0000-4000-8000-000000000004",
      competition_id: track,
      name: "วิ่ง 100 เมตร",
      kind: "track",
      round: "heat",
      heat: 1,
      direction: "asc",
      unit: "s",
      starts_at: "2026-11-07T02:00:00Z",
      venue: "ลู่วิ่ง",
    });
    db.athletics_results.push({
      id: "40000000-0000-4000-8000-000000000005",
      event_id: "40000000-0000-4000-8000-000000000004",
      school_id: sid,
      bib: "201",
      value: 12.5,
      status: "OK",
    });
    await enter(page);
    await login(page, "โรงเรียน");
    await expect(page.getByLabel("ทดลองสิทธิ์ (เฉพาะสาธิต)")).toHaveCount(0);
    await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "นักกีฬาเดิม", exact: true }),
    ).toBeVisible();
    await expect(page.locator('select[name="school_id"]')).toHaveCount(0);
    await page.getByLabel("ชื่อ–นามสกุล", { exact: true }).fill("นักกีฬาใหม่");
    await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
    await expect(
      page.getByRole("cell", { name: "นักกีฬาใหม่", exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      table: "registrations",
      method: "POST",
      payload: [
        {
          school_id: sid,
          competition_id: football,
          athlete_name: "นักกีฬาใหม่",
        },
      ],
    });
    await page.getByLabel("นำเข้า CSV").setInputFiles({
      name: "other-school.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        `name,school_id,sport,gender,division,bib\nต่างโรงเรียน,${sid2},ฟุตบอล,ชาย,ประถม,102`,
      ),
    });
    await expect(page.getByRole("status")).toContainText(
      "นำเข้าได้เฉพาะโรงเรียนตนเอง",
    );
    expect(writes).toHaveLength(1);
    await page
      .getByRole("button", { name: "ตารางแข่งขัน", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "สร้างตารางแข่งขัน" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "บันทึกผล", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "กรีฑา", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".spider-edit-form")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "ยืนยันผล", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "เหรียญรางวัล", exact: true })
      .click();
    await expect(page.getByRole("button", { name: "เพิ่มเหรียญ" })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "จัดการรายการแข่งขัน", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
      .click();
    await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
    await expect(page.locator(".role")).toContainText("ผู้ชม");
  });
}

test("school profile persists on the server across a full reload", async ({
  page,
}) => {
  const { db } = await fixture(page);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  await enter(page);
  await login(page, "โรงเรียน");
  await page
    .getByRole("button", { name: "ข้อมูลโรงเรียน", exact: true })
    .click();
  await page.getByLabel("ชื่อโรงเรียนแบบย่อ").fill("รร.จริง ก");
  await page
    .getByRole("button", { name: "บันทึกข้อมูลโรงเรียน", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "บันทึกข้อมูลโรงเรียนแล้ว" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".role")).toContainText("โรงเรียน");
  await page
    .getByRole("button", { name: "ข้อมูลโรงเรียน", exact: true })
    .click();
  await expect(page.getByLabel("ชื่อโรงเรียนแบบย่อ")).toHaveValue("รร.จริง ก");
});

test("school edits a migrated hosted athlete without inserting another registration", async ({
  page,
}) => {
  const { db, writes } = await fixture(page, false, true);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  db.registrations.push({
    id: "40000000-0000-4000-8000-000000000009",
    school_id: sid,
    competition_id: football,
    athlete_name: "ชื่อเดิม",
    bib: "101",
    roster_details: {
      ruleId: "football-male",
      position: "starter",
      events: [],
    },
  });
  await enter(page);
  await login(page, "โรงเรียน");
  await page
    .getByRole("button", { name: "นักกีฬาและครูผู้ฝึกซ้อม", exact: true })
    .click();
  const roster = page.locator(".school-portal-roster-list").first();
  await roster.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await roster
    .getByLabel("ชื่อ–นามสกุล", { exact: true })
    .fill("ชื่อแก้ไขแล้ว");
  await roster.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(roster).toContainText("ชื่อแก้ไขแล้ว");
  expect(db.registrations).toHaveLength(1);
  expect(writes).toMatchObject([
    {
      table: "registrations",
      method: "PATCH",
      payload: [{ athlete_name: "ชื่อแก้ไขแล้ว", bib: "101" }],
    },
  ]);
});
test("normalized hosted workflow writes only contract columns with school UUIDs and revisions", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  const { db, writes } = await fixture(page);
  db.matches.push({
    id: "40000000-0000-4000-8000-000000000001",
    competition_id: football,
    group_name: "A",
    home_school_id: sid,
    away_school_id: sid2,
    starts_at: "2026-11-07T02:00:00Z",
    venue: "สนามเดิม",
    status: "scheduled",
    home_score: null,
    away_score: null,
    revision: 0,
  });

  await enter(page);
  await login(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "รายการแข่งขัน", exact: true }),
  ).toHaveValue(football);
  await page.getByLabel("ชื่อ–นามสกุล").fill("นักกีฬาจริง");
  await page.getByLabel("เลขประจำตัว (bib)").fill("101");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(
    page.getByRole("cell", { name: "นักกีฬาจริง", exact: true }),
  ).toBeVisible();
  expect(db.registrations[0]).toMatchObject({
    school_id: sid,
    competition_id: football,
    bib: "101",
  });
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "สร้างตารางแข่งขัน" }),
  ).toHaveCount(0);
  await expect(page.locator(".spider-match-card")).toContainText(
    "โรงเรียนจริง ก",
  );
  await expect(page.locator(".spider-match-card")).toContainText(
    "โรงเรียนจริง ข",
  );
  await page
    .locator(".spider-edit-form")
    .getByLabel("วันเวลา", { exact: true })
    .fill("2026-11-03T09:00");
  await page.getByLabel("สนาม", { exact: true }).fill("สนามกลาง");
  await page.getByRole("button", { name: "บันทึกเวลา", exact: true }).click();
  await expect
    .poll(() => db.matches[0].starts_at)
    .toBe("2026-11-03T02:00:00.000Z");
  await page.getByRole("button", { name: "บันทึกผล", exact: true }).click();
  await page.getByLabel("เจ้าบ้าน").fill("2");
  await page.getByLabel("ทีมเยือน").fill("0");
  await page.getByRole("button", { name: "ยืนยันผล" }).click();
  await expect(page.getByText(/ยืนยันผลแล้ว/)).toBeVisible();
  expect(db.matches[0].revision).toBe(2);
  await page.getByRole("button", { name: "ตารางคะแนน", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "โรงเรียนจริง ก" })
      .getByRole("cell")
      .last(),
  ).toHaveText("2");
  await page.getByRole("button", { name: "เหรียญรางวัล", exact: true }).click();
  await expect(page.getByRole("button", { name: "เพิ่มเหรียญ" })).toHaveCount(
    0,
  );
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "โรงเรียนจริง ก" })
      .filter({ hasText: "ฟุตบอล" }),
  ).toContainText("ทอง");
  expect(db.medals).toHaveLength(0);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page
    .getByRole("combobox", { name: "รายการแข่งขัน", exact: true })
    .selectOption(track);
  await page.getByRole("checkbox", { name: /วิ่ง 100 เมตร/ }).check();
  await page.getByLabel("ชื่อ–นามสกุล").fill("นักวิ่งจริง");
  await page.getByLabel("เลขประจำตัว (bib)").fill("201");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(
    page.getByRole("cell", { name: "นักวิ่งจริง", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "กรีฑา", exact: true }).click();
  await page
    .getByLabel("วันเวลารายการใหม่ / รอบชิง", { exact: true })
    .fill("2026-11-07T09:00");
  await page
    .getByLabel("สนามรายการใหม่ / รอบชิง", { exact: true })
    .fill("ลู่วิ่งจริง");
  await page.getByLabel("ผล (s)", { exact: true }).fill("12.5");
  await page.getByRole("button", { name: "บันทึกเวลา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "12.5", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("วันเวลารายการใหม่ / รอบชิง", { exact: true })
    .fill("2026-11-07T15:00");
  await page.getByRole("button", { name: "ส่งเข้ารอบชิง" }).click();
  await expect.poll(() => db.athletics_results.length).toBe(2);
  expect(db.athletics_events.map((e) => e.round)).toEqual(["heat", "final"]);
  expect(db.athletics_results[0]).toMatchObject({
    school_id: sid,
    bib: "201",
    value: 12.5,
  });
  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({ format: "A4" });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(
    writes.some((w) => ["athletes", "races", "awards"].includes(w.table)),
  ).toBe(false);
});
for (const grantedRole of ["referee", "recorder"]) {
  test(`${grantedRole} sees and submits only assigned matches without schedule controls`, async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const { db } = await fixture(page);
    const refereeId = String(db.profiles[0].id);
    db.profiles[0].role = grantedRole;
    db.matches.push(
      {
        id: "40000000-0000-4000-8000-000000000002",
        competition_id: football,
        group_name: "A",
        home_school_id: sid,
        away_school_id: sid2,
        starts_at: "2026-11-05T05:30:00Z",
        venue: "สนามกลาง",
        status: "scheduled",
        home_score: null,
        away_score: null,
        revision: 0,
        referee_id: refereeId,
      },
      {
        id: "40000000-0000-4000-8000-000000000003",
        competition_id: football,
        group_name: "B",
        home_school_id: sid2,
        away_school_id: sid,
        starts_at: "2026-11-05T06:30:00Z",
        venue: "สนามอื่น",
        status: "scheduled",
        home_score: null,
        away_score: null,
        revision: 0,
        referee_id: null,
      },
    );
    await enter(page);
    await login(page, "กรรมการ");
    await page
      .getByRole("button", { name: "ตารางแข่งขัน", exact: true })
      .click();
    await expect(page.locator(".spider-match-card")).toHaveCount(1);
    await expect(page.locator(".spider-match-card")).toContainText("สนามกลาง");
    await expect(page.getByLabel("วันเวลา", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "สร้างตารางแข่งขัน" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "บันทึกผล", exact: true }).click();
    await expect(page.locator(".match-form")).toHaveCount(1);
    await expect(page.locator(".match-form")).toContainText("สนามกลาง");
    await page.getByLabel("เจ้าบ้าน").fill("3");
    await page.getByLabel("ทีมเยือน").fill("1");
    await page.getByRole("button", { name: "ยืนยันผล" }).click();
    await expect.poll(() => db.matches[0].status).toBe("finished");
    expect(db.matches[0]).toMatchObject({
      home_score: 3,
      away_score: 1,
      referee_id: refereeId,
    });
    await expect(
      page.getByRole("button", { name: "นักกีฬา", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
      .click();
    await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
    await expect(page.locator(".role")).toContainText("ผู้ชม");
  });
}
test("same athlete can register for distinct competition IDs with identical labels, including CSV", async ({
  page,
}) => {
  const { db } = await fixture(page);
  const second = "10000000-0000-4000-8000-000000000009";
  db.competitions.push({
    ...db.competitions[0],
    id: second,
    name: "ฟุตบอล รายการที่สอง",
  });
  db.registrations.push(
    {
      id: "40000000-0000-4000-8000-000000000010",
      school_id: sid,
      competition_id: football,
      athlete_name: "นักกีฬาซ้ำชื่อ",
      bib: "101",
    },
    {
      id: "40000000-0000-4000-8000-000000000011",
      school_id: sid,
      competition_id: football,
      athlete_name: "นักกีฬาจาก CSV",
      bib: "102",
    },
  );
  await enter(page);
  await login(page);
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await page
    .getByRole("combobox", { name: "รายการแข่งขัน", exact: true })
    .selectOption(second);
  await page.getByLabel("ชื่อ–นามสกุล").fill("นักกีฬาซ้ำชื่อ");
  await page.getByLabel("เลขประจำตัว (bib)").fill("101");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(
    page.getByRole("cell", { name: "นักกีฬาซ้ำชื่อ", exact: true }),
  ).toBeVisible();
  expect(
    db.registrations
      .filter((a) => a.athlete_name === "นักกีฬาซ้ำชื่อ")
      .map((a) => a.competition_id),
  ).toEqual([football, second]);
  await page.getByLabel("นำเข้า CSV").setInputFiles({
    name: "athletes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `name,school_id,sport,gender,division,bib\nนักกีฬาจาก CSV,${sid},ฟุตบอล,ชาย,ประถม,102`,
    ),
  });
  await expect(
    page.getByRole("cell", { name: "นักกีฬาจาก CSV", exact: true }),
  ).toBeVisible();
  expect(
    db.registrations
      .filter((a) => a.athlete_name === "นักกีฬาจาก CSV")
      .map((a) => a.competition_id),
  ).toEqual([football, second]);
});
test("pending username accounts stay viewers until an admin provisions their school profile", async ({
  page,
}) => {
  const { db, user, writes } = await fixture(page);
  db.profiles[0].role = "viewer";
  user.email = "fixture-user@accounts.sports-competition.invalid";
  user.app_metadata = { registration: { role: "school", status: "pending" } };
  user.user_metadata = { role: "admin", status: "approved" };
  await enter(page);
  await login(page, "ผู้ชม");
  await expect(
    page.getByRole("status").filter({ hasText: "รอผู้ดูแลระบบอนุมัติ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "นักกีฬา", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "บันทึกผล", exact: true }),
  ).toHaveCount(0);
  expect(writes).toHaveLength(0);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  await page
    .getByRole("button", { name: "โหลดข้อมูลใหม่", exact: true })
    .click();
  await expect(page.locator(".role")).toContainText("โรงเรียน");
  await expect(
    page.getByRole("button", { name: "นักกีฬา", exact: true }),
  ).toBeVisible();
});

test("rejected referee username login displays the reason and grants no scoring controls", async ({
  page,
}) => {
  const { db, user } = await fixture(page);
  db.profiles[0].role = "viewer";
  user.email = "fixture-user@accounts.sports-competition.invalid";
  user.app_metadata = {
    registration: {
      role: "referee",
      status: "rejected",
      note: "กรุณาติดต่อผู้จัด",
    },
  };
  await enter(page);
  await login(page, "ผู้ชม");
  await expect(
    page.getByRole("status").filter({ hasText: "คำขอไม่ได้รับอนุมัติ" }),
  ).toContainText("กรุณาติดต่อผู้จัด");
  await expect(
    page.getByRole("button", { name: "บันทึกผล", exact: true }),
  ).toHaveCount(0);
});

test("email login rejects a non-admin school account", async ({ page }) => {
  const { db } = await fixture(page);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  await enter(page);
  await page
    .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
    .click();
  await page
    .getByRole("button", { name: "ผู้ดูแลระบบ (อีเมล)", exact: true })
    .click();
  await page.getByLabel("อีเมล", { exact: true }).fill("test@example.invalid");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator(".account-login").getByRole("alert")).toContainText(
    "สำหรับผู้ดูแลระบบเท่านั้น",
  );
  await expect(page.locator(".role")).toContainText("ผู้ชม");
});

test("admin reviews school and referee requests from the same queue", async ({
  page,
}) => {
  const { db } = await fixture(page);
  const requests = [
    {
      id: "50000000-0000-4000-8000-000000000001",
      kind: "school",
      username: "school01",
      fullName: "ผู้ประสานงาน",
      schoolName: "โรงเรียนรออนุมัติ",
      phone: "0812345678",
      createdAt: "2026-11-06T00:00:00Z",
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      kind: "referee",
      username: "referee01",
      fullName: "กรรมการรออนุมัติ",
      schoolName: "",
      phone: "",
      createdAt: "2026-11-06T00:01:00Z",
    },
  ];
  const reviewed: Row[] = [];
  await page.route("**/api/account-requests", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    if (route.request().method() === "GET")
      await route.fulfill({ json: { requests } });
    else {
      const body = route.request().postDataJSON();
      reviewed.push(body);
      await route.fulfill({ json: { status: body.decision } });
    }
  });
  page.on("dialog", (dialog) => dialog.accept());
  await enter(page);
  await login(page);
  await page
    .getByRole("button", { name: "โหลดคำขอที่รอตรวจสอบ", exact: true })
    .click();
  const queue = page.locator(".account-approvals");
  await expect(queue.locator(".school-request")).toHaveCount(2);
  await queue
    .getByRole("button", { name: "อนุมัติและสร้างโรงเรียน", exact: true })
    .click();
  await expect(queue.locator(".school-request")).toHaveCount(1);
  await queue
    .getByRole("button", { name: "อนุมัติกรรมการ", exact: true })
    .click();
  await expect(queue.locator(".school-request")).toHaveCount(0);
  expect(reviewed.map((r) => [r.kind, r.decision])).toEqual([
    ["school", "approved"],
    ["referee", "approved"],
  ]);
  expect(db.profiles[0].role).toBe("admin");
});

test("private coaches are saved with authorization and survive a reload", async ({
  page,
}) => {
  const { db } = await fixture(page);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  await enter(page);
  await login(page, "โรงเรียน");
  await page
    .getByRole("button", { name: "นักกีฬาและครูผู้ฝึกซ้อม", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "บันทึกครู/ผู้ฝึกสอน", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("ชื่อ–นามสกุลครู/ผู้ฝึกสอน", { exact: true })
    .fill("ครูข้อมูลจริง");
  await page
    .locator('select[name="staff-title"]')
    .selectOption({ label: "ครูผู้ฝึกสอน" });
  await page
    .getByRole("button", { name: "บันทึกครู/ผู้ฝึกสอน", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "บันทึกครู/ผู้ฝึกสอนแล้ว" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".role")).toContainText("โรงเรียน");
  await page
    .getByRole("button", { name: "นักกีฬาและครูผู้ฝึกซ้อม", exact: true })
    .click();
  await expect(
    page
      .locator(".school-portal-roster-list")
      .filter({ hasText: "ครูข้อมูลจริง" }),
  ).toBeVisible();
});

test("unmatched legacy competition remains readable without silently rewriting its athletes", async ({
  page,
}) => {
  const { db, writes } = await fixture(page);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  Object.assign(db.competitions[0], {
    name: "รายการเดิม U12",
    age_group: "U12",
    gender: "ผสม",
    registration_policy: null,
  });
  db.registrations.push({
    id: "70000000-0000-4000-8000-000000000001",
    competition_id: football,
    school_id: sid,
    athlete_name: "รายชื่อก่อนเปลี่ยนระเบียบ",
    bib: "001",
    roster_details: null,
  });
  await enter(page);
  await login(page, "โรงเรียน");
  await page.getByRole("button", { name: "นักกีฬา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "รายชื่อก่อนเปลี่ยนระเบียบ", exact: true }),
  ).toBeVisible();
  expect(db.registrations[0].roster_details).toBeNull();
  expect(writes).toHaveLength(0);
});
