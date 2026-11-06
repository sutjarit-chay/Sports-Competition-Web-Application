import { reserveUsername } from "@/lib/username-reservations";
import { createHmac } from "node:crypto";
import { normalizeUsername, usernameEmail } from "@/lib/school-auth";
import {
  AccountError,
  accountAdmin,
  accountBody,
  accountClient,
  accountError,
  accountJson,
  accountProfile,
  accountStatus,
  authenticateAccount,
  ensureRegistrationRequest,
  signupDetails,
  accountIdentities,
  usernameLoginEmail,
} from "@/lib/account-server";

export async function POST(request: Request) {
  try {
    const body = await accountBody(request);
    const username = normalizeUsername(body.username);
    if (!username || typeof body.password !== "string")
      throw new AccountError("ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง");
    if (
      body.password.length > 128 ||
      (body.mode === "register"
        ? body.password.length < 10
        : body.password.length === 0)
    )
      throw new AccountError("รหัสผ่านต้องมีความยาว 10–128 ตัวอักษร");
    if (body.mode !== "register" && body.mode !== "login")
      throw new AccountError("ไม่รองรับวิธีดำเนินการนี้");
    if (body.mode === "register") {
      const details = signupDetails(body);
      const admin = accountAdmin();
      const ipHash = createHmac(
        "sha256",
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
        .update(request.headers.get("x-real-ip")?.trim() || "unknown")
        .digest("hex");
      const quota = await admin.rpc("allow_school_signup", {
        p_ip_hash: ipHash,
      });
      if (quota.error)
        throw new AccountError(
          "ระบบจำกัดการสมัครยังไม่พร้อม กรุณาลองใหม่ภายหลัง",
          503,
        );
      if (!quota.data)
        throw new AccountError(
          "สมัครบัญชีได้ไม่เกิน 5 ครั้งต่อชั่วโมงจากเครือข่ายนี้",
          429,
        );
      if (
        (await accountIdentities(admin)).some(
          (account) => account.username === username,
        )
      )
        throw new AccountError(
          "ชื่อบัญชีนี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น",
          409,
        );
      const created = await admin.auth.admin.createUser({
        email: usernameEmail(username),
        password: body.password,
        email_confirm: true,
        user_metadata: { username },
        app_metadata: {
          registration: {
            ...details,
            status: "pending",
            submittedAt: new Date().toISOString(),
          },
        },
      });
      if (created.error)
        throw new AccountError(
          "สร้างบัญชีไม่สำเร็จ ชื่อบัญชีอาจถูกใช้แล้ว หากสมัครไว้แล้วให้เข้าสู่ระบบ",
          409,
        );
      if (!created.data.user)
        throw new AccountError("สร้างบัญชีไม่สำเร็จ", 503);
      try {
        await reserveUsername(admin, username, created.data.user.id);
      } catch (reservationError) {
        // This identity was created in this request and has not received a
        // registration request or an approved profile. Never delete an existing user.
        const cleanup = await admin.auth.admin.deleteUser(created.data.user.id);
        if (cleanup.error)
          throw new AccountError(
            "จองชื่อบัญชีไม่สำเร็จและลบบัญชีใหม่ที่ยังไม่อนุมัติไม่สำเร็จ กรุณาติดต่อผู้ดูแลระบบ",
            503,
          );
        throw reservationError;
      }
    }
    const auth = accountClient();
    const signed = await auth.auth.signInWithPassword({
      email: await usernameLoginEmail(username),
      password: body.password,
    });
    if (signed.error || !signed.data.session || !signed.data.user)
      throw new AccountError(
        body.mode === "register"
          ? "สร้างบัญชีแล้ว แต่เข้าสู่ระบบไม่สำเร็จ กรุณาลองเข้าสู่ระบบอีกครั้ง"
          : "ชื่อบัญชีหรือรหัสผ่านไม่ถูกต้อง",
        401,
      );
    const client = accountClient(signed.data.session.access_token);
    const profile = await accountProfile(client, signed.data.user.id);
    if (profile?.role === "admin")
      throw new AccountError("ผู้ดูแลระบบกรุณาเข้าสู่ระบบด้วยอีเมล", 403);
    if (!profile || profile.role === "viewer")
      await ensureRegistrationRequest(signed.data.user, client);
    return accountJson({
      ...(body.mode === "login" ? { session: signed.data.session } : {}),
      account: await accountStatus(signed.data.user, client),
    });
  } catch (error) {
    return accountError(error);
  }
}
export async function GET(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    return accountJson({ account: await accountStatus(user, client) });
  } catch (error) {
    return accountError(error);
  }
}
