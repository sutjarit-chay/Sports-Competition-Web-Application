import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountError } from "./account-server";
import { schoolUuid } from "./school-storage";
type Row = Record<string, unknown>;
async function rows(admin: SupabaseClient, table: string) {
  const all: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await admin
      .from(table)
      .select("*")
      .order("id")
      .range(offset, offset + 499);
    if (result.error)
      throw new AccountError("ตรวจสอบข้อมูลอ้างอิงโรงเรียนไม่สำเร็จ", 503);
    all.push(...result.data);
    if (result.data.length < 500) break;
  }
  return all;
}
function references(value: unknown, schoolId: string): boolean {
  if (value === schoolId) return true;
  if (Array.isArray(value)) return value.some((v) => references(v, schoolId));
  if (value && typeof value === "object")
    return Object.values(value).some((v) => references(v, schoolId));
  return false;
}
async function storagePaths(admin: SupabaseClient) {
  const paths: string[] = [];
  const pending = [""];
  while (pending.length) {
    const prefix = pending.pop()!;
    for (let offset = 0; ; offset += 100) {
      const result = await admin.storage.from("team-files").list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (result.error)
        throw new AccountError("ตรวจสอบไฟล์โรงเรียนไม่สำเร็จ", 503);
      for (const item of result.data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) paths.push(path);
        else pending.push(path);
      }
      if (result.data.length < 100) break;
    }
  }
  return paths.sort();
}
export async function schoolDependencyPreview(
  admin: SupabaseClient,
  value: unknown,
) {
  const schoolId = schoolUuid(value).toLowerCase();
  const school = await admin
    .from("schools")
    .select("id,name")
    .eq("id", schoolId)
    .maybeSingle();
  if (school.error) throw new AccountError("อ่านโรงเรียนไม่สำเร็จ", 503);
  if (!school.data) throw new AccountError("ไม่พบโรงเรียน", 404);
  const data: Record<string, unknown[]> = {};
  for (const table of [
    "profiles",
    "registrations",
    "matches",
    "athletics_results",
    "medals",
    "team_files",
  ])
    data[table] = (await rows(admin, table)).filter((row) =>
      references(row, schoolId),
    );
  data.management = (await rows(admin, "competitions")).filter((row) =>
    references(row.registration_policy, schoolId),
  );
  const schoolFiles = (await storagePaths(admin)).filter((path) =>
    path.split("/").includes(schoolId),
  );
  const retainedFiles = schoolFiles.filter((path) =>
    path.startsWith(`school-profiles/${schoolId}/`),
  );
  data.privateFiles = schoolFiles.filter(
    (path) => !retainedFiles.includes(path),
  );
  const dependencies = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value.length]),
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ school: school.data, data, retainedFiles }))
    .digest("hex");
  return {
    schoolId,
    name: school.data.name as string,
    dependencies,
    retainedProfileFiles: retainedFiles.length,
    fingerprint,
    canDelete: Object.values(dependencies).every((n) => n === 0),
  };
}
export async function deleteEmptySchool(
  admin: SupabaseClient,
  body: Record<string, unknown>,
) {
  const preview = await schoolDependencyPreview(admin, body.schoolId);
  if (body.confirmation !== preview.name)
    throw new AccountError("กรอกชื่อโรงเรียนให้ตรงเพื่อยืนยัน");
  if (body.fingerprint !== preview.fingerprint || !preview.canDelete)
    throw new AccountError(
      "โรงเรียนมีข้อมูลอ้างอิงหรือข้อมูลเปลี่ยน กรุณาตรวจสอบใหม่",
      409,
    );
  const result = await admin
    .from("schools")
    .delete()
    .eq("id", preview.schoolId)
    .eq("name", preview.name)
    .select("id");
  if (result.error)
    throw new AccountError("ลบโรงเรียนไม่สำเร็จ อาจมีข้อมูลอ้างอิงใหม่", 409);
  if (!result.data?.length)
    throw new AccountError("ข้อมูลโรงเรียนเปลี่ยน กรุณาโหลดใหม่", 409);
  return { retainedProfileFiles: preview.retainedProfileFiles };
}
