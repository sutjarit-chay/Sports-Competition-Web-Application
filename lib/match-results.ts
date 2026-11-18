import { winnerCorrectionError } from "./result-correction";
import {
  allocateMatchStamp,
  normalizedMatchStamp,
  validateSetScores,
} from "./set-scores";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Match } from "./domain";
import { AccountError } from "./account-server";
import { fromBangkokInput, readHosted, writeHosted } from "./hosted";
import {
  performCompetitionAction,
  isEliminationFixture,
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
  }
  let setScores;
  try {
    setScores = validateSetScores(
      input.setScores,
      homeScore,
      awayScore,
      original.sport,
    );
  } catch (error) {
    throw new AccountError(
      error instanceof Error ? error.message : "คะแนนเซตไม่ถูกต้อง",
    );
  }
  const competition = snapshot.rows.competitions.find(
    (c) => c.id === actual.competition_id,
  );
  const management = readManagement(competition?.registration_policy);
  if (
    isEliminationFixture(management, actual.id) &&
    input.status === "finished"
  ) {
    if (homeScore === awayScore)
      throw new AccountError(
        "รอบคัดออกต้องมีผู้ชนะ ไม่สามารถบันทึกผลเสมอ",
        409,
      );
    if (
      ["finished", "confirmed"].includes(actual.status) &&
      actual.home_score! > actual.away_score! !==
        (homeScore as number) > (awayScore as number)
    ) {
      const error = winnerCorrectionError(management, actual.id);
      if (error) throw new AccountError(error, 409);
    }
  }
  const match: Match = {
    ...original,
    setScores,
    starts_at: startsAt,
    venue,
    referee_id: refereeId,
    status: input.status,
    home_score: homeScore == null ? undefined : (homeScore as number),
    away_score: awayScore == null ? undefined : (awayScore as number),
    revision: actual.revision,
  };
  try {
    let matchUpdatedAt: string | undefined;
    if (setScores) {
      let policy = record(competition?.registration_policy);
      let staged = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const version = policy.matchReportsVersion;
        const managementRevision = record(policy.management).revision;
        matchUpdatedAt = allocateMatchStamp(policy.matchReportsStamp);
        const previousEntry = record(record(policy.matchReports)[actual.id]);
        const attempts = previousEntry.updatedAt
          ? { [normalizedMatchStamp(previousEntry.updatedAt)!]: previousEntry }
          : previousEntry;
        const nextPolicy = {
          ...policy,
          matchReportsStamp: matchUpdatedAt,
          matchReportsVersion: (typeof version === "number" ? version : 0) + 1,
          matchReports: {
            ...record(policy.matchReports),
            [actual.id]: {
              ...attempts,
              [matchUpdatedAt]: {
                revision: actual.revision + 1,
                updatedAt: matchUpdatedAt,
                homeScore,
                awayScore,
                sets: setScores,
              },
            },
          },
        };
        let query = client
          .from("competitions")
          .update({ registration_policy: nextPolicy })
          .eq("id", actual.competition_id);
        query =
          version == null
            ? query.is("registration_policy->>matchReportsVersion", null)
            : query.eq("registration_policy->>matchReportsVersion", version);
        query =
          managementRevision == null
            ? query.is("registration_policy->management->>revision", null)
            : query.eq(
                "registration_policy->management->>revision",
                managementRevision,
              );
        const result = await query.select("id");
        if (result.error) throw Error("matches: บันทึกคะแนนเซตไม่สำเร็จ");
        if (result.data?.length) {
          staged = true;
          break;
        }
        const fresh = await client
          .from("competitions")
          .select("registration_policy")
          .eq("id", actual.competition_id)
          .single();
        if (fresh.error || !fresh.data)
          throw Error("matches: โหลดคะแนนเซตไม่สำเร็จ");
        policy = record(fresh.data.registration_policy);
      }
      if (!staged) throw Error("ข้อมูลรายการเปลี่ยนแปลงแล้ว กรุณาลองใหม่");
    }
    await writeHosted(client, snapshot, "matches", [match], { matchUpdatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("matches:"))
      throw new AccountError("บันทึกผลไม่สำเร็จ กรุณาลองใหม่", 503);
    throw new AccountError(message || "บันทึกผลไม่สำเร็จ", 409);
  }
  if (
    input.status === "finished" &&
    isEliminationFixture(
      readManagement(competition?.registration_policy),
      actual.id,
    )
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
