import {
  accountAdmin,
  accountBody,
  accountError,
  accountJson,
  accountProfile,
  authenticateAccount,
  AccountError,
} from "@/lib/account-server";
import { assertCompetitionOpen } from "@/lib/competition-reset";
import {
  isDirectPlacementSport,
  normalizePlacements,
  readDirectPlacements,
  emptyPlacements,
  type DirectPlacements,
} from "@/lib/direct-placements";
import { readManagement } from "@/lib/production-competitions";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Admins switch the mode; admins and referees record ranks 1-3. Bracket and
// match scores are never read or modified here. Writes use a compare-and-swap
// on directPlacements.revision so concurrent editors cannot overwrite each other.
export async function POST(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile || !["admin", "recorder", "referee"].includes(profile.role))
      throw new AccountError("ไม่มีสิทธิ์บันทึกอันดับ", 403);
    const body = await accountBody(request);
    const action = body.action;
    if (action !== "mode" && action !== "placements")
      throw new AccountError("คำสั่งไม่ถูกต้อง", 400);
    if (action === "mode" && profile.role !== "admin")
      throw new AccountError("เฉพาะผู้ดูแลเท่านั้นที่เปลี่ยนโหมดได้", 403);
    if (
      typeof body.competitionId !== "string" ||
      !uuid.test(body.competitionId)
    )
      throw new AccountError("รายการแข่งขันไม่ถูกต้อง", 400);
    if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0)
      throw new AccountError("ข้อมูลเวอร์ชันไม่ถูกต้อง", 400);

    const admin = accountAdmin();
    await assertCompetitionOpen(admin);
    const found = await admin
      .from("competitions")
      .select("id,sport,registration_policy")
      .eq("id", body.competitionId)
      .maybeSingle();
    if (found.error) throw new AccountError("โหลดรายการไม่สำเร็จ", 503);
    if (!found.data) throw new AccountError("ไม่พบรายการแข่งขัน", 404);
    if (!isDirectPlacementSport(found.data.sport))
      throw new AccountError(
        "โหมดผลอันดับโดยตรงใช้กับกีฬาประเภททีมเท่านั้น",
        400,
      );

    const policy = (found.data.registration_policy || {}) as Record<
      string,
      unknown
    >;
    const raw = policy.directPlacements;
    const current = readDirectPlacements(policy);
    if (raw !== undefined && !current)
      throw new AccountError(
        "ข้อมูลอันดับเดิมไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ",
        409,
      );
    if (body.revision !== (current?.revision ?? 0))
      throw new AccountError("ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่", 409);

    const base: DirectPlacements = current || emptyPlacements();
    let next: DirectPlacements;
    if (action === "mode") {
      if (typeof body.enabled !== "boolean")
        throw new AccountError("โหมดไม่ถูกต้อง", 400);
      next = { ...base, enabled: body.enabled };
    } else {
      if (!base.enabled)
        throw new AccountError("ผู้ดูแลต้องเปิดโหมดผลอันดับโดยตรงก่อน", 409);
      const [registrations, matches] = await Promise.all([
        admin
          .from("registrations")
          .select("school_id")
          .eq("competition_id", body.competitionId),
        admin
          .from("matches")
          .select("home_school_id,away_school_id")
          .eq("competition_id", body.competitionId),
      ]);
      if (registrations.error || matches.error)
        throw new AccountError("โหลดโรงเรียนที่เข้าร่วมไม่สำเร็จ", 503);
      const allowed = new Set<string>([
        ...(readManagement(policy)?.teams || []),
        ...(registrations.data || []).map((r) => r.school_id as string),
        ...(matches.data || []).flatMap((m) => [
          m.home_school_id as string,
          m.away_school_id as string,
        ]),
      ]);
      let placements;
      try {
        placements = normalizePlacements(body, allowed);
      } catch (error) {
        throw new AccountError((error as Error).message, 400);
      }
      next = { ...base, ...placements };
    }
    next = {
      ...next,
      revision: base.revision + 1,
      updatedBy: user.id,
      updatedAt: new Date().toISOString(),
    };

    let query = admin
      .from("competitions")
      .update({ registration_policy: { ...policy, directPlacements: next } })
      .eq("id", body.competitionId);
    query = current
      ? query.eq(
          "registration_policy->directPlacements->>revision",
          String(current.revision),
        )
      : query.is("registration_policy->directPlacements->>revision", null);
    const result = await query.select("id");
    if (result.error) throw new AccountError("บันทึกอันดับไม่สำเร็จ", 503);
    if (!result.data?.length)
      throw new AccountError("ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่", 409);
    return accountJson({ ok: true, directPlacements: next });
  } catch (error) {
    return accountError(error);
  }
}
