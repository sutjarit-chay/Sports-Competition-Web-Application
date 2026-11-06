import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match } from "./domain";
import { AccountError } from "./account-server";
import { fromBangkokInput, readHosted, writeHosted } from "./hosted";
import { fixturesConflict } from "./admin-competitions";
import {
  performCompetitionAction,
  readManagement,
} from "./production-competitions";
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export async function saveMatchResult(
  client: SupabaseClient,
  raw: unknown,
  actor: { id: string; role: string },
): Promise<{ ok: true; note?: string }> {
  if (!["admin", "recorder", "referee"].includes(actor.role))
    throw new AccountError("ไม่มีสิทธิ์บันทึกผลแข่งขัน", 403);
  const input = record(raw);
  if (typeof input.id !== "string")
    throw new AccountError("ไม่พบคู่แข่งขัน", 404);
  const snapshot = await readHosted(client, false);
  const actual = snapshot.rows.matches.find((m) => m.id === input.id),
    original = snapshot.state.matches.find((m) => m.id === input.id);
  if (!actual || !original) throw new AccountError("ไม่พบคู่แข่งขัน", 404);
  if (actor.role !== "admin" && actual.referee_id !== actor.id)
    throw new AccountError("บันทึกได้เฉพาะคู่ที่ได้รับมอบหมาย", 403);
  for (const field of [
    "id",
    "competition_id",
    "home",
    "away",
    "sport",
    "gender",
    "division",
    "pool",
  ] as const)
    if (input[field] !== original[field])
      throw new AccountError(
        "ไม่สามารถเปลี่ยนทีม รายการ หรือรอบแข่งขันผ่านการบันทึกผล",
        409,
      );
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision !== actual.revision
  )
    throw new AccountError("ผลแข่งขันเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่", 409);
  if (input.status !== "scheduled" && input.status !== "finished")
    throw new AccountError("สถานะผลแข่งขันไม่ถูกต้อง");
  const homeScore = input.home_score,
    awayScore = input.away_score;
  for (const score of [homeScore, awayScore])
    if (
      score !== undefined &&
      score !== null &&
      (typeof score !== "number" || !Number.isSafeInteger(score) || score < 0)
    )
      throw new AccountError("คะแนนต้องเป็นจำนวนเต็มตั้งแต่ 0");
  if (
    input.status === "finished" &&
    (homeScore === undefined ||
      homeScore === null ||
      awayScore === undefined ||
      awayScore === null)
  )
    throw new AccountError("กรุณาระบุคะแนนของทั้งสองทีมก่อนยืนยันผล");
  if (
    ["confirmed", "finished"].includes(actual.status) &&
    input.status !== "finished"
  )
    throw new AccountError("ไม่สามารถยกเลิกผลที่ยืนยันแล้ว", 409);
  const sameReferee =
    (input.referee_id || undefined) === (original.referee_id || undefined);
  const scheduleChanged =
    input.starts_at !== original.starts_at || input.venue !== original.venue;
  if (actor.role !== "admin" && (scheduleChanged || !sameReferee))
    throw new AccountError("กรรมการแก้ไขได้เฉพาะคะแนนและสถานะผลแข่งขัน", 403);
  if (
    ["confirmed", "finished"].includes(actual.status) &&
    (scheduleChanged || !sameReferee)
  )
    throw new AccountError("ไม่สามารถเปลี่ยนโปรแกรมของคู่ที่ยืนยันผลแล้ว", 409);
  let startsAt = original.starts_at,
    venue = original.venue,
    refereeId = original.referee_id;
  if (actor.role === "admin") {
    if (typeof input.starts_at !== "string" || !input.starts_at)
      throw new AccountError("กรุณาระบุวันเวลาแข่งขัน");
    try {
      fromBangkokInput(input.starts_at);
    } catch {
      throw new AccountError("วันเวลาแข่งขันไม่ถูกต้อง");
    }
    if (
      typeof input.venue !== "string" ||
      !input.venue.trim() ||
      input.venue.length > 200
    )
      throw new AccountError("กรุณาระบุสนามแข่งขัน");
    startsAt = input.starts_at;
    venue = input.venue.trim();
    if (!sameReferee) {
      if (
        input.referee_id !== undefined &&
        input.referee_id !== null &&
        typeof input.referee_id !== "string"
      )
        throw new AccountError("บัญชีกรรมการไม่ถูกต้อง");
      refereeId = input.referee_id as string | undefined;
      if (refereeId) {
        const profile = await client
          .from("profiles")
          .select("id,role")
          .eq("id", refereeId)
          .maybeSingle();
        if (profile.error)
          throw new AccountError("ตรวจสอบกรรมการไม่สำเร็จ", 503);
        if (
          !profile.data ||
          !["referee", "recorder"].includes(profile.data.role)
        )
          throw new AccountError("บัญชีนี้ไม่ใช่กรรมการ");
      }
    }
    if (scheduleChanged) {
      const candidate = {
        home: actual.home_school_id,
        away: actual.away_school_id,
        venue,
        startsAt: fromBangkokInput(startsAt)!,
      };
      for (const other of snapshot.rows.matches) {
        if (other.id === actual.id || !other.starts_at) continue;
        if (
          fixturesConflict(candidate, {
            home: other.home_school_id,
            away: other.away_school_id,
            venue: other.venue || "",
            startsAt: new Date(other.starts_at).toISOString(),
          })
        )
          throw new AccountError(
            "วันเวลาซ้ำกับโรงเรียนหรือสนามในโปรแกรมอื่น",
            409,
          );
      }
    }
  }
  const match: Match = {
    ...original,
    starts_at: startsAt,
    venue,
    referee_id: refereeId,
    status: input.status,
    home_score: homeScore == null ? undefined : (homeScore as number),
    away_score: awayScore == null ? undefined : (awayScore as number),
    revision: actual.revision,
  };
  try {
    await writeHosted(client, snapshot, "matches", [match]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("matches:"))
      throw new AccountError("บันทึกผลไม่สำเร็จ กรุณาลองใหม่", 503);
    throw new AccountError(message || "บันทึกผลไม่สำเร็จ", 409);
  }
  const competition = snapshot.rows.competitions.find(
    (c) => c.id === actual.competition_id,
  );
  if (
    input.status === "finished" &&
    readManagement(competition?.registration_policy)?.format === "knockout"
  ) {
    try {
      await performCompetitionAction(
        client,
        { action: "advance", matchId: actual.id },
        actor,
      );
    } catch {
      return {
        ok: true,
        note: "บันทึกผลแล้ว แต่ยังบันทึกคู่ถัดไปไม่สำเร็จ กรุณาให้ผู้ดูแลตรวจสอบสายและโปรแกรมแข่งขัน",
      };
    }
  }
  return { ok: true };
}
