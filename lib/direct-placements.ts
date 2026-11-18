import type { Award } from "./domain";

/**
 * "Direct placements" mode: an admin can switch a team competition so that the
 * medal table, school medal details and certificates use manually entered
 * ranks 1-3 instead of the bracket/score calculation. The bracket and match
 * scores are never modified. Stored in competitions.registration_policy
 * .directPlacements (no schema change).
 */
export type DirectPlacements = {
  enabled: boolean;
  revision: number;
  first: string[];
  second: string[];
  third: string[];
  updatedBy?: string;
  updatedAt?: string;
};

export type PlacementInput = Pick<
  DirectPlacements,
  "first" | "second" | "third"
>;

export const PLACEMENT_LIMITS = { first: 1, second: 1, third: 4 } as const;

type CompetitionLike = {
  id: string;
  sport: string;
  age_group: string;
  gender: string;
  registration_policy?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const ids = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((x) => typeof x === "string")
    ? (value as string[])
    : null;

export function isDirectPlacementSport(sport: string) {
  return sport !== "กรีฑา";
}

export function emptyPlacements(): DirectPlacements {
  return { enabled: false, revision: 0, first: [], second: [], third: [] };
}

/** Returns null when absent or malformed (malformed data is never trusted). */
export function readDirectPlacements(policy: unknown): DirectPlacements | null {
  const raw = record(policy).directPlacements;
  if (raw === undefined) return null;
  const value = record(raw);
  const first = ids(value.first);
  const second = ids(value.second);
  const third = ids(value.third);
  if (
    typeof value.enabled !== "boolean" ||
    !Number.isSafeInteger(value.revision) ||
    Number(value.revision) < 0 ||
    !first ||
    !second ||
    !third
  )
    return null;
  try {
    normalizePlacements({ first, second, third });
  } catch {
    return null;
  }
  return {
    enabled: value.enabled,
    revision: Number(value.revision),
    first,
    second,
    third,
    ...(typeof value.updatedBy === "string"
      ? { updatedBy: value.updatedBy }
      : {}),
    ...(typeof value.updatedAt === "string"
      ? { updatedAt: value.updatedAt }
      : {}),
  };
}

export function directPlacementsEnabled(competition: CompetitionLike) {
  return (
    isDirectPlacementSport(competition.sport) &&
    readDirectPlacements(competition.registration_policy)?.enabled === true
  );
}

/** Validates shape, limits and duplicates; optionally restricts to known schools. */
export function normalizePlacements(
  input: unknown,
  allowedSchoolIds?: ReadonlySet<string>,
): PlacementInput {
  const value = record(input);
  const result = {} as PlacementInput;
  const seen = new Set<string>();
  for (const key of ["first", "second", "third"] as const) {
    const list = ids(value[key]);
    if (!list) throw new Error("รูปแบบอันดับไม่ถูกต้อง");
    if (list.length > PLACEMENT_LIMITS[key])
      throw new Error(
        key === "third"
          ? "อันดับ 3 เลือกได้ไม่เกิน 4 โรงเรียน"
          : "อันดับ 1 และ 2 เลือกได้อันดับละ 1 โรงเรียน",
      );
    for (const id of list) {
      if (!UUID.test(id)) throw new Error("รหัสโรงเรียนไม่ถูกต้อง");
      if (seen.has(id))
        throw new Error("โรงเรียนเดียวกันอยู่ได้เพียง 1 อันดับ");
      if (allowedSchoolIds && !allowedSchoolIds.has(id))
        throw new Error("โรงเรียนไม่ได้เข้าร่วมรายการนี้");
      seen.add(id);
    }
    result[key] = [...list];
  }
  return result;
}

export function placementAwards(
  competition: CompetitionLike,
  placements: PlacementInput,
): Award[] {
  const event = [competition.sport, competition.age_group, competition.gender]
    .filter(Boolean)
    .join(" · ");
  const awards: Award[] = [];
  for (const [key, medal] of [
    ["first", "gold"],
    ["second", "silver"],
    ["third", "bronze"],
  ] as const)
    for (const school_id of placements[key])
      awards.push({
        id: `${competition.id}:direct:${school_id}:${medal}`,
        event,
        division: competition.age_group,
        gender: competition.gender,
        school_id,
        medal,
        competition_id: competition.id,
      });
  return awards;
}

/**
 * Replaces calculated awards with direct placements for every competition in
 * direct mode, so a competition's medals are never counted from both sources.
 */
export function applyDirectPlacements(
  calculated: Award[],
  competitions: CompetitionLike[],
): Award[] {
  const direct = new Map<string, Award[]>();
  for (const competition of competitions) {
    if (!directPlacementsEnabled(competition)) continue;
    const placements = readDirectPlacements(competition.registration_policy)!;
    direct.set(competition.id, placementAwards(competition, placements));
  }
  if (!direct.size) return calculated;
  return [
    ...calculated.filter(
      (award) => !award.competition_id || !direct.has(award.competition_id),
    ),
    ...[...direct.values()].flat(),
  ];
}
