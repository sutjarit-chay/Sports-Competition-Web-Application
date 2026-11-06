import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountError } from "./account-server";
import { normalizeUsername } from "./school-auth";
/** Immutable claims are retained across renames, so an old login name can never
 * be handed to another identity. Storage's unique object key arbitrates races. */
export async function reserveUsername(
  admin: SupabaseClient,
  value: string,
  userId: string,
) {
  const username = normalizeUsername(value);
  if (!username) throw new AccountError("ชื่อบัญชีไม่ถูกต้อง");
  const path = `account-usernames/${username}.json`;
  const result = await admin.storage
    .from("team-files")
    .upload(path, JSON.stringify({ userId }), {
      contentType: "application/json",
      upsert: false,
    });
  if (!result.error) return;
  if (
    result.error.statusCode !== "409" &&
    !/already exists|duplicate/i.test(result.error.message)
  )
    throw new AccountError("จองชื่อบัญชีไม่สำเร็จ กรุณาลองใหม่", 503);
  const existing = await admin.storage.from("team-files").download(path);
  if (existing.error || !existing.data)
    throw new AccountError("ตรวจสอบชื่อบัญชีที่จองไม่สำเร็จ", 503);
  let owner: unknown;
  try {
    owner = JSON.parse(await existing.data.text()).userId;
  } catch {
    throw new AccountError("ข้อมูลชื่อบัญชีที่จองไม่ถูกต้อง", 503);
  }
  if (owner !== userId)
    throw new AccountError(
      "ชื่อบัญชีนี้ถูกใช้หรือสงวนไว้แล้ว กรุณาเลือกชื่ออื่น",
      409,
    );
}
