import { test, expect, type Page } from "@playwright/test";
import { defaultPolicy } from "../../lib/registration";
const sid = "20000000-0000-4000-8000-000000000001",
  sid2 = "20000000-0000-4000-8000-000000000002";
const football = "10000000-0000-4000-8000-000000000001",
  track = "10000000-0000-4000-8000-000000000006";
type Row = Record<string, unknown>;
async function fixture(page: Page, fail = false, rosters = false) {
  const db: Record<string, Row[]> = {
    schools: [
      { id: sid, name: "โรงเรียนจริง ก" },
      { id: sid2, name: "โรงเรียนจริง ข" },
    ],
    competitions: [
      {
        id: football,
        sport: "ฟุตบอล",
        name: "ฟุตบอล U12",
        age_group: "U12",
        gender: "ผสม",
        win_points: 2,
        draw_points: 1,
        loss_points: 0,
      },
      {
        id: track,
        sport: "กรีฑา",
        name: "กรีฑา U12",
        age_group: "U12",
        gender: "ผสม",
        win_points: 3,
        draw_points: 1,
        loss_points: 0,
      },
    ],
    registrations: [],
    matches: [],
    athletics_events: [],
    athletics_results: [],
    medals: [],
    profiles: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        role: "admin",
        school_id: null,
      },
    ],
  };
  if (rosters) {
    Object.assign(db.competitions[0], {
      gender: "ชาย",
      age_group: "ประถม",
      registration_policy: defaultPolicy("football-male"),
    });
    db.competitions[1].registration_policy = null;
  }
  const columns: Record<string, string[]> = {
    competitions: ["registration_policy"],
    schools: ["id", "name"],
    registrations: [
      "id",
      "school_id",
      "competition_id",
      "athlete_name",
      "bib",
      ...(rosters ? ["roster_details"] : []),
    ],
    matches: [
      "id",
      "competition_id",
      "group_name",
      "home_school_id",
      "away_school_id",
      "starts_at",
      "venue",
      "status",
      "home_score",
      "away_score",
      "revision",
      "referee_id",
    ],
    athletics_events: [
      "id",
      "competition_id",
      "name",
      "kind",
      "round",
      "heat",
      "direction",
      "unit",
      "starts_at",
      "venue",
      "referee_id",
    ],
    athletics_results: [
      "id",
      "event_id",
      "school_id",
      "bib",
      "value",
      "status",
    ],
    medals: ["id", "competition_id", "school_id", "award", "event_label"],
  };
  const control: { readGate?: Promise<void> } = {};
  const writes: { table: string; method: string; payload: Row[] }[] = [];
  const user = {
    id: db.profiles[0].id,
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  await page.route("**/auth/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/token")) {
      const token = [
        { alg: "HS256", typ: "JWT" },
        {
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
          role: "authenticated",
        },
        { fixture: true },
      ]
        .map((x) => Buffer.from(JSON.stringify(x)).toString("base64url"))
        .join(".");
      await route.fulfill({
        json: {
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "test-fixture-only",
          user,
        },
      });
    } else if (url.pathname.endsWith("/logout"))
      await route.fulfill({ status: 204 });
    else await route.fulfill({ json: user });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      table = url.pathname.split("/").pop()!;
    if (!(table in db)) {
      await route.fulfill({
        status: 404,
        json: { message: "Unknown table: " + table },
      });
      return;
    }
    if (fail && table === "medals") {
      await route.fulfill({
        status: 403,
        json: { message: "Fixture read denied" },
      });
      return;
    }
    let rows = db[table];
    for (const [key, value] of url.searchParams)
      if (value.startsWith("eq."))
        rows = rows.filter((r) => String(r[key]) === value.slice(3));
    if (req.method() === "GET") {
      if (table === "schools" && control.readGate) await control.readGate;
      // A small server cap intentionally exercises paginated loading.
      const offset = Number(url.searchParams.get("offset") || 0),
        limit = Math.min(Number(url.searchParams.get("limit") || 500), 1);
      const result = rows.slice(offset, offset + limit);
      await route.fulfill({
        status: 200,
        json: result,
        headers: {
          "content-range": result.length
            ? `${offset}-${offset + result.length - 1}/${rows.length}`
            : `*/${rows.length}`,
        },
      });
      return;
    }
    if (req.method() === "POST" || req.method() === "PATCH") {
      const body = req.postDataJSON(),
        payload = (Array.isArray(body) ? body : [body]) as Row[];
      for (const p of payload)
        for (const k of Object.keys(p))
          expect(columns[table], `unexpected ${table}.${k}`).toContain(k);
      writes.push({ table, method: req.method(), payload });
      if (req.method() === "POST")
        for (const row of payload)
          db[table].push({
            ...row,
            ...(table === "matches" ? { revision: 0 } : {}),
          });
      else for (const row of rows) Object.assign(row, body);
      await route.fulfill({
        status: 200,
        json: req.headers().prefer?.includes("return=representation")
          ? rows
          : [],
      });
      return;
    }
    await route.fulfill({
      status: 405,
      json: { message: "No fixture deletes" },
    });
  });
  return { db, writes, control };
}
async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /โปรไฟล์/ }).click();
  await page
    .getByRole("menuitemradio", { name: "ผู้ดูแลระบบ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
    .click();
  await page
    .getByRole("button", { name: "เข้าสู่โหมด Supabase", exact: true })
    .click();
  await expect(
    page.getByText("Supabase · ข้อมูลจริง", { exact: true }),
  ).toBeVisible();
}
async function login(page: Page, label = "ผู้ดูแลระบบ") {
  await page.getByLabel("อีเมล", { exact: true }).fill("test@example.invalid");
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("fixture-only");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page.locator(".role")).toContainText(label);
}
test("migrated school_admin roster keeps legacy registrations and persists starter metadata", async ({
  page,
}) => {
  const { db, writes } = await fixture(page, false, true);
  db.profiles[0].role = "school_admin";
  db.profiles[0].school_id = sid;
  db.registrations.push({
    id: "legacy-registration",
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
      id: "existing-registration",
      school_id: sid,
      competition_id: football,
      athlete_name: "นักกีฬาเดิม",
      bib: "101",
    });
    db.registrations.push({
      id: "track-registration",
      school_id: sid,
      competition_id: track,
      athlete_name: "นักวิ่งเดิม",
      bib: "201",
    });
    db.matches.push({
      id: "existing-match",
      competition_id: football,
      group_name: "A",
      home_school_id: sid,
      away_school_id: sid2,
      starts_at: null,
      venue: null,
      status: "scheduled",
      home_score: null,
      away_score: null,
      revision: 0,
    });
    db.athletics_events.push({
      id: "existing-event",
      competition_id: track,
      name: "วิ่ง 100 เมตร",
      kind: "track",
      round: "heat",
      heat: 1,
      direction: "asc",
      unit: "s",
    });
    db.athletics_results.push({
      id: "existing-result",
      event_id: "existing-event",
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
        `name,school_id,sport,gender,division,bib\nต่างโรงเรียน,${sid2},ฟุตบอล,ผสม,U12,102`,
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

test("hosted school profile keeps browser presentation fields after reopening", async ({
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
  await page
    .getByRole("button", { name: "นักกีฬาและครูผู้ฝึกซ้อม", exact: true })
    .click();
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
    id: "editable-athlete",
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
    id: "existing-match",
    competition_id: football,
    group_name: "A",
    home_school_id: sid,
    away_school_id: sid2,
    starts_at: null,
    venue: null,
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
  await page.getByLabel("ชื่อ–นามสกุล").fill("นักวิ่งจริง");
  await page.getByLabel("เลขประจำตัว (bib)").fill("201");
  await page.getByRole("button", { name: "+ เพิ่มนักกีฬา" }).click();
  await expect(
    page.getByRole("cell", { name: "นักวิ่งจริง", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "กรีฑา", exact: true }).click();
  await page.getByLabel("ผล (s)", { exact: true }).fill("12.5");
  await page.getByRole("button", { name: "บันทึกเวลา", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "12.5", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ส่งเข้ารอบชิง" }).click();
  await expect.poll(() => db.athletics_results.length).toBe(2);
  expect(db.athletics_events.map((e) => e.round)).toEqual(["heat", "final"]);
  expect(db.athletics_results[0]).toMatchObject({
    school_id: sid,
    bib: "201",
    value: 12.5,
  });
  expect(
    writes.some((w) => ["athletes", "races", "awards"].includes(w.table)),
  ).toBe(false);
});
test("recorder sees and submits only assigned matches without schedule controls", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  const { db } = await fixture(page);
  const refereeId = String(db.profiles[0].id);
  db.profiles[0].role = "recorder";
  db.matches.push(
    {
      id: "assigned-match",
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
      id: "unassigned-match",
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
  await page.getByRole("button", { name: "ตารางแข่งขัน", exact: true }).click();
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
test("failed hosted transition preserves demo storage and permissions", async ({
  page,
}) => {
  await fixture(page, true);
  await page.goto("/");
  await page
    .getByRole("button", { name: "โรงเรียน / บัญชี", exact: true })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("kosamphi-demo-v1"),
  );
  await page
    .getByRole("button", { name: "เข้าสู่โหมด Supabase", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Fixture read denied");
  await expect(
    page.locator(".badge").getByText("โหมดสาธิต", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("kosamphi-demo-v1")),
  ).toBe(before);
});
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
      id: "existing1",
      school_id: sid,
      competition_id: football,
      athlete_name: "นักกีฬาซ้ำชื่อ",
      bib: "101",
    },
    {
      id: "existing2",
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
      `name,school_id,sport,gender,division,bib\nนักกีฬาจาก CSV,${sid},ฟุตบอล,ผสม,U12,102`,
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
test("account transitions are locked while a live refresh is pending", async ({
  page,
}) => {
  const { control } = await fixture(page);
  await enter(page);
  await login(page);
  let release!: () => void;
  control.readGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page
    .getByRole("button", { name: "โหลดข้อมูลใหม่", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("กำลังโหลดข้อมูล");
  await expect(
    page.getByRole("button", { name: "กลับสาธิต", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "ออกจากระบบ", exact: true }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "กลับสาธิต", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "กลับสาธิต", exact: true }).click();
  await expect(
    page.locator(".badge").getByText("โหมดสาธิต", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".role")).toContainText("ผู้ชม");
});
