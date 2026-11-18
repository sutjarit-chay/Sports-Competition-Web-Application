import type { AthleticsEvent, AthleticsResult, Competition } from "./hosted";
import { toBangkokInput } from "./hosted";
import { sortCompetitionsByName } from "./competition-order";
import {
  compareScheduleMatches,
  formatProgramDate,
  formatScheduleDate,
  formatSessionDate,
  type ScheduleMatch,
} from "./schedule-view";

export type CompetitionProgressRow = {
  id: string;
  name: string;
  gender: string;
  level: string;
  unit: "คู่/แมตช์" | "ฮีต/รอบ";
  total: number | null;
  completed: number | null;
  remaining: number | null;
  nextLabel: string;
  nextWhen: string;
  note?: string;
  state: "pending" | "active" | "complete" | "recorded";
};
type Input = {
  competitions: Competition[];
  matches: ScheduleMatch[];
  athleticsEvents: AthleticsEvent[];
  athleticsResults: AthleticsResult[];
  schoolName: (id: string) => string;
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const finished = (status: string) =>
  status === "finished" || status === "confirmed";
const athleticsNote =
  "กรีฑานับฮีต/รอบที่มีผลบันทึกแล้ว ไม่ใช่จำนวนรายชื่อและไม่ใช่การยืนยันจบทั้งฮีต";
type Slot = {
  key: string;
  stage: "heat" | "final";
  heat: number;
  number?: number;
  date: string;
  session: string;
  actual?: AthleticsEvent;
};

export function buildCompetitionProgress(
  input: Input,
): CompetitionProgressRow[] {
  return sortCompetitionsByName(input.competitions).map((competition) => {
    const management = object(
      object(competition.registration_policy).management,
    );
    const base: CompetitionProgressRow = {
      id: competition.id,
      name: competition.name,
      gender: competition.gender,
      level: competition.age_group,
      unit: competition.sport === "กรีฑา" ? "ฮีต/รอบ" : "คู่/แมตช์",
      total: null,
      completed: null,
      remaining: null,
      nextLabel: "รอจัดการแข่งขัน",
      nextWhen: "",
      state: "pending",
    };
    if (competition.sport !== "กรีฑา") {
      if (
        management.drawPending === true &&
        (!Array.isArray(management.fixtures) || !management.fixtures.length)
      ) {
        return { ...base, nextLabel: "รอจับสลากและจัดการแข่งขัน" };
      }
      const matches = [
        ...new Map(
          input.matches
            .filter((match) => match.competition_id === competition.id)
            .map((match) => [match.id, match]),
        ).values(),
      ].sort(compareScheduleMatches);
      if (!matches.length)
        return {
          ...base,
          nextLabel:
            management.drawPending === true
              ? "รอจับสลากและจัดการแข่งขัน"
              : base.nextLabel,
        };
      const completed = matches.filter(
        (match) => !match.fixtureOnly && finished(match.status),
      ).length;
      const next = matches.find(
        (match) => match.fixtureOnly || !finished(match.status),
      );
      return {
        ...base,
        total: matches.length,
        completed,
        remaining: matches.length - completed,
        nextLabel: next
          ? `${next.sourceNumber != null ? `คู่ที่ ${next.sourceNumber}` : `สาย ${next.pool}`} · ${input.schoolName(next.home)} พบ ${input.schoolName(next.away)}`
          : "แข่งขันครบแล้ว",
        nextWhen: next ? formatScheduleDate(next) : "",
        state: next ? "active" : "complete",
      };
    }
    const slots = new Map<string, Slot>();
    let ambiguous = false;
    const programmes = Array.isArray(management.athleticsProgram)
      ? management.athleticsProgram
      : [management.athleticsProgram];
    for (const raw of programmes) {
      const programme = object(raw);
      if (!Array.isArray(programme.slots)) continue;
      for (const rawSlot of programme.slots) {
        const slot = object(rawSlot);
        if (
          (slot.stage !== "heat" && slot.stage !== "final") ||
          !Number.isSafeInteger(slot.heat) ||
          Number(slot.heat) < 1
        )
          continue;
        const key = `${slot.stage}:${slot.heat}`;
        if (slots.has(key)) ambiguous = true;
        slots.set(key, {
          key,
          stage: slot.stage,
          heat: Number(slot.heat),
          number: Number.isSafeInteger(slot.sourceNumber)
            ? Number(slot.sourceNumber)
            : undefined,
          date: typeof programme.date === "string" ? programme.date : "",
          session:
            typeof programme.sessionStart === "string"
              ? programme.sessionStart
              : "",
        });
      }
    }
    const events = [
      ...new Map(
        input.athleticsEvents
          .filter((event) => event.competition_id === competition.id)
          .map((event) => [event.id, event]),
      ).values(),
    ];
    for (const event of events) {
      if (
        (event.round !== "heat" && event.round !== "final") ||
        !Number.isSafeInteger(event.heat) ||
        event.heat < 1
      )
        continue;
      const key = `${event.round}:${event.heat}`;
      const previous = slots.get(key);
      if (previous?.actual) ambiguous = true;
      slots.set(key, {
        ...(previous || {
          key,
          stage: event.round,
          heat: event.heat,
          date: "",
          session: "",
        }),
        actual: event,
      });
    }
    if (ambiguous)
      return {
        ...base,
        nextLabel: "มีรายการฮีต/รอบซ้ำ กรุณาตรวจรายการกรีฑา",
        note: athleticsNote,
      };
    if (!slots.size)
      return {
        ...base,
        nextLabel: "รอเปิดฮีต/รอบแข่งขัน",
        note: athleticsNote,
      };
    const recordedIds = new Set(
      input.athleticsResults
        .filter(
          (result) =>
            ["DNS", "DNF", "DQ"].includes(result.status) ||
            (result.status === "OK" &&
              typeof result.value === "number" &&
              Number.isFinite(result.value) &&
              result.value > 0),
        )
        .map((result) => result.event_id),
    );
    const localTime = (slot: Slot) =>
      slot.actual?.starts_at &&
      Number.isFinite(Date.parse(slot.actual.starts_at))
        ? toBangkokInput(slot.actual.starts_at)
        : "";
    const ordered = [...slots.values()].sort(
      (a, b) =>
        (a.date || localTime(a).slice(0, 10) || "9999").localeCompare(
          b.date || localTime(b).slice(0, 10) || "9999",
        ) ||
        (a.number ?? Number.MAX_SAFE_INTEGER) -
          (b.number ?? Number.MAX_SAFE_INTEGER) ||
        localTime(a).localeCompare(localTime(b)) ||
        (a.stage === "heat" ? 0 : 1) - (b.stage === "heat" ? 0 : 1) ||
        a.heat - b.heat,
    );
    const hasResult = (slot: Slot) =>
      !!slot.actual && recordedIds.has(slot.actual.id);
    const completed = ordered.filter(hasResult).length;
    const next = ordered.find((slot) => !hasResult(slot));
    let nextWhen = "";
    if (next) {
      const exact = localTime(next);
      nextWhen = next.date
        ? formatSessionDate(next.date, next.session)
        : exact
          ? `${formatProgramDate(exact.slice(0, 10))} · ${exact.slice(11, 16)} น.`
          : "รอกำหนดเวลา";
    }
    return {
      ...base,
      total: ordered.length,
      completed,
      remaining: ordered.length - completed,
      nextLabel: next
        ? `${next.number != null ? `รายการที่ ${next.number} · ` : ""}${next.stage === "heat" ? "รอบคัดเลือก" : "รอบชิง"} · ฮีต ${next.heat}`
        : "มีผลบันทึกครบทุกฮีต/รอบ",
      nextWhen,
      note: athleticsNote,
      state: next ? "active" : "recorded",
    };
  });
}
