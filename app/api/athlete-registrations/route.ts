import {
  accountAdmin,
  accountError,
  accountJson,
  accountProfile,
  authenticateAccount,
  AccountError,
} from "@/lib/account-server";
import { schoolBody, UUID } from "@/lib/school-storage";
import { assertCompetitionOpen } from "@/lib/competition-reset";
import { readHosted, writeHosted } from "@/lib/hosted";
import type { Athlete } from "@/lib/domain";
export async function POST(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile || !["admin", "school", "school_admin"].includes(profile.role))
      throw new AccountError("ไม่มีสิทธิ์ลงทะเบียนนักกีฬา", 403);
    const body = await schoolBody(request);
    if (
      !Array.isArray(body.athletes) ||
      !body.athletes.length ||
      body.athletes.length > 2000
    )
      throw new AccountError(
        "รายชื่อนักกีฬาไม่ถูกต้อง หรือเกิน 2,000 คนต่อครั้ง",
      );
    const admin = accountAdmin();
    await assertCompetitionOpen(admin);
    const snapshot = await readHosted(admin, true);
    const athletes = body.athletes as Athlete[];
    for (const a of athletes) {
      if (
        !a ||
        typeof a !== "object" ||
        typeof a.id !== "string" ||
        !UUID.test(a.id) ||
        typeof a.school_id !== "string" ||
        !UUID.test(a.school_id) ||
        typeof a.competition_id !== "string" ||
        !UUID.test(a.competition_id) ||
        typeof a.name !== "string" ||
        !a.name.trim() ||
        a.name.length > 200
      )
        throw new AccountError("กรอกชื่อ โรงเรียน และรายการแข่งขันให้ถูกต้อง");
      if (
        profile.role !== "admin" &&
        (!profile.school_id || a.school_id !== profile.school_id)
      )
        throw new AccountError("ลงทะเบียนได้เฉพาะโรงเรียนตนเอง", 403);
      if (a.roster) {
        if (
          typeof a.roster !== "object" ||
          !Array.isArray(a.roster.events) ||
          !a.roster.events.every((event) => typeof event === "string")
        )
          throw new AccountError("รายการกรีฑาในทะเบียนไม่ถูกต้อง");
        a.roster = {
          ruleId: a.roster.ruleId,
          position: a.roster.position,
          events: [...a.roster.events],
        };
      }
      const original = snapshot.rows.registrations.find((r) => r.id === a.id);
      if (
        original &&
        profile.role !== "admin" &&
        original.school_id !== profile.school_id
      )
        throw new AccountError("ไม่มีสิทธิ์แก้ไขทะเบียนโรงเรียนอื่น", 403);
      const competition = snapshot.rows.competitions.find(
        (c) => c.id === a.competition_id,
      );
      if (
        !competition ||
        a.sport !== competition.sport ||
        a.gender !== competition.gender ||
        a.division !== competition.age_group ||
        !snapshot.rows.schools.some((s) => s.id === a.school_id)
      )
        throw new AccountError(
          "ข้อมูลกีฬา เพศ ระดับชั้น หรือโรงเรียนไม่ตรงกับรายการจริง",
        );
    }
    try {
      await writeHosted(admin, snapshot, "athletes", athletes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      throw new AccountError(
        message.startsWith("registrations:")
          ? "บันทึกทะเบียนไม่สำเร็จ กรุณาโหลดข้อมูลใหม่"
          : message || "ข้อมูลนักกีฬาไม่ถูกต้อง",
        message.startsWith("registrations:") ? 503 : 400,
      );
    }
    return accountJson({ ok: true });
  } catch (error) {
    return accountError(error);
  }
}
