import { test, expect } from "@playwright/test";
import { fixture, enter } from "./helpers/production-fixture";

test("public startup ignores obsolete demo state and grants no editing permissions", async ({page}) => {
  await fixture(page);
  await page.addInitScript(() => {
    for (const key of ["kosamphi-demo-v1", "kosamphi-admin-competitions-v1", "kosamphi-school-profiles-v1"])
      localStorage.setItem(key, JSON.stringify({schools:[{id:"fake",name:"POISONED DEMO SCHOOL"}],role:"admin"}));
  });
  await enter(page);
  await expect(page.locator(".role")).toContainText("ผู้ชม");
  await expect(page.getByText("POISONED DEMO SCHOOL")).toHaveCount(0);
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  await expect(page.getByRole("button", {name:"เข้าสู่โหมด Supabase",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button", {name:"นักกีฬา",exact:true})).toHaveCount(0);
});

test("failed initial public reads expose a retry that recovers from the server", async ({page}) => {
  const {control} = await fixture(page, true);
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Fixture read denied");
  await expect(page.locator(".role")).toContainText("ผู้ชม");
  control.fail = false;
  await page.getByRole("button", {name:"โหลดข้อมูลใหม่",exact:true}).click();
  await expect(page.getByRole("status")).not.toContainText("Fixture read denied");
  await expect(page.getByText("Supabase · ข้อมูลจริง",{exact:true})).toBeVisible();
});

test("public loading remains visible until the paginated server read completes",async ({page})=>{
  const {control}=await fixture(page);
  let release!:()=>void;
  control.readGate=new Promise<void>(resolve=>{release=resolve;});
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("กำลังโหลดข้อมูล");
  await expect(page.getByRole("button",{name:"นักกีฬา",exact:true})).toHaveCount(0);
  release();
  await expect(page.getByRole("status").filter({hasText:"กำลังโหลดข้อมูล"})).toHaveCount(0);
});
