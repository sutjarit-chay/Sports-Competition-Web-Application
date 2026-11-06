import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AccountError,
  accountAdmin,
  accountProfile,
  authenticateAccount,
} from "./account-server";
import { createHash } from "node:crypto";

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const emptySchoolProfile = {
  shortName: "",
  schoolType: "",
  logo: "",
  contactName: "",
  contactPhone: "",
  address: "",
};
export type PrivateSchoolProfile = typeof emptySchoolProfile;
export type Coach = {
  id: string;
  school_id: string;
  competition_id: string;
  name: string;
  title: string;
  phone: string;
};
const bucket = "team-files";
export function schoolUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value))
    throw new AccountError("รหัสโรงเรียนหรือรายการแข่งขันไม่ถูกต้อง");
  return value;
}
export async function authorizeSchool(request: Request, schoolId: string) {
  schoolUuid(schoolId);
  const { user, client } = await authenticateAccount(request);
  const profile = await accountProfile(client, user.id);
  if (
    !profile ||
    !(
      profile.role === "admin" ||
      (["school", "school_admin"].includes(profile.role) &&
        profile.school_id === schoolId)
    )
  )
    throw new AccountError("ไม่มีสิทธิ์จัดการข้อมูลโรงเรียนนี้", 403);
  const admin = accountAdmin();
  await requireSchool(admin, schoolId);
  return admin;
}
export async function requireSchool(admin: SupabaseClient, schoolId: string) {
  schoolUuid(schoolId);
  const found = await admin
    .from("schools")
    .select("id")
    .eq("id", schoolId)
    .maybeSingle();
  if (found.error) throw new AccountError("ตรวจสอบโรงเรียนไม่สำเร็จ", 503);
  if (!found.data) throw new AccountError("ไม่พบโรงเรียน", 404);
}
export async function schoolBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 1_400_000)
    throw new AccountError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("ไม่พบข้อมูลคำขอ");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_400_000) {
      await reader.cancel();
      throw new AccountError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
    }
    chunks.push(value);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AccountError("รูปแบบคำขอไม่ถูกต้อง");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new AccountError("รูปแบบคำขอไม่ถูกต้อง");
  return body as Record<string, unknown>;
}
export function safeLogo(
  value: unknown,
): { bytes: Buffer; type: string } | null {
  if (value === "") return null;
  if (typeof value !== "string") throw new AccountError("ไฟล์โลโก้ไม่ถูกต้อง");
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
  if (!match) throw new AccountError("รองรับโลโก้ PNG, JPG หรือ WEBP เท่านั้น");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 1_000_000)
    throw new AccountError("โลโก้ต้องไม่เกิน 1 MB", 413);
  const valid =
    match[1] === "image/png"
      ? bytes.length >= 24 &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.toString("ascii", 12, 16) === "IHDR"
      : match[1] === "image/jpeg"
        ? bytes.length >= 4 &&
          bytes[0] === 255 &&
          bytes[1] === 216 &&
          bytes[2] === 255 &&
          bytes.at(-2) === 255 &&
          bytes.at(-1) === 217
        : bytes.length >= 16 &&
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new AccountError("เนื้อหาไฟล์โลโก้ไม่ตรงกับชนิดภาพ");
  return { bytes, type: match[1] };
}
function text(value: unknown, max: number) {
  if (typeof value !== "string" || value.length > max)
    throw new AccountError("ข้อมูลไม่ถูกต้องหรือยาวเกินกำหนด");
  return value.trim();
}
export function validateProfile(value: unknown): PrivateSchoolProfile {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AccountError("ข้อมูลโรงเรียนไม่ถูกต้อง");
  const v = value as Record<string, unknown>;
  const profile = {
    shortName: text(v.shortName, 40),
    schoolType: text(v.schoolType, 40),
    logo: text(v.logo, 1_350_000),
    contactName: text(v.contactName, 120),
    contactPhone: text(v.contactPhone, 30),
    address: text(v.address, 500),
  };
  if (!["", "ขนาดเล็ก", "ขยายโอกาส"].includes(profile.schoolType))
    throw new AccountError("ประเภทโรงเรียนไม่ถูกต้อง");
  safeLogo(profile.logo);
  return profile;
}
export function validateCoaches(
  value: unknown,
  schoolId: string,
  competitionId: string,
): Coach[] {
  if (!Array.isArray(value))
    throw new AccountError("ข้อมูลผู้ฝึกสอนไม่ถูกต้อง");
  const ids = new Set<string>();
  return value.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      v.school_id !== schoolId ||
      v.competition_id !== competitionId
    )
      throw new AccountError("ขอบเขตข้อมูลผู้ฝึกสอนไม่ถูกต้อง", 403);
    const coach = {
      id: schoolUuid(v.id),
      school_id: schoolId,
      competition_id: competitionId,
      name: text(v.name, 120),
      title: text(v.title, 120),
      phone: text(v.phone, 30),
    };
    if (!coach.name || !coach.title || ids.has(coach.id))
      throw new AccountError("กรอกชื่อและหน้าที่ให้ครบ และห้ามรหัสซ้ำ");
    ids.add(coach.id);
    return coach;
  });
}
export function profilePrefix(schoolId: string) {
  return `school-profiles/${schoolUuid(schoolId)}`;
}
export function coachesPrefix(schoolId: string, competitionId: string) {
  return `school-coaches/${schoolUuid(schoolId)}/${schoolUuid(competitionId)}`;
}
export async function readDocument<T>(
  admin: SupabaseClient,
  prefix: string,
  fallback: T,
): Promise<{ value: T; version: string | null }> {
  const listed = await admin.storage.from(bucket).list(prefix, {
    limit: 1,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (listed.error) throw new AccountError("อ่านข้อมูลโรงเรียนไม่สำเร็จ", 503);
  const file = listed.data?.[0];
  if (!file) return { value: fallback, version: null };
  if (!/^[0-9a-f-]{36}\.json$/i.test(file.name))
    throw new AccountError("ข้อมูลเวอร์ชันไม่ถูกต้อง", 503);
  const result = await admin.storage
    .from(bucket)
    .download(`${prefix}/${file.name}`);
  if (result.error || !result.data)
    throw new AccountError("อ่านข้อมูลโรงเรียนไม่สำเร็จ", 503);
  try {
    return {
      value: JSON.parse(await result.data.text()) as T,
      version: file.name,
    };
  } catch {
    throw new AccountError("ข้อมูลโรงเรียนเสียหาย กรุณาติดต่อผู้ดูแล", 503);
  }
}
/** Each predecessor has exactly one successor object. Storage's atomic unique
 * object insertion (upsert:false) arbitrates concurrent writers, including the
 * initial null version. Keep history: deleting a successor would reopen it.
 */
export async function writeDocument<T>(
  admin: SupabaseClient,
  prefix: string,
  value: T,
  expected: unknown,
  fallback: T,
) {
  if (
    expected !== null &&
    (typeof expected !== "string" || !/^[0-9a-f-]{36}\.json$/i.test(expected))
  )
    throw new AccountError("เวอร์ชันข้อมูลไม่ถูกต้อง");
  const current = await readDocument(admin, prefix, fallback);
  if (current.version !== expected)
    throw new AccountError(
      "ข้อมูลเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก",
      409,
    );
  const hash = createHash("sha256")
    .update(JSON.stringify([prefix, expected]))
    .digest("hex");
  const version = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${((parseInt(hash[16], 16) & 3) | 8).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}.json`;
  const uploaded = await admin.storage
    .from(bucket)
    .upload(`${prefix}/${version}`, JSON.stringify(value), {
      contentType: "application/json",
      upsert: false,
    });
  if (uploaded.error) {
    if (
      uploaded.error.statusCode === "409" ||
      /already exists|duplicate/i.test(uploaded.error.message)
    )
      throw new AccountError(
        "ข้อมูลเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก",
        409,
      );
    throw new AccountError("บันทึกข้อมูลโรงเรียนไม่สำเร็จ", 503);
  }
  return { value, version };
}
