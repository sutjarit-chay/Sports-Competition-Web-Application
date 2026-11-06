import { randomUUID } from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  AccountError,
  accountProfile,
  serverRegistration,
} from "./account-server";

type Decision = "approved" | "rejected";
type Claim = {
  kind: "referee-review-v1";
  decision: Decision;
  nonce: string;
  reviewerId: string;
  note: string;
};
export function refereeClaim(raw: unknown): Claim | null {
  if (typeof raw !== "string") return null;
  try {
    const value = JSON.parse(raw);
    return value.kind === "referee-review-v1" &&
      ["approved", "rejected"].includes(value.decision) &&
      typeof value.nonce === "string" &&
      typeof value.reviewerId === "string" &&
      typeof value.note === "string"
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function reviewReferee(
  admin: SupabaseClient,
  user: User,
  reviewerId: string,
  decision: Decision,
  note: string,
) {
  const registration = serverRegistration(user);
  if (registration?.role !== "referee")
    throw new AccountError("ไม่พบคำขอกรรมการ", 409);
  const result = await admin
    .from("school_registration_requests")
    .select("id,status,review_note,reviewed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (result.error)
    throw new AccountError("อ่านสถานะคำขอกรรมการไม่สำเร็จ", 503);
  const row = result.data;
  if (!row)
    throw new AccountError(
      "ยังไม่พบคำขอกรรมการ กรุณาให้ผู้สมัครเข้าสู่ระบบเพื่อลองส่งคำขออีกครั้ง",
      409,
    );
  const previousClaim = refereeClaim(row.review_note);
  if (!previousClaim && row.status !== "pending")
    throw new AccountError("คำขอนี้ถูกตรวจสอบแล้ว", 409);
  if (previousClaim && previousClaim.decision !== decision)
    throw new AccountError(
      "คำขอนี้กำลังดำเนินการตามคำตัดสินเดิม ไม่สามารถเปลี่ยนคำตัดสินซ้อนได้",
      409,
    );
  const existing = await accountProfile(admin, user.id);
  if (
    existing &&
    !(
      previousClaim &&
      decision === "approved" &&
      ["recorder", "referee"].includes(existing.role)
    )
  )
    throw new AccountError(
      "บัญชีนี้มีสิทธิ์อยู่แล้ว ไม่สามารถอนุมัติทับได้",
      409,
    );
  if (
    previousClaim &&
    (!row.reviewed_at || Date.now() - Date.parse(row.reviewed_at) < 120_000)
  )
    throw new AccountError(
      "คำขอนี้กำลังตรวจสอบ หากการเชื่อมต่อสะดุดให้ลองดำเนินการต่อหลัง 2 นาที",
      409,
    );
  const claim: Claim = previousClaim
    ? { ...previousClaim, nonce: randomUUID() }
    : {
        kind: "referee-review-v1",
        decision,
        nonce: randomUUID(),
        reviewerId,
        note,
      };
  const marker = JSON.stringify(claim);
  const claimedAt = new Date().toISOString();
  if (marker.length > 500)
    throw new AccountError("หมายเหตุกรรมการยาวเกินไป กรุณาย่อข้อความ");
  // One conditional database update elects one reviewer across processes/instances.
  // Use the existing approved value during the claim: the applicant's existing
  // resubmit RPC can reset rejected rows. A claim never grants permissions;
  // only the fixed profile role provisioned below does.
  let acquire = admin
    .from("school_registration_requests")
    .update({
      status: "approved",
      review_note: marker,
      reviewed_at: claimedAt,
    })
    .eq("id", row.id);
  acquire = previousClaim
    ? acquire.eq("status", "approved").eq("reviewed_at", row.reviewed_at)
    : acquire.eq("status", "pending");
  const claimed = await acquire.select("id");
  if (claimed.error)
    throw new AccountError(
      "ไม่สามารถรับคำขอตรวจสอบได้ กรุณาให้ผู้ดูแลตรวจสิทธิ์ backend",
      503,
    );
  if (!claimed.data?.length)
    throw new AccountError(
      "คำขอนี้ถูกผู้ดูแลตรวจสอบแล้วหรือกำลังดำเนินการ",
      409,
    );
  if (decision === "approved" && !existing) {
    const inserted = await admin
      .from("profiles")
      .insert({ id: user.id, role: "referee", school_id: null });
    if (inserted.error) {
      // A previous worker for this same immutable decision may have inserted it before recovery.
      const provisioned =
        inserted.error.code === "23505"
          ? await accountProfile(admin, user.id)
          : null;
      if (!provisioned || !["recorder", "referee"].includes(provisioned.role)) {
        const restored = await admin
          .from("school_registration_requests")
          .update({ status: "pending", review_note: null, reviewed_at: null })
          .eq("id", row.id)
          .eq("status", "approved")
          .eq("reviewed_at", claimedAt)
          .select("id");
        if (restored.error || !restored.data?.length)
          throw new AccountError(
            "อนุมัติสิทธิ์ไม่สำเร็จ และคำขอต้องได้รับการตรวจสอบเพิ่มเติม กรุณาดำเนินการต่อตามคำตัดสินเดิม",
            503,
          );
        throw new AccountError(
          "อนุมัติกรรมการไม่สำเร็จ กรุณาตรวจข้อกำหนดสิทธิ์เดิมแล้วลองใหม่",
          409,
        );
      }
    }
  }
  const updated = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      registration: {
        ...registration,
        status: decision,
        note: claim.note,
        reviewedAt: new Date().toISOString(),
        reviewedBy: claim.reviewerId,
      },
    },
  });
  if (updated.error)
    throw new AccountError(
      decision === "approved"
        ? "อนุมัติสิทธิ์แล้ว แต่บันทึกสถานะยังไม่ครบ กรุณาดำเนินการต่อหลัง 2 นาที"
        : "บันทึกสถานะยังไม่ครบ กรุณาดำเนินการต่อหลัง 2 นาที",
      503,
    );
  const finished = await admin
    .from("school_registration_requests")
    .update({
      status: decision,
      review_note: claim.note || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "approved")
    .eq("reviewed_at", claimedAt)
    .select("id");
  if (finished.error || !finished.data?.length)
    throw new AccountError(
      "บันทึกคำตัดสินแล้ว แต่สถานะประกอบยังไม่ครบ กรุณาดำเนินการต่อหลัง 2 นาที",
      503,
    );
  return { status: decision };
}
