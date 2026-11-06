import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountError } from "./account-server";
import { readHosted, writeHosted, type AthleticsEvent } from "./hosted";
import type { Race } from "./domain";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max = 200) =>
  typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
export async function saveAthleticsResult(
  admin: SupabaseClient,
  input: unknown,
  actor: { id: string; role: string },
) {
  if (!["admin", "referee", "recorder"].includes(actor.role))
    throw new AccountError("ไม่มีสิทธิ์บันทึกผลกรีฑา", 403);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new AccountError("ข้อมูลผลกรีฑาไม่ถูกต้อง");
  const r = input as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    !uuid.test(r.id) ||
    typeof r.athlete_id !== "string" ||
    !uuid.test(r.athlete_id) ||
    !text(r.event) ||
    !["heat", "final"].includes(String(r.stage)) ||
    !Number.isInteger(r.heat) ||
    Number(r.heat) < 1 ||
    Number(r.heat) > 1000 ||
    !["OK", "DNS", "DNF", "DQ"].includes(String(r.status))
  )
    throw new AccountError("ข้อมูลนักกีฬา รายการ รอบ หรือสถานะไม่ถูกต้อง");
  if (
    r.status === "OK" &&
    (typeof r.value !== "number" || !Number.isFinite(r.value) || r.value <= 0)
  )
    throw new AccountError("กรอกผลการแข่งขันที่มากกว่า 0");
  const snapshot = await readHosted(admin, true);
  const athlete = snapshot.state.athletes.find((x) => x.id === r.athlete_id);
  if (
    !athlete ||
    athlete.sport !== "กรีฑา" ||
    athlete.competition_id !== r.competition_id
  )
    throw new AccountError("ไม่พบนักกีฬาที่ลงทะเบียนในรายการกรีฑานี้", 403);
  let event = r.event_id
    ? snapshot.rows.athletics_events.find((x) => x.id === r.event_id)
    : undefined;
  if (r.event_id && !event) throw new AccountError("ไม่พบรายการกรีฑา", 404);
  if (!event) {
    const candidates = snapshot.rows.athletics_events.filter(
      (x) =>
        x.competition_id === r.competition_id &&
        x.name === r.event &&
        x.round === r.stage &&
        x.heat === r.heat,
    );
    if (candidates.length > 1)
      throw new AccountError("มีรายการชื่อซ้ำ กรุณาเลือกรายการให้ชัดเจน");
    event = candidates[0];
  }
  if (
    event &&
    (event.competition_id !== athlete.competition_id ||
      event.name !== r.event ||
      event.round !== r.stage ||
      event.heat !== r.heat)
  )
    throw new AccountError("รายการกรีฑาไม่ตรงกับนักกีฬาหรือรอบ", 409);
  let sourceHeat: AthleticsEvent | undefined = undefined;
  if (actor.role !== "admin") {
    if (event && event.referee_id !== actor.id)
      throw new AccountError(
        "ไม่มีสิทธิ์บันทึกผลรายการที่ไม่ได้รับมอบหมาย",
        403,
      );
    if (!event && r.stage !== "final")
      throw new AccountError(
        "สร้างได้เฉพาะรอบชิงต่อจากฮีตที่ได้รับมอบหมาย",
        403,
      );
    if (r.stage === "final") {
      const heats = snapshot.rows.athletics_events.filter(
        (x) =>
          x.competition_id === athlete.competition_id &&
          x.name === r.event &&
          x.round === "heat" &&
          x.referee_id === actor.id &&
          (!r.source_event_id || x.id === r.source_event_id) &&
          snapshot.rows.athletics_results.some(
            (result) =>
              result.event_id === x.id &&
              result.school_id === athlete.school_id &&
              result.bib === athlete.bib &&
              result.status === "OK" &&
              result.value !== null,
          ),
      );
      const existingFinal =
        event &&
        snapshot.rows.athletics_results.some(
          (result) =>
            result.event_id === event.id &&
            result.school_id === athlete.school_id &&
            result.bib === athlete.bib,
        );
      if (!existingFinal && heats.length !== 1)
        throw new AccountError(
          "นักกีฬาต้องมีผล OK จากฮีตที่ได้รับมอบหมายก่อนส่งเข้ารอบชิง",
          403,
        );
      sourceHeat = heats[0];
    }
  }
  const prior = snapshot.rows.athletics_results.find((x) => x.id === r.id);
  if (
    prior &&
    (!event ||
      prior.event_id !== event.id ||
      prior.school_id !== athlete.school_id ||
      prior.bib !== athlete.bib)
  )
    throw new AccountError("ไม่สามารถเปลี่ยนเจ้าของผลการแข่งขันเดิม", 409);
  let refereeId = event?.referee_id || null;
  if (!event) {
    if (
      !["track", "field"].includes(String(r.kind)) ||
      !["asc", "desc"].includes(String(r.direction)) ||
      !text(r.unit, 20)
    )
      throw new AccountError("ประเภท ทิศทางอันดับ หรือหน่วยไม่ถูกต้อง");
    if (actor.role !== "admin") refereeId = actor.id;
    else if (r.referee_id) {
      if (typeof r.referee_id !== "string" || !uuid.test(r.referee_id))
        throw new AccountError("รหัสกรรมการไม่ถูกต้อง");
      const found = await admin
        .from("profiles")
        .select("id,role")
        .eq("id", r.referee_id)
        .maybeSingle();
      if (
        found.error ||
        !found.data ||
        !["referee", "recorder"].includes(found.data.role)
      )
        throw new AccountError("บัญชีผู้รับผิดชอบไม่ใช่กรรมการ");
      refereeId = r.referee_id;
    }
  }
  const race: Race = {
    id: r.id,
    event: String(r.event).trim(),
    division: athlete.division,
    gender: athlete.gender,
    stage: String(r.stage),
    heat: Number(r.heat),
    athlete_id: athlete.id,
    competition_id: athlete.competition_id,
    event_id: event?.id,
    kind: event?.kind || sourceHeat?.kind || String(r.kind),
    direction: event?.direction || sourceHeat?.direction || String(r.direction),
    unit: event?.unit || sourceHeat?.unit || String(r.unit),
    referee_id: refereeId || undefined,
    status: String(r.status),
    value: r.status === "OK" ? Number(r.value) : null,
    starts_at: typeof r.starts_at === "string" ? r.starts_at : undefined,
    venue: typeof r.venue === "string" ? r.venue : undefined,
  };
  await writeHosted(admin, snapshot, "races", [race]);
}

export async function assignAthleticsReferee(
  admin: SupabaseClient,
  eventId: unknown,
  refereeId: unknown,
  actor: { id: string; role: string },
) {
  if (actor.role !== "admin")
    throw new AccountError("เฉพาะผู้ดูแลระบบเท่านั้นที่มอบหมายกรรมการได้", 403);
  if (
    typeof eventId !== "string" ||
    !uuid.test(eventId) ||
    (refereeId !== null &&
      (typeof refereeId !== "string" || !uuid.test(refereeId)))
  )
    throw new AccountError("รหัสรายการหรือกรรมการไม่ถูกต้อง");
  if (refereeId) {
    const found = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", refereeId)
      .maybeSingle();
    if (
      found.error ||
      !found.data ||
      !["referee", "recorder"].includes(found.data.role)
    )
      throw new AccountError("บัญชีนี้ไม่ใช่กรรมการ");
  }
  const changed = await admin
    .from("athletics_events")
    .update({ referee_id: refereeId })
    .eq("id", eventId)
    .select("id");
  if (changed.error) throw new AccountError("มอบหมายกรรมการไม่สำเร็จ", 503);
  if (!changed.data?.length) throw new AccountError("ไม่พบรายการกรีฑา", 404);
}
