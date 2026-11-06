import { reserveUsername } from "./username-reservations";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AccountError,
  accountAdmin,
  accountIdentities,
  accountProfile,
  authenticateAccount,
} from "./account-server";
import { normalizeUsername } from "./school-auth";
import { requireSchool, schoolUuid } from "./school-storage";
export async function authorizeAdministrator(request: Request) {
  const { user, client } = await authenticateAccount(request);
  if ((await accountProfile(client, user.id))?.role !== "admin")
    throw new AccountError("เฉพาะผู้ดูแลระบบเท่านั้น", 403);
  return accountAdmin();
}
const roles = ["school", "school_admin", "referee", "recorder"];
export async function adminAccountDirectory(admin: SupabaseClient) {
  const identities = await accountIdentities(admin);
  const accounts = [];
  for (let page = 1; ; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw new AccountError("อ่านบัญชีไม่สำเร็จ", 503);
    const users = result.data.users;
    if (users.length) {
      const profiles = await admin
        .from("profiles")
        .select("id,role,school_id")
        .in(
          "id",
          users.map((u) => u.id),
        );
      if (profiles.error) throw new AccountError("อ่านสิทธิ์ไม่สำเร็จ", 503);
      for (const p of profiles.data || []) {
        if (!roles.includes(p.role)) continue;
        const u = users.find((u) => u.id === p.id)!;
        accounts.push({
          id: u.id,
          username: identities.find((i) => i.userId === u.id)?.username || "",
          displayName:
            typeof u.user_metadata.full_name === "string"
              ? u.user_metadata.full_name
              : typeof u.user_metadata.name === "string"
                ? u.user_metadata.name
                : "",
          role: p.role as string,
          schoolId: p.school_id as string | null,
        });
      }
    }
    if (users.length < 100) break;
  }
  return accounts;
}
export async function changeAdminAccount(
  admin: SupabaseClient,
  body: Record<string, unknown>,
) {
  const userId = schoolUuid(body.userId);
  const profile = await accountProfile(admin, userId);
  if (!profile || !roles.includes(profile.role))
    throw new AccountError("ไม่สามารถแก้ไขบัญชีนี้ได้", 403);
  if (body.action === "username") {
    const username = normalizeUsername(body.username);
    if (!username) throw new AccountError("ชื่อบัญชีต้องมี 3–32 ตัวอักษร");
    const identities = await accountIdentities(admin);
    if (identities.some((i) => i.username === username && i.userId !== userId))
      throw new AccountError("มีชื่อบัญชีนี้แล้ว", 409);
    const currentUsername = identities.find(
      (identity) => identity.userId === userId,
    )?.username;
    if (currentUsername) await reserveUsername(admin, currentUsername, userId);
    await reserveUsername(admin, username, userId);
    const found = await admin.auth.admin.getUserById(userId);
    if (found.error || !found.data.user)
      throw new AccountError("ไม่พบบัญชี", 404);
    const updated = await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...found.data.user.app_metadata,
        login_username: username,
      },
    });
    if (updated.error) throw new AccountError("แก้ไขชื่อบัญชีไม่สำเร็จ", 503);
  } else if (body.action === "password") {
    if (
      typeof body.password !== "string" ||
      body.password.length < 10 ||
      body.password.length > 128
    )
      throw new AccountError("รหัสผ่านใหม่ต้องมี 10–128 ตัวอักษร");
    const updated = await admin.auth.admin.updateUserById(userId, {
      password: body.password,
    });
    if (updated.error) throw new AccountError("ตั้งรหัสผ่านใหม่ไม่สำเร็จ", 503);
  } else if (body.action === "school") {
    if (!["school", "school_admin"].includes(profile.role))
      throw new AccountError("บัญชีนี้ไม่ใช่บัญชีโรงเรียน", 403);
    const schoolId = schoolUuid(body.schoolId);
    await requireSchool(admin, schoolId);
    if (body.expectedSchoolId !== profile.school_id)
      throw new AccountError("ข้อมูลเปลี่ยน กรุณาโหลดใหม่", 409);
    let query = admin
      .from("profiles")
      .update({ school_id: schoolId })
      .eq("id", userId)
      .eq("role", profile.role);
    query =
      profile.school_id === null
        ? query.is("school_id", null)
        : query.eq("school_id", profile.school_id);
    const updated = await query.select("id");
    if (updated.error) throw new AccountError("ย้ายโรงเรียนไม่สำเร็จ", 503);
    if (!updated.data?.length)
      throw new AccountError("ข้อมูลเปลี่ยน กรุณาโหลดใหม่", 409);
  } else throw new AccountError("คำสั่งไม่ถูกต้อง");
}
