import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { normalizeUsername, usernameEmail } from "./school-auth";
import type { AccountStatus, SignupDetails } from "./account-types";

export class AccountError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function accountJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function accountError(error: unknown) {
  return accountJson(
    {
      error:
        error instanceof AccountError
          ? error.message
          : "ระบบบัญชีขัดข้อง กรุณาลองใหม่ภายหลัง",
    },
    error instanceof AccountError ? error.status : 503,
  );
}
export async function accountBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length")) > 4096)
    throw new AccountError("ข้อมูลคำขอมีขนาดใหญ่เกินไป", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("ไม่พบข้อมูลคำขอ");
  let raw = "",
    size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new AccountError("ข้อมูลคำขอมีขนาดใหญ่เกินไป", 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AccountError("รูปแบบคำขอไม่ถูกต้อง");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AccountError("รูปแบบคำขอไม่ถูกต้อง");
  return value as Record<string, unknown>;
}
const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};
function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new AccountError("ยังไม่ได้ตั้งค่า Supabase URL และ public key", 503);
  return { url, key };
}
export function accountClient(token?: string) {
  const { url, key } = configuration();
  return createClient(url, key, {
    auth: authOptions,
    ...(token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : {}),
  });
}
export function accountAdmin() {
  const { url } = configuration();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new AccountError(
      "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า secret สำหรับระบบสมัครบัญชี",
      503,
    );
  return createClient(url, key, { auth: authOptions });
}
export async function authenticateAccount(request: Request) {
  const token = /^Bearer (.+)$/i.exec(
    request.headers.get("authorization") || "",
  )?.[1];
  if (!token) throw new AccountError("กรุณาเข้าสู่ระบบ", 401);
  const { data, error } = await accountClient().auth.getUser(token);
  if (error || !data.user)
    throw new AccountError("การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);
  return { user: data.user, client: accountClient(token) };
}
export async function accountProfile(client: SupabaseClient, userId: string) {
  const result = await client
    .from("profiles")
    .select("id,role,school_id")
    .eq("id", userId)
    .maybeSingle();
  if (result.error) throw new AccountError("ตรวจสอบสิทธิ์บัญชีไม่สำเร็จ", 503);
  return result.data as {
    id: string;
    role: string;
    school_id: string | null;
  } | null;
}
export function signupDetails(body: Record<string, unknown>): SignupDetails {
  if (body.role !== "school" && body.role !== "referee")
    throw new AccountError("สมัครได้เฉพาะโรงเรียนหรือกรรมการเท่านั้น");
  const text = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const fullName = text(body.fullName),
    schoolName = text(body.schoolName),
    phone = text(body.phone),
    schoolType = text(body.schoolType);
  if (fullName.length < 2 || fullName.length > 100)
    throw new AccountError("กรอกชื่อผู้สมัคร 2–100 ตัวอักษร");
  if (
    body.role === "school" &&
    (schoolName.length < 2 || schoolName.length > 120)
  )
    throw new AccountError("กรอกชื่อโรงเรียน 2–120 ตัวอักษร");
  if (phone && !/^[0-9+() -]{8,20}$/.test(phone))
    throw new AccountError("หมายเลขโทรศัพท์ไม่ถูกต้อง");
  if (schoolType && !["ขนาดเล็ก", "ขยายโอกาส"].includes(schoolType))
    throw new AccountError("ประเภทโรงเรียนไม่ถูกต้อง");
  return {
    role: body.role,
    fullName,
    schoolName: body.role === "school" ? schoolName : "",
    phone,
    schoolType: body.role === "school" ? schoolType : "",
  };
}
export function serverRegistration(user: User) {
  const value = user.app_metadata.registration;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  // Only Auth admin APIs write this object. Never read an approval/role from user_metadata.
  if (value.role !== "school" && value.role !== "referee") return null;
  return value as SignupDetails & {
    status: "pending" | "rejected";
    note?: string;
    submittedAt?: string;
  };
}
export async function accountStatus(
  user: User,
  client: SupabaseClient,
): Promise<AccountStatus> {
  const profile = await accountProfile(client, user.id);
  if (
    profile &&
    ["admin", "school", "school_admin", "recorder", "referee"].includes(
      profile.role,
    )
  )
    return { status: "approved", role: profile.role };
  const registration = serverRegistration(user);
  const result = await client
    .from("school_registration_requests")
    .select("id,status,review_note")
    .eq("user_id", user.id)
    .maybeSingle();
  if (result.error)
    throw new AccountError(
      "ตรวจสอบคำขอสมัครไม่สำเร็จ กรุณาให้ผู้ดูแลตรวจการตั้งค่าระบบสมัคร",
      503,
    );
  if (result.data) {
    // A request status alone never grants a role: profiles is the permission source.
    return {
      status: result.data.status === "rejected" ? "rejected" : "pending",
      role: registration?.role || "school",
      note: result.data.review_note,
    };
  }
  return { status: "unsubmitted" };
}
export async function ensureRegistrationRequest(
  user: User,
  client: SupabaseClient,
) {
  const registration = serverRegistration(user);
  if (!registration) return;
  const existing = await client
    .from("school_registration_requests")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing.error)
    throw new AccountError(
      "ระบบคำขอสมัครยังไม่พร้อม บัญชีถูกสร้างแล้ว กรุณาเข้าสู่ระบบเพื่อลองส่งคำขออีกครั้ง",
      503,
    );
  if (existing.data) return;
  const username = normalizeUsername(user.user_metadata.username);
  if (!username || user.email !== usernameEmail(username))
    throw new AccountError("ข้อมูลบัญชีสมัครไม่ถูกต้อง", 403);
  const inserted = await client.from("school_registration_requests").insert({
    username,
    school_name:
      registration.role === "school"
        ? registration.schoolName
        : `กรรมการ: ${registration.fullName}`,
    contact_name: registration.fullName,
    contact_phone: registration.phone || null,
  });
  if (inserted.error && inserted.error.code !== "23505")
    throw new AccountError(
      "ส่งคำขอสมัครไม่สำเร็จ บัญชีถูกสร้างแล้ว กรุณาเข้าสู่ระบบเพื่อลองอีกครั้ง",
      503,
    );
}

/** Resolve existing approved email accounts without changing their Auth identity. */
export async function accountIdentities(admin = accountAdmin()) {
  const identities: { username: string; email: string; userId: string }[] = [];
  for (let page = 1; ; page++) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (listed.error)
      throw new AccountError("ตรวจสอบชื่อบัญชีไม่สำเร็จ กรุณาลองใหม่", 503);
    const users = listed.data.users;
    const profiles = users.length
      ? await admin
          .from("profiles")
          .select("id,role")
          .in(
            "id",
            users.map((u) => u.id),
          )
      : { data: [], error: null };
    if (profiles.error)
      throw new AccountError("ตรวจสอบสิทธิ์บัญชีไม่สำเร็จ", 503);
    const roles = new Map((profiles.data || []).map((p) => [p.id, p.role]));
    for (const user of users) {
      if (!user.email) continue;
      const explicit = normalizeUsername(user.app_metadata.login_username);
      const prefix = normalizeUsername(user.email.split("@")[0]);
      const internal = prefix && usernameEmail(prefix) === user.email;
      const approvedLegacy = [
        "school",
        "school_admin",
        "recorder",
        "referee",
      ].includes(roles.get(user.id) || "");
      const username = explicit || (internal || approvedLegacy ? prefix : null);
      if (username)
        identities.push({ username, email: user.email, userId: user.id });
    }
    if (users.length < 100) break;
  }
  return identities;
}
export async function usernameLoginEmail(username: string) {
  const matches = (await accountIdentities()).filter(
    (account) => account.username === username,
  );
  if (matches.length !== 1)
    throw new AccountError(
      "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง กรุณาติดต่อผู้ดูแลหากใช้บัญชีเดิมไม่ได้",
      401,
    );
  return matches[0].email;
}
