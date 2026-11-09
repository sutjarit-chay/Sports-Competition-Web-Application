import type { ManagedCompetition } from "./admin-competitions";
import type { Match } from "./domain";

// Presentation only: undated fixtures must never enter result/medal calculations.
export type ScheduleMatch = Match & {
  sourceNumber?: number;
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
        competitionName: c.name,
        fixtureOnly: !match,
      });
    }
  }
  // Preserve legacy matches not represented by management metadata.
  for (const match of actual)
    if (!rows.has(match.id))
      rows.set(match.id, { ...match, fixtureOnly: false });
  return [...rows.values()];
}
