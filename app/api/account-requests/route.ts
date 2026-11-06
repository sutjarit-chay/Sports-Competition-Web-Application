import { refereeClaim, reviewReferee } from "@/lib/referee-review";
import type { AccountRequest } from "@/lib/account-types";
import {
  AccountError,
  accountAdmin,
  accountBody,
  accountError,
  accountJson,
  accountProfile,
  authenticateAccount,
  serverRegistration,
} from "@/lib/account-server";
import { normalizeUsername, usernameEmail } from "@/lib/school-auth";
import type { User } from "@supabase/supabase-js";

async function administrator(request: Request) {
  const context = await authenticateAccount(request);
  const profile = await accountProfile(context.client, context.user.id);
  if (profile?.role !== "admin")
    throw new AccountError("เฉพาะผู้ดูแลระบบเท่านั้นที่ตรวจคำขอได้", 403);
  return context;
}
export async function GET(request: Request) {
  try {
    const { client } = await administrator(request);
    const admin = accountAdmin();
    const users = new Map<string, User>();
    for (let page = 1; ; page++) {
      const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (result.error)
        throw new AccountError("โหลดข้อมูลผู้สมัครไม่สำเร็จ", 503);
      for (const user of result.data.users) users.set(user.id, user);
      if (result.data.users.length < 100) break;
    }
    const requests: AccountRequest[] = [];
    for (let offset = 0; ; offset += 100) {
      const result = await client
        .from("school_registration_requests")
        .select(
          "id,user_id,username,school_name,contact_name,contact_phone,created_at,status,review_note,reviewed_at",
        )
        .order("created_at")
        .range(offset, offset + 99);
      if (result.error) throw new AccountError("โหลดคำขอสมัครไม่สำเร็จ", 503);
      for (const row of result.data || []) {
        const user = users.get(row.user_id),
          registration = user ? serverRegistration(user) : null;
        const claim = refereeClaim(row.review_note);
        if (row.status !== "pending" && !claim) continue;
        const kind = registration?.role === "referee" ? "referee" : "school";
        requests.push({
          id: kind === "referee" ? row.user_id : row.id,
          kind,
          username: row.username,
          fullName: row.contact_name,
          schoolName: kind === "school" ? row.school_name : "",
          phone: row.contact_phone || "",
          createdAt: row.created_at,
          ...(claim ? { reviewDecision: claim.decision } : {}),
        });
      }
      if (!result.data || result.data.length < 100) break;
    }
    return accountJson({ requests });
  } catch (error) {
    return accountError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { client, user: reviewer } = await administrator(request);
    const body = await accountBody(request);
    if (body.kind !== "school" && body.kind !== "referee")
      throw new AccountError("ประเภทคำขอไม่ถูกต้อง");
    if (
      typeof body.id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.id,
      )
    )
      throw new AccountError("รหัสคำขอไม่ถูกต้อง");
    if (body.decision !== "approved" && body.decision !== "rejected")
      throw new AccountError("สถานะการตรวจสอบไม่ถูกต้อง");
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 500)
      throw new AccountError("หมายเหตุต้องไม่เกิน 500 ตัวอักษร");
    if (body.kind === "school") {
      const application = await client
        .from("school_registration_requests")
        .select("user_id,review_note")
        .eq("id", body.id)
        .maybeSingle();
      if (application.error || !application.data)
        throw new AccountError("ไม่พบคำขอโรงเรียน", 404);
      const target = await accountAdmin().auth.admin.getUserById(
        application.data.user_id,
      );
      if (target.error || !target.data.user)
        throw new AccountError("ไม่พบบัญชีผู้สมัคร", 404);
      if (
        serverRegistration(target.data.user)?.role === "referee" ||
        refereeClaim(application.data.review_note)
      )
        throw new AccountError(
          "คำขอนี้เป็นบัญชีกรรมการ ไม่สามารถอนุมัติเป็นโรงเรียนได้",
        );
      const result = await client.rpc("review_school_registration", {
        p_request_id: body.id,
        p_decision: body.decision,
        p_note: note || null,
      });
      if (result.error)
        throw new AccountError(
          "ตรวจคำขอโรงเรียนไม่สำเร็จ คำขออาจถูกตรวจแล้วหรือข้อมูลไม่ผ่านข้อกำหนดเดิม",
          409,
        );
      return accountJson({ status: body.decision });
    }
    const admin = accountAdmin();
    const target = await admin.auth.admin.getUserById(body.id);
    if (target.error || !target.data.user)
      throw new AccountError("ไม่พบคำขอกรรมการ", 404);
    const user = target.data.user,
      registration = serverRegistration(user);
    const username = normalizeUsername(user.email?.split("@")[0]);
    if (
      registration?.role !== "referee" ||
      !username ||
      usernameEmail(username) !== user.email
    )
      throw new AccountError("ไม่พบคำขอกรรมการที่รอตรวจสอบ", 409);
    return accountJson(
      await reviewReferee(admin, user, reviewer.id, body.decision, note),
    );
  } catch (error) {
    return accountError(error);
  }
}
