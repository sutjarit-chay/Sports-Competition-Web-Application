import { test, expect, type Page } from "@playwright/test";
import {
  fixture,
  enter,
  login,
  sid,
  sid2,
  football,
  type Row,
} from "./helpers/production-fixture";
async function schoolDocuments(page: Page) {
  const f = await fixture(page, false, true);
  const empty = {
    shortName: "",
    schoolType: "",
    logo: "",
    contactName: "",
    contactPhone: "",
    address: "",
  };
  const profiles = new Map<string, { profile: Row; version: string | null }>([
    [
      sid,
      {
        profile: {
          ...empty,
          schoolType: "ขนาดเล็ก",
          contactName: "ผู้ติดต่อ ก",
        },
        version: "a1",
      },
    ],
    [
      sid2,
      { profile: { ...empty, contactName: "ผู้ติดต่อ ข" }, version: "b1" },
    ],
  ]);
  const coaches = new Map<string, { coaches: Row[]; version: string | null }>();
  let counter = 1;
  const releases: (() => void)[] = [];
  let fail = false;
  let hold = false;
  await page.route("**/api/account-requests**", (route) =>
    route.fulfill({ json: { requests: [] } }),
  );
  await page.route("**/api/school-profile**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.searchParams.get("public") === "1") {
      await route.fulfill({
        json: {
          schools: [...profiles].map(([id, doc]) => ({
            id,
            short_name: doc.profile.shortName,
            school_type: doc.profile.schoolType,
            logo: doc.profile.logo
              ? `/api/school-profile/logo?schoolId=${id}&v=${doc.version}`
              : "",
          })),
        },
      });
      return;
    }
    const body = request.method() === "PUT" ? request.postDataJSON() : null;
    const id = String(body?.schoolId || url.searchParams.get("schoolId"));
    const doc = profiles.get(id)!;
    if (url.pathname.endsWith("/logo")) {
      const logo = String(doc.profile.logo);
      if (!logo) {
        await route.fulfill({ status: 404, body: "" });
        return;
      }
      await route.fulfill({
        body: Buffer.from(logo.split(",")[1], "base64"),
        contentType: logo.slice(5, logo.indexOf(";")),
      });
      return;
    }
    expect(request.headers().authorization).toMatch(/^Bearer /);
    if (body) {
      if (body.expectedVersion !== doc.version) {
        await route.fulfill({
          status: 409,
          json: { error: "ข้อมูลเปลี่ยนแปลงแล้ว" },
        });
        return;
      }
      if (fail) {
        fail = false;
        await route.fulfill({
          status: 503,
          json: { error: "จำลองบันทึกข้อมูลเพิ่มเติมไม่สำเร็จ" },
        });
        return;
      }
      if (hold) {
        hold = false;
        await new Promise<void>((resolve) => {
          releases.push(resolve);
        });
      }
      doc.profile = body.profile;
      doc.version = `v${++counter}`;
    }
    await route.fulfill({ json: doc });
  });
  await page.route("**/api/coaches**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const body = request.method() === "PUT" ? request.postDataJSON() : null;
    const id = String(body?.schoolId || url.searchParams.get("schoolId"));
    const competition = String(
      body?.competitionId || url.searchParams.get("competitionId"),
    );
    const key = `${id}:${competition}`;
    const doc = coaches.get(key) || { coaches: [], version: null };
    if (body) {
      expect(
        body.coaches.every(
          (row: Row) =>
            row.school_id === id && row.competition_id === competition,
        ),
      ).toBe(true);
      doc.coaches = body.coaches;
      doc.version = `c${++counter}`;
      coaches.set(key, doc);
    }
    await route.fulfill({ json: doc });
  });
  return {
    ...f,
    profiles,
    coaches,
    holdSave: () => {
      hold = true;
    },
    releaseSave: (index = 0) => releases[index]?.(),
    releaseAll: () => releases.forEach((release) => release()),
    failNextProfile: () => {
      fail = true;
    },
  };
}
for (const viewport of [
  { width: 1365, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`admin edits a pinned school's profile, logo and roster in a modal at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const f = await schoolDocuments(page);
    const athleteA = "40000000-0000-4000-8000-000000000011",
      athleteB = "40000000-0000-4000-8000-000000000012";
    f.db.registrations.push(
      {
        id: athleteA,
        competition_id: football,
        school_id: sid,
        athlete_name: "นักกีฬาของ ก",
        bib: "101",
        roster_details: {
          ruleId: "football-male",
          position: "starter",
          events: [],
        },
      },
      {
        id: athleteB,
        competition_id: football,
        school_id: sid2,
        athlete_name: "นักกีฬาของ ข",
        bib: "201",
        roster_details: {
          ruleId: "football-male",
          position: "starter",
          events: [],
        },
      },
    );
    const originalA = JSON.stringify(f.profiles.get(sid));
    await enter(page);
    if (viewport.width < 768)
      await page
        .getByRole("button", { name: "เมนูทั้งหมด", exact: true })
        .click();
    await login(page);
    await page
      .getByRole("button", { name: "แก้ไขข้อมูล โรงเรียนจริง ข", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: /จัดการโรงเรียน:/ });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByLabel("ผู้ประสานงาน", { exact: true }),
    ).toHaveValue("ผู้ติดต่อ ข");
    const newName = "โรงเรียนบ้านหนองแดน สาขาบ้านโละโคะ";
    await dialog.getByLabel("ชื่อโรงเรียน", { exact: true }).fill(newName);
    await dialog.getByLabel(/^ชื่อโรงเรียนแบบย่อ/).fill("โละโคะ");
    await dialog
      .getByRole("combobox", { name: "ประเภทโรงเรียน", exact: true })
      .selectOption("ขยายโอกาส");
    await dialog
      .getByLabel("ผู้ประสานงาน", { exact: true })
      .fill("ผู้ดูแลแก้แทน ข");
    await dialog
      .getByLabel("เบอร์โทรศัพท์", { exact: true })
      .fill("0812345678");
    await dialog
      .getByLabel("ที่อยู่", { exact: true })
      .fill("ที่อยู่ของโรงเรียน ข");
    const image = await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#b18b34";
      ctx.fillRect(0, 0, 8, 8);
      return c.toDataURL("image/png").split(",")[1];
    });
    await dialog
      .getByLabel("เลือกโลโก้โรงเรียน", { exact: true })
      .setInputFiles({
        name: "logo.png",
        mimeType: "image/png",
        buffer: Buffer.from(image, "base64"),
      });
    await expect(
      dialog.getByAltText("ตัวอย่างโลโก้โรงเรียน", { exact: true }),
    ).toBeVisible();
    f.failNextProfile();
    await dialog
      .getByRole("button", { name: "บันทึกข้อมูลโรงเรียน", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "บันทึกชื่อโรงเรียนแล้ว แต่ข้อมูลเพิ่มเติมไม่สำเร็จ",
    );
    expect(f.db.schools.find((row) => row.id === sid2)?.name).toBe(newName);
    await expect(
      dialog.getByLabel("ผู้ประสานงาน", { exact: true }),
    ).toHaveValue("ผู้ดูแลแก้แทน ข");
    f.holdSave();
    const saving = page.waitForRequest(
      (request) =>
        request.url().endsWith("/api/school-profile") &&
        request.method() === "PUT",
    );
    await dialog
      .getByRole("button", { name: "บันทึกข้อมูลโรงเรียน", exact: true })
      .click();
    await saving;
    await expect(
      dialog.getByRole("button", { name: "ปิดการจัดการโรงเรียน", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    f.releaseSave();
    await expect(
      dialog.getByText("บันทึกข้อมูลโรงเรียนแล้ว", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("heading", {
        name: `จัดการโรงเรียน: ${newName}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("ผู้ประสานงาน", { exact: true }),
    ).toHaveValue("ผู้ดูแลแก้แทน ข");
    expect(f.profiles.get(sid2)?.profile.schoolType).toBe("ขยายโอกาส");
    expect(String(f.profiles.get(sid2)?.profile.logo)).toMatch(/^data:image\//);
    expect(JSON.stringify(f.profiles.get(sid))).toBe(originalA);
    await dialog
      .getByRole("button", { name: "ปิดการจัดการโรงเรียน", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page
      .getByRole("button", { name: "แก้ไขข้อมูล โรงเรียนจริง ก", exact: true })
      .click();
    await expect(
      dialog.getByLabel("ผู้ประสานงาน", { exact: true }),
    ).toHaveValue("ผู้ติดต่อ ก");
    await expect(
      dialog.getByRole("combobox", { name: "ประเภทโรงเรียน", exact: true }),
    ).toHaveValue("ขนาดเล็ก");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page
      .getByRole("button", { name: `แก้ไขข้อมูล ${newName}`, exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "นักกีฬาและผู้ฝึกสอน", exact: true })
      .click();
    await dialog
      .getByRole("combobox", { name: "รายการแข่งขันของโรงเรียน", exact: true })
      .selectOption(football);
    await expect(
      dialog.getByText("นักกีฬาของ ข", { exact: true }).first(),
    ).toBeVisible();
    await expect(dialog.getByText("นักกีฬาของ ก", { exact: true })).toHaveCount(
      0,
    );
    await dialog
      .locator(".school-portal-roster-list article")
      .filter({ hasText: "นักกีฬาของ ข" })
      .getByRole("button", { name: "แก้ไข", exact: true })
      .click();
    const edit = dialog.locator(".school-portal-inline-form");
    await edit
      .getByLabel("ชื่อ–นามสกุล", { exact: true })
      .fill("นักกีฬาของ ข ที่แก้แล้ว");
    await edit.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect
      .poll(
        () =>
          f.db.registrations.find((row) => row.id === athleteB)?.athlete_name,
      )
      .toBe("นักกีฬาของ ข ที่แก้แล้ว");
    expect(
      f.db.registrations.find((row) => row.id === athleteA)?.athlete_name,
    ).toBe("นักกีฬาของ ก");
    await dialog
      .getByLabel("ชื่อ–นามสกุลครู/ผู้ฝึกสอน", { exact: true })
      .fill("ผู้ฝึกสอนของ ข");
    await dialog
      .getByRole("combobox", { name: "หน้าที่", exact: true })
      .selectOption("ครูผู้ฝึกสอน");
    await dialog
      .getByRole("button", { name: "บันทึกครู/ผู้ฝึกสอน", exact: true })
      .click();
    await expect(
      dialog.getByText("บันทึกครู/ผู้ฝึกสอนแล้ว", { exact: true }),
    ).toBeVisible();
    expect(f.coaches.get(`${sid2}:${football}`)?.coaches[0].school_id).toBe(
      sid2,
    );
    expect(f.coaches.get(`${sid}:${football}`)?.coaches || []).toHaveLength(0);
    const width = await dialog.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
    expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
    expect(f.db.schools.map((row) => row.id)).toEqual([sid, sid2]);
    expect(f.db.profiles[0].role).toBe("admin");
    expect(f.db.matches).toHaveLength(0);
  });
}

test("a closed editor's late save cannot unlock a newly saving school editor", async ({
  page,
}) => {
  const f = await schoolDocuments(page);
  try {
    await enter(page);
    await login(page);
    await page
      .getByRole("button", { name: "แก้ไขข้อมูล โรงเรียนจริง ก", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: /จัดการโรงเรียน:/ });
    await expect(
      dialog.getByLabel("ผู้ประสานงาน", { exact: true }),
    ).toHaveValue("ผู้ติดต่อ ก");
    await dialog
      .getByLabel("ผู้ประสานงาน", { exact: true })
      .fill("ค้างบันทึก ก");
    f.holdSave();
    const oldRequest = page.waitForRequest(
      (r) => r.url().endsWith("/api/school-profile") && r.method() === "PUT",
    );
    await dialog
      .getByRole("button", { name: "บันทึกข้อมูลโรงเรียน", exact: true })
      .click();
    await oldRequest;
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((key) =>
        key.endsWith("-auth-token"),
      )!;
      const session = JSON.parse(localStorage.getItem(key)!);
      const channel = new BroadcastChannel(key);
      channel.postMessage({ event: "TOKEN_REFRESHED", session });
      channel.close();
    });
    await expect(dialog).not.toBeVisible();
    await page
      .getByRole("button", { name: "แก้ไขข้อมูล โรงเรียนจริง ข", exact: true })
      .click();
    await expect(
      dialog.getByLabel("ผู้ประสานงาน", { exact: true }),
    ).toHaveValue("ผู้ติดต่อ ข");
    await dialog
      .getByLabel("ผู้ประสานงาน", { exact: true })
      .fill("ค้างบันทึก ข");
    f.holdSave();
    const newRequest = page.waitForRequest(
      (r) => r.url().endsWith("/api/school-profile") && r.method() === "PUT",
    );
    await dialog
      .getByRole("button", { name: "บันทึกข้อมูลโรงเรียน", exact: true })
      .click();
    await newRequest;
    const oldDone = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/school-profile") &&
        r.request().method() === "PUT" &&
        r.request().postDataJSON().schoolId === sid,
    );
    f.releaseSave(0);
    await oldDone;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(
      dialog.getByRole("button", { name: "ปิดการจัดการโรงเรียน", exact: true }),
    ).toBeDisabled();
    f.releaseSave(1);
    await expect(
      dialog.getByText("บันทึกข้อมูลโรงเรียนแล้ว", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "ปิดการจัดการโรงเรียน", exact: true }),
    ).toBeEnabled();
  } finally {
    f.releaseAll();
  }
});
