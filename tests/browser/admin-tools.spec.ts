import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { fixture, enter, login, sid, sid2 } from "./helpers/production-fixture";
async function tools(page: Parameters<typeof fixture>[0]) {
  const f = await fixture(page);
  const account = {
    id: "30000000-0000-4000-8000-000000000009",
    username: "school.old",
    displayName: "ครูโรงเรียน",
    role: "school_admin",
    schoolId: sid,
  };
  const actions: Record<string, unknown>[] = [];
  await page.route("**/api/admin-accounts", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      actions.push(body);
      if (body.action === "username") account.username = body.username;
      if (body.action === "school") account.schoolId = body.schoolId;
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: { accounts: [account] } });
  });
  await page.route("**/api/admin-schools**", async (route) => {
    if (route.request().method() === "DELETE") {
      const body = route.request().postDataJSON();
      actions.push(body);
      f.db.schools = f.db.schools.filter((s) => s.id !== body.schoolId);
      await route.fulfill({ json: { ok: true, retainedProfileFiles: 0 } });
    } else {
      const id = new URL(route.request().url()).searchParams.get("schoolId");
      const school = f.db.schools.find((s) => s.id === id)!;
      await route.fulfill({
        json: {
          preview: {
            schoolId: id,
            name: school.name,
            dependencies: { accounts: id === sid ? 1 : 0 },
            canDelete: id !== sid,
            fingerprint: "school-preview",
          },
        },
      });
    }
  });
  let job: Record<string, unknown> | null = null;
  const backupBytes = Buffer.from(
    JSON.stringify([
      {
        table: "registrations",
        row: { id: "fixture", athlete_name: "นักกีฬาเดิม" },
      },
    ]),
  );
  const boundary = backupBytes.indexOf(Buffer.from("น")) + 1;
  const backupParts = [
    backupBytes.subarray(0, boundary),
    backupBytes.subarray(boundary),
  ];
  const backup = {
    id: "80000000-0000-4000-8000-000000000001",
    parts: 2,
    sha256: createHash("sha256").update(backupBytes).digest("hex"),
    createdAt: "2026-11-06T00:00:00Z",
  };
  await page.route("**/api/competition-reset**", async (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.has("archiveId")) {
      await route.fulfill({
        json:
          u.searchParams.get("part") === "manifest"
            ? backup
            : {
                encoding: "base64-json",
                data: backupParts[Number(u.searchParams.get("part"))].toString(
                  "base64",
                ),
              },
      });
      return;
    }
    if (u.searchParams.has("archives")) {
      await route.fulfill({ json: { archives: [backup], nextOffset: null } });
      return;
    }
    if (route.request().method() === "POST") {
      const b = route.request().postDataJSON();
      actions.push(b);
      if (b.action === "start")
        job = {
          id: backup.id,
          status: "clearing",
          processed: 0,
          total: 3,
          manifest: backup.id,
        };
      if (b.action === "step") {
        f.db.registrations = [];
        f.db.matches = [];
        f.db.athletics_events = [];
        f.db.athletics_results = [];
        f.db.medals = [];
        job = { ...job, status: "complete", processed: 3 };
      }
      await route.fulfill({ json: { job } });
    } else
      await route.fulfill({
        json: {
          preview: {
            counts: { registrations: 1, matches: 1, medals: 1 },
            fingerprint: "reset-preview",
          },
          job,
        },
      });
  });
  return {
    ...f,
    actions,
    account,
    setJob: (value: Record<string, unknown>) => {
      job = value;
    },
  };
}
test("admin sees usernames and can set a new password without reading any current password", async ({
  page,
}) => {
  const f = await tools(page);
  await enter(page);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "จัดการบัญชีโรงเรียนและกรรมการ" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "จัดการบัญชี school.old" }).click();
  await page
    .getByLabel("ชื่อบัญชีใหม่", { exact: true })
    .fill("school.updated");
  await page
    .getByRole("button", { name: "บันทึกชื่อบัญชี", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "school.updated", exact: true }),
  ).toBeVisible();
  await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill("Temporary12345");
  await page
    .getByRole("button", { name: "แสดงรหัสผ่านใหม่", exact: true })
    .click();
  await expect(
    page.getByLabel("รหัสผ่านใหม่", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "ตั้งรหัสผ่านใหม่", exact: true })
    .click();
  await expect(page.getByLabel("รหัสผ่านใหม่", { exact: true })).toHaveValue(
    "",
  );
  expect(f.actions).toContainEqual({
    action: "password",
    userId: f.account.id,
    password: "Temporary12345",
  });
  await expect(
    page.getByText("ดูรหัสผ่านเดิมไม่ได้", { exact: false }),
  ).toBeVisible();
});
test("school removal previews dependencies and requires exact name confirmation", async ({
  page,
}) => {
  const f = await tools(page);
  await enter(page);
  await login(page);
  await page
    .getByRole("button", { name: "ตรวจสอบการลบ โรงเรียนจริง ก" })
    .click();
  await expect(
    page.getByText("ยังลบโรงเรียนนี้ไม่ได้", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "ตรวจสอบการลบ โรงเรียนจริง ข" })
    .click();
  const remove = page.getByRole("button", {
    name: "ยืนยันลบโรงเรียน",
    exact: true,
  });
  await expect(remove).toBeDisabled();
  await page.getByLabel("พิมพ์ชื่อโรงเรียนเพื่อยืนยัน").fill("โรงเรียนจริง ข");
  await remove.click();
  await expect.poll(() => f.db.schools.length).toBe(1);
  expect(
    f.actions.some(
      (a) => a.schoolId === sid2 && a.confirmation === "โรงเรียนจริง ข",
    ),
  ).toBe(true);
});
test("new competition reset requires a fresh preview and typed confirmation and retains schools/accounts/rules", async ({
  page,
}) => {
  const f = await tools(page);
  const original = JSON.stringify(f.db.competitions);
  await enter(page);
  await login(page);
  await page
    .getByRole("button", {
      name: "ตรวจข้อมูลก่อนเริ่มการแข่งขันใหม่",
      exact: true,
    })
    .click();
  const start = page.getByRole("button", {
    name: "ยืนยันเริ่มการแข่งขันใหม่",
    exact: true,
  });
  await expect(start).toBeDisabled();
  await page
    .getByLabel("พิมพ์ข้อความยืนยันการล้างข้อมูล")
    .fill("ล้างข้อมูลการแข่งขันทั้งหมด");
  await start.click();
  await expect(
    page.getByText("เริ่มการแข่งขันใหม่เรียบร้อยแล้ว", { exact: true }),
  ).toBeVisible();
  expect(f.db.schools).toHaveLength(2);
  expect(f.db.profiles).toHaveLength(1);
  expect(JSON.stringify(f.db.competitions)).toBe(original);
  expect(
    f.actions.some(
      (a) => a.action === "start" && a.fingerprint === "reset-preview",
    ),
  ).toBe(true);
});

test("admin can release maintenance left after a completed reset", async ({
  page,
}) => {
  const f = await tools(page);
  f.setJob({
    id: "80000000-0000-4000-8000-000000000001",
    status: "complete",
    processed: 3,
    total: 3,
    manifest: "archive",
  });
  await enter(page);
  await login(page);
  await page
    .getByRole("button", {
      name: "ตรวจข้อมูลก่อนเริ่มการแข่งขันใหม่",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "ปลดโหมดบำรุงรักษาหลังล้างข้อมูล",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("เริ่มการแข่งขันใหม่เรียบร้อยแล้ว", { exact: true }),
  ).toBeVisible();
  expect(f.actions.some((a) => a.action === "step")).toBe(true);
});

test("admin renames schools and reassigns accounts on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const f = await tools(page);
  await enter(page);
  await page.getByRole("button", { name: "เมนูทั้งหมด", exact: true }).click();
  await login(page);
  await page
    .getByRole("button", { name: "แก้ชื่อ โรงเรียนจริง ข", exact: true })
    .click();
  await page
    .getByLabel("ชื่อโรงเรียนที่แก้ไข", { exact: true })
    .fill("โรงเรียนปรับชื่อแล้ว");
  await page
    .getByRole("button", { name: "บันทึกชื่อโรงเรียน", exact: true })
    .click();
  await expect
    .poll(() => f.db.schools.find((s) => s.id === sid2)?.name)
    .toBe("โรงเรียนปรับชื่อแล้ว");
  await page
    .getByRole("button", { name: "จัดการบัญชี school.old", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "โรงเรียนของบัญชี", exact: true })
    .selectOption(sid2);
  await page
    .getByRole("button", { name: "บันทึกโรงเรียนของบัญชี", exact: true })
    .click();
  await expect.poll(() => f.account.schoolId).toBe(sid2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
test("private backup download joins byte parts and preserves Thai names", async ({
  page,
}) => {
  await tools(page);
  await enter(page);
  await login(page);
  await page
    .getByRole("button", { name: "ดูข้อมูลสำรองย้อนหลัง", exact: true })
    .click();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "ดาวน์โหลดสำรอง 80000000", exact: true })
    .click();
  const downloaded = await downloading;
  const file = await downloaded.path();
  expect(file).toBeTruthy();
  const exported = JSON.parse(await readFile(file!, "utf8"));
  expect(exported.entries[0].row.athlete_name).toBe("นักกีฬาเดิม");
  expect(exported.manifest.parts).toBe(2);
});
