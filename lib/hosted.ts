import { readManagement } from "./production-competitions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Athlete, Match, Race, Award, State } from "./domain";
import {
  prepareRoster,
  type RegistrationPolicy,
  type RosterDetails,
} from "./registration";
export type Competition = {
  id: string;
  sport: string;
  name: string;
  age_group: string;
  gender: string;
  win_points: number;
  draw_points: number;
  loss_points: number;
  registration_policy?: RegistrationPolicy | null;
};
export type Registration = {
  id: string;
  school_id: string;
  competition_id: string;
  athlete_name: string;
  bib: string | null;
  roster_details?: RosterDetails | null;
};
export type HostedMatch = {
  id: string;
  competition_id: string;
  group_name: string;
  home_school_id: string;
  away_school_id: string;
  starts_at: string | null;
  venue: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  revision: number;
  referee_id?: string | null;
};
export type AthleticsEvent = {
  id: string;
  competition_id: string;
  name: string;
  kind: string;
  round: string;
  heat: number;
  direction: string;
  unit: string;
  starts_at?: string | null;
  venue?: string | null;
  referee_id?: string | null;
};
export type AthleticsResult = {
  id: string;
  event_id: string;
  school_id: string;
  bib: string;
  value: number | null;
  status: string;
};
export type Medal = {
  id: string;
  competition_id: string;
  school_id: string;
  award: string;
  event_label: string;
};
export type HostedRows = {
  schools: State["schools"];
  competitions: Competition[];
  registrations: Registration[];
  matches: HostedMatch[];
  athletics_events: AthleticsEvent[];
  athletics_results: AthleticsResult[];
  medals: Medal[];
};
export type Snapshot = {
  rows: HostedRows;
  state: State;
  registrationExtension?: boolean;
};
export const COLUMNS = {
  schools: "id,name",
  competitions:
    "id,sport,name,age_group,gender,win_points,draw_points,loss_points",
  registrations: "id,school_id,competition_id,athlete_name,bib",
  matches:
    "id,competition_id,group_name,home_school_id,away_school_id,starts_at,venue,status,home_score,away_score,revision,referee_id",
  athletics_events:
    "id,competition_id,name,kind,round,heat,direction,unit,starts_at,venue,referee_id",
  athletics_results: "id,event_id,school_id,bib,value,status",
  medals: "id,competition_id,school_id,award,event_label",
} as const;
const LEGACY_MATCH_COLUMNS =
  "id,competition_id,group_name,home_school_id,away_school_id,starts_at,venue,status,home_score,away_score,revision";
export function normalizedRaceDirection(value: string): "asc" | "desc" {
  if (value === "lower" || value === "asc") return "asc";
  if (value === "higher" || value === "desc") return "desc";
  throw Error("ทิศทางอันดับกรีฑาในฐานข้อมูลไม่ถูกต้อง");
}
export function storedRaceDirection(value: string): "lower" | "higher" {
  return normalizedRaceDirection(value) === "asc" ? "lower" : "higher";
}
export function toBangkokInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime()))
    throw Error("วันเวลาในฐานข้อมูลไม่ถูกต้อง");
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function fromBangkokInput(value: string) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error("รูปแบบวันเวลาไม่ถูกต้อง");
  const d = new Date(value + ":00+07:00");
  if (
    !Number.isFinite(d.getTime()) ||
    toBangkokInput(d.toISOString()) !== value
  )
    throw Error("วันเวลาไม่ถูกต้อง");
  return d.toISOString();
}
export function findCompetition(
  competitions: Competition[],
  value: {
    sport: string;
    division: string;
    gender: string;
    competition_id?: string;
  },
) {
  const found = competitions.filter((c) =>
    value.competition_id
      ? c.id === value.competition_id
      : c.sport === value.sport &&
        c.age_group === value.division &&
        c.gender === value.gender,
  );
  if (found.length !== 1)
    throw Error(
      "ไม่พบรายการแข่งขันที่ตรงกัน หรือมีหลายรายการ กรุณาเลือกรายการ",
    );
  return found[0];
}
export function decodeHosted(rows: HostedRows): State {
  const competitions = new Map(rows.competitions.map((c) => [c.id, c]));
  const c = (id: string) => {
    const row = competitions.get(id);
    if (!row) throw Error("ข้อมูลอ้างถึงรายการแข่งขันที่ไม่มีสิทธิ์อ่าน");
    return row;
  };
  const scope = (id: string) => ({
    sport: c(id).sport,
    division: c(id).age_group,
    gender: c(id).gender,
    competition_id: id,
  });
  const athletes = rows.registrations.map((r) => ({
    id: r.id,
    name: r.athlete_name,
    school_id: r.school_id,
    bib: r.bib || undefined,
    ...(r.roster_details ? { roster: r.roster_details } : {}),
    ...scope(r.competition_id),
  }));
  const events = new Map(rows.athletics_events.map((e) => [e.id, e]));
  return {
    schools: rows.schools,
    athletes,
    matches: rows.matches.map((m) => ({
      id: m.id,
      ...scope(m.competition_id),
      pool: m.group_name,
      home: m.home_school_id,
      away: m.away_school_id,
      starts_at: toBangkokInput(m.starts_at),
      venue: m.venue || "",
      status: m.status === "confirmed" ? "finished" : m.status,
      home_score: m.home_score ?? undefined,
      away_score: m.away_score ?? undefined,
      revision: m.revision,
      referee_id: m.referee_id || undefined,
    })),
    races: rows.athletics_results.map((r) => {
      const e = events.get(r.event_id);
      if (!e) throw Error("ข้อมูลผลกรีฑาอ้างถึงรายการที่ไม่มีสิทธิ์อ่าน");
      const candidates = athletes.filter(
        (a) =>
          a.competition_id === e.competition_id &&
          a.school_id === r.school_id &&
          !!r.bib &&
          a.bib === r.bib,
      );
      return {
        id: r.id,
        event: e.name,
        ...scope(e.competition_id),
        stage: e.round,
        heat: e.heat,
        athlete_id: candidates.length === 1 ? candidates[0].id : "",
        value: r.value === null ? null : Number(r.value),
        status: r.status,
        event_id: e.id,
        school_id: r.school_id,
        bib: r.bib,
        direction: normalizedRaceDirection(e.direction),
        unit: e.unit,
        kind: e.kind,
      };
    }),
    awards: rows.medals
      .filter((a) => competitions.has(a.competition_id))
      .map((a) => ({
        id: a.id,
        ...scope(a.competition_id),
        event: a.event_label,
        school_id: a.school_id,
        medal: a.award,
      })),
  };
}
export function matchPayload(m: Match, competitionId: string) {
  return {
    id: m.id,
    competition_id: competitionId,
    group_name: m.pool,
    home_school_id: m.home,
    away_school_id: m.away,
    starts_at: fromBangkokInput(m.starts_at),
    venue: m.venue,
    status: m.status === "confirmed" ? "finished" : m.status,
    home_score: m.home_score ?? null,
    away_score: m.away_score ?? null,
    referee_id: m.referee_id || null,
  };
}
export function raceResultPayload(
  r: Race,
  athletes: Athlete[],
  eventId: string,
) {
  const a = athletes.find((a) => a.id === r.athlete_id);
  if (!a?.bib?.trim()) throw Error("นักกีฬาต้องมี bib ก่อนบันทึกผล");
  if (r.competition_id && a.competition_id !== r.competition_id)
    throw Error("นักกีฬาไม่ได้ลงทะเบียนรายการนี้");
  const matches = athletes.filter(
    (x) =>
      x.competition_id === a.competition_id &&
      x.school_id === a.school_id &&
      x.bib === a.bib,
  );
  if (matches.length !== 1) throw Error("bib ซ้ำในโรงเรียนและรายการแข่งขัน");
  return {
    id: r.id,
    event_id: eventId,
    school_id: a.school_id,
    bib: a.bib,
    value: r.status === "OK" ? r.value : null,
    status: r.status,
  };
}
export async function readHosted(
  client: SupabaseClient,
  includeRegistrations: boolean,
): Promise<Snapshot> {
  const read = async (table: keyof HostedRows) => {
    const all: unknown[] = [];
    let columns: string = COLUMNS[table];
    while (true) {
      const { data, error, count } = await client
        .from(table)
        .select(columns, { count: "exact" })
        .order("id")
        .range(all.length, all.length + 499);
      if (error) {
        if (
          table === "matches" &&
          columns !== LEGACY_MATCH_COLUMNS &&
          ["42703", "PGRST204"].includes(error.code) &&
          error.message.includes("referee_id")
        ) {
          columns = LEGACY_MATCH_COLUMNS;
          all.length = 0;
          continue;
        }
        throw Error(`${table}: ${error.message}`);
      }
      if (!data) throw Error(`${table}: ไม่มีข้อมูลตอบกลับ`);
      all.push(...data);
      if ((count !== null && all.length >= count) || data.length === 0) break;
    }
    return all;
  };
  const entries = await Promise.all(
    (Object.keys(COLUMNS) as (keyof HostedRows)[]).map(async (t) => [
      t,
      t === "registrations" && !includeRegistrations ? [] : await read(t),
    ]),
  );
  const rows = Object.fromEntries(entries) as HostedRows;
  rows.athletics_events = rows.athletics_events.map((event) => ({
    ...event,
    direction: normalizedRaceDirection(event.direction),
  }));
  const extension = await readRosterExtension(client, includeRegistrations);
  if (extension.available) {
    rows.competitions.forEach((c) => {
      c.registration_policy = extension.policies.get(c.id) || null;
    });
    rows.registrations.forEach((r) => {
      r.roster_details = extension.details.get(r.id) || null;
    });
  }
  return {
    rows,
    state: decodeHosted(rows),
    registrationExtension: extension.available,
  };
}
async function readRosterExtension(
  client: SupabaseClient,
  includeRegistrations: boolean,
) {
  const policies = new Map<string, RegistrationPolicy>();
  const details = new Map<string, RosterDetails>();
  for (const [table, column] of [
    ["competitions", "registration_policy"],
    ["registrations", "roster_details"],
  ] as const) {
    if (table === "registrations" && !includeRegistrations) continue;
    let offset = 0;
    while (true) {
      const { data, error, count } = await client
        .from(table)
        .select(`id,${column}`, { count: "exact" })
        .order("id")
        .range(offset, offset + 499);
      if (error) {
        if (
          ["42703", "PGRST204"].includes(error.code) &&
          error.message.includes(column)
        )
          return { available: false, policies, details };
        throw Error(`${table}: ${error.message}`);
      }
      for (const row of (data || []) as unknown as Record<string, unknown>[]) {
        // Old API fixtures/backends must never be mistaken for migrated schemas.
        if (!(column in row)) return { available: false, policies, details };
        if (row[column]) {
          if (table === "competitions")
            policies.set(String(row.id), row[column] as RegistrationPolicy);
          else details.set(String(row.id), row[column] as RosterDetails);
        }
      }
      offset += data?.length || 0;
      if (!data?.length || (count !== null && offset >= count)) break;
    }
  }
  return { available: true, policies, details };
}
export async function writeRegistrationPolicy(
  client: SupabaseClient,
  competitionId: string,
  policy: RegistrationPolicy,
) {
  const { data, error } = await client
    .from("competitions")
    .update({ registration_policy: policy })
    .eq("id", competitionId)
    .select("id");
  if (error) throw Error(`ตั้งค่ากติกาไม่สำเร็จ: ${error.message}`);
  if (!data?.length)
    throw Error(
      "ไม่มีสิทธิ์ตั้งค่ารายการแข่งขันนี้ กรุณาติดต่อผู้ดูแลฐานข้อมูล",
    );
}
export async function writeAthleticsReferee(
  client: SupabaseClient,
  eventId: string,
  refereeId: string | null,
) {
  const { data, error } = await client
    .from("athletics_events")
    .update({ referee_id: refereeId })
    .eq("id", eventId)
    .select("id");
  if (error) throw Error(`มอบหมายกรรมการไม่สำเร็จ: ${error.message}`);
  if (!data?.length) throw Error("ไม่มีสิทธิ์มอบหมายกรรมการรายการนี้");
}
async function checked<T>(
  request: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string,
) {
  const res = await request;
  if (res.error) throw Error(`${label}: ${res.error.message}`);
  return res.data;
}
export async function writeHosted<K extends keyof State>(
  client: SupabaseClient,
  snapshot: Snapshot,
  table: K,
  values: State[K],
) {
  const rows = snapshot.rows,
    state = snapshot.state;
  if (!values.length) return;
  if (table === "schools") {
    for (const s of values as State["schools"]) {
      const updated = await checked(
        client
          .from("schools")
          .update({ name: s.name })
          .eq("id", s.id)
          .select("id"),
        "schools",
      );
      if (!updated?.length) throw Error("ไม่มีสิทธิ์แก้โรงเรียนนี้");
    }
    return;
  }
  if (table === "athletes") {
    const groups = new Map<string, Athlete[]>();
    for (const a of values as Athlete[]) {
      const comp = findCompetition(rows.competitions, a);
      groups.set(comp.id, [...(groups.get(comp.id) || []), a]);
    }
    const validated = [...groups].flatMap(([id, athletes]) => {
      const policy = rows.competitions.find(
        (c) => c.id === id,
      )?.registration_policy;
      if (policy) return prepareRoster(state.athletes, athletes, policy);
      if (
        athletes.some(
          (a) => a.roster || !rows.registrations.some((r) => r.id === a.id),
        )
      )
        throw Error(
          "ผู้ดูแลยังไม่ได้ตั้งค่ากติกาของรายการนี้ หรือต้องติดตั้ง migration ก่อน",
        );
      return athletes;
    });
    const payload = validated.map((a) => {
      const comp = findCompetition(rows.competitions, a);
      const bib = a.bib?.trim() || a.id;
      if (
        state.athletes.some(
          (x) =>
            x.id !== a.id &&
            x.school_id === a.school_id &&
            x.competition_id === comp.id &&
            x.bib === bib,
        )
      )
        throw Error("bib ซ้ำในรายการแข่งขัน");
      return {
        id: a.id,
        competition_id: comp.id,
        school_id: a.school_id,
        athlete_name: a.name,
        bib,
        ...(a.roster ? { roster_details: a.roster } : {}),
      };
    });
    const keys = payload.map(
      (p) => `${p.school_id}|${p.competition_id}|${p.bib}`,
    );
    if (new Set(keys).size !== keys.length) throw Error("bib ซ้ำในไฟล์นำเข้า");
    const inserts = payload.filter(
      (p) => !rows.registrations.some((r) => r.id === p.id),
    );
    const updates = payload.filter((p) =>
      rows.registrations.some((r) => r.id === p.id),
    );
    if (updates.length && (updates.length !== 1 || inserts.length))
      throw Error("กรุณาแก้ไขนักกีฬาทีละคน แยกจากการเพิ่มรายชื่อใหม่");
    for (const p of updates) {
      const original = rows.registrations.find((r) => r.id === p.id)!;
      if (
        original.competition_id !== p.competition_id ||
        original.school_id !== p.school_id
      )
        throw Error(
          "ไม่สามารถย้ายทะเบียนไปโรงเรียนหรือรายการอื่นผ่านการแก้ไขชื่อ",
        );
      const updated = await checked(
        client
          .from("registrations")
          .update({ athlete_name: p.athlete_name, bib: p.bib })
          .eq("id", p.id)
          .eq("school_id", original.school_id)
          .eq("competition_id", original.competition_id)
          .select("id"),
        "registrations",
      );
      if (!updated?.length)
        throw Error("ไม่มีสิทธิ์แก้ไขทะเบียนนี้ หรือข้อมูลถูกลบแล้ว");
    }
    if (inserts.length)
      await checked(
        client.from("registrations").insert(inserts),
        "registrations",
      );
    return;
  }
  if (table === "matches") {
    const inserts: ReturnType<typeof matchPayload>[] = [];
    for (const m of values as Match[]) {
      if (!m.starts_at) throw Error("กรุณากำหนดวันเวลาแข่งขันก่อนบันทึก");
      if (!m.venue.trim()) throw Error("กรุณากำหนดสนามแข่งขันก่อนบันทึก");
      const payload = matchPayload(m, findCompetition(rows.competitions, m).id);
      const existing = rows.matches.find((x) => x.id === m.id);
      if (!existing) {
        inserts.push(payload);
        continue;
      }
      const management = readManagement(
        rows.competitions.find((c) => c.id === existing.competition_id)
          ?.registration_policy,
      );
      if (management?.format === "knockout") {
        if (
          ["finished", "confirmed"].includes(payload.status) &&
          payload.home_score === payload.away_score
        )
          throw Error("รอบคัดออกต้องมีผู้ชนะ ไม่สามารถบันทึกผลเสมอ");
        if (["finished", "confirmed"].includes(existing.status)) {
          const oldWinner =
            existing.home_score! > existing.away_score!
              ? existing.home_school_id
              : existing.away_school_id;
          const newWinner =
            payload.home_score! > payload.away_score!
              ? payload.home_school_id
              : payload.away_school_id;
          if (
            !["finished", "confirmed"].includes(payload.status) ||
            payload.home_school_id !== existing.home_school_id ||
            payload.away_school_id !== existing.away_school_id ||
            oldWinner !== newWinner
          )
            throw Error(
              "ไม่สามารถเปลี่ยนผู้ชนะของผลคัดออกที่ยืนยันแล้ว กรุณาติดต่อผู้จัดการแข่งขันเพื่อตรวจสอบสาย",
            );
        }
      }
      if (!Number.isInteger(m.revision))
        throw Error("กรุณาโหลดตารางแข่งขันใหม่ก่อนแก้ไข");
      const { id, ...patch } = payload;
      const updated = await checked(
        client
          .from("matches")
          .update({ ...patch, revision: m.revision! + 1 })
          .eq("id", id)
          .eq("revision", m.revision)
          .select("id"),
        "matches",
      );
      if (!updated?.length)
        throw Error(
          "ผลแข่งขันถูกแก้ไขแล้ว หรือไม่มีสิทธิ์ กรุณาโหลดข้อมูลใหม่",
        );
    }
    if (inserts.length)
      await checked(client.from("matches").insert(inserts), "matches");
    return;
  }
  if (table === "awards") {
    const payload = (values as Award[]).map((a) => {
      const candidates = rows.competitions.filter((c) =>
        a.competition_id
          ? c.id === a.competition_id
          : c.age_group === a.division && c.gender === a.gender,
      );
      if (candidates.length !== 1)
        throw Error("กรุณาเลือกรายการแข่งขันสำหรับเหรียญ");
      return {
        id: a.id,
        competition_id: candidates[0].id,
        school_id: a.school_id,
        award: a.medal,
        event_label: a.event,
      };
    });
    await checked(client.from("medals").insert(payload), "medals");
    return;
  }
  if (table === "races") {
    for (const r of values as Race[]) {
      const athlete = state.athletes.find((a) => a.id === r.athlete_id);
      if (!athlete) throw Error("ไม่พบนักกีฬาในทะเบียนที่มีสิทธิ์อ่าน");
      const competition = findCompetition(rows.competitions, {
        ...athlete,
        sport: "กรีฑา",
        competition_id: r.competition_id || athlete.competition_id,
      });
      if (competition.sport !== "กรีฑา")
        throw Error("นักกีฬาไม่ได้ลงทะเบียนกรีฑา");
      const candidates = rows.athletics_events.filter((e) =>
        r.event_id
          ? e.id === r.event_id
          : e.competition_id === competition.id &&
            e.name === r.event &&
            e.round === r.stage &&
            e.heat === r.heat,
      );
      if (candidates.length > 1)
        throw Error("รายการกรีฑาซ้ำ กรุณาเลือก ID รายการที่ต้องการ");
      let event = candidates[0];
      if (
        event &&
        (event.competition_id !== competition.id ||
          event.round !== r.stage ||
          event.heat !== r.heat)
      )
        throw Error("รายการกรีฑาไม่ตรงกับรุ่นหรือรอบ");
      // Validate identity before creating an event, so missing bib cannot leave an empty event.
      const eventId = event?.id || crypto.randomUUID();
      const payload = raceResultPayload(
        { ...r, competition_id: competition.id },
        state.athletes,
        eventId,
      );
      if (!event) {
        if (!r.starts_at)
          throw Error("กรุณากำหนดวันเวลารายการกรีฑาใหม่ก่อนบันทึก");
        if (!r.venue?.trim())
          throw Error("กรุณากำหนดสนามรายการกรีฑาใหม่ก่อนบันทึก");
        event = {
          id: eventId,
          competition_id: competition.id,
          name: r.event,
          kind: r.kind || "track",
          round: r.stage,
          heat: r.heat,
          direction: storedRaceDirection(r.direction || "asc"),
          unit: r.unit || "s",
          starts_at: fromBangkokInput(r.starts_at),
          venue: r.venue.trim(),
          referee_id: r.referee_id || null,
        };
        await checked(
          client.from("athletics_events").insert(event),
          "athletics_events",
        );
        rows.athletics_events.push(event);
      }
      const existing = rows.athletics_results.find(
        (x) =>
          x.id === r.id ||
          (x.event_id === eventId &&
            x.school_id === payload.school_id &&
            x.bib === payload.bib),
      );
      if (existing) {
        if (
          existing.event_id !== eventId ||
          existing.school_id !== payload.school_id ||
          existing.bib !== payload.bib
        )
          throw Error("ห้ามเปลี่ยนตัวนักกีฬาในผลเดิม");
        const updated = await checked(
          client
            .from("athletics_results")
            .update({ value: payload.value, status: payload.status })
            .eq("id", existing.id)
            .select("id"),
          "athletics_results",
        );
        if (!updated?.length) throw Error("ไม่มีสิทธิ์แก้ผลกรีฑานี้");
      } else
        await checked(
          client.from("athletics_results").insert(payload),
          "athletics_results",
        );
    }
    return;
  }
}
