import type { ManagedCompetition } from "./admin-competitions";
import type { Match } from "./domain";

// Presentation only: undated fixtures must never enter result/medal calculations.
export type ScheduleMatch = Match & {
  sourceNumber?: number;
  competitionDate?: string;
  sessionStart?: string;
  timeMode?: "session";
  competitionName?: string;
  fixtureOnly?: boolean;
};
export function buildScheduleMatches(
  competitions: ManagedCompetition[],
  actual: Match[],
): ScheduleMatch[] {
  const persisted = new Map(actual.map((match) => [match.id, match]));
  const rows = new Map<string, ScheduleMatch>();
  for (const c of competitions) {
    for (const f of c.fixtures) {
      const match = persisted.get(f.id);
      rows.set(f.id, {
        id: f.id,
        competition_id: c.id,
        sport: c.sport,
        division: c.ageGroup,
        gender: c.gender,
        pool: f.round,
        home: f.resolvedHome || f.home,
        away: f.resolvedAway || f.away,
        starts_at: f.startsAt,
        venue: f.venue,
        referee_id: f.referee_id,
        status: "pending",
        format: c.format,
        phase: f.phase,
        ...match,
        sourceNumber: f.sourceNumber,
        competitionDate: f.competitionDate,
        sessionStart: f.sessionStart,
        timeMode: f.timeMode,
        competitionName: c.name,
        fixtureOnly: !match,
      });
    }
  }
  // Preserve legacy matches not represented by management metadata.
  for (const match of actual)
    if (!rows.has(match.id))
      rows.set(match.id, { ...match, fixtureOnly: false });
  return [...rows.values()].sort(compareScheduleMatches);
}

const MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

export function formatProgramDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value || "รอกำหนดวัน";
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${Number(year) + 543}`;
}

export function formatSessionDate(date: string, sessionStart?: string) {
  return `${formatProgramDate(date)}${sessionStart ? ` · เริ่ม ${sessionStart} น. เป็นต้นไป` : ""}`;
}

export function formatScheduleDate(match: ScheduleMatch) {
  if (match.timeMode === "session" && match.competitionDate)
    return formatSessionDate(match.competitionDate, match.sessionStart);
  const timestamp = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(match.starts_at);
  return timestamp
    ? `${formatProgramDate(timestamp[1])} · ${timestamp[2]} น.`
    : match.starts_at || "รอกำหนดเวลา";
}

export function compareScheduleMatches(a: ScheduleMatch, b: ScheduleMatch) {
  return (
    (a.competitionDate || a.starts_at.slice(0, 10) || "9999").localeCompare(
      b.competitionDate || b.starts_at.slice(0, 10) || "9999",
    ) ||
    (a.sourceNumber ?? Number.MAX_SAFE_INTEGER) -
      (b.sourceNumber ?? Number.MAX_SAFE_INTEGER) ||
    (a.competitionName || "").localeCompare(b.competitionName || "", "th") ||
    a.starts_at.localeCompare(b.starts_at) ||
    a.id.localeCompare(b.id)
  );
}
