import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountError } from "./account-server";
import type { Award } from "./domain";
import type { Competition } from "./hosted";
import { readDocument, writeDocument } from "./school-storage";
import {
  INITIAL_ATHLETICS_DATA,
  computeFinalsWinners,
  defaultLanes,
  syncQualifiersToFinals,
  type AthleticsRow,
  type LaneEntry,
} from "../components/athletics-scoresheet";

export const ATHLETICS_SCORESHEET_PREFIX = "athletics-scoresheet";

export type AthleticsScoresheetDocument = {
  rows: AthleticsRow[];
  updatedAt: string | null;
  updatedBy?: string | null;
};

export function defaultAthleticsScoresheetDocument(): AthleticsScoresheetDocument {
  return {
    rows: INITIAL_ATHLETICS_DATA.map((row) => ({
      ...row,
      r1: [...row.r1],
      r2: [...row.r2],
      r3: [...row.r3],
      r1Lanes: row.r1Lanes.map((l) => ({ ...l })),
      r2Lanes: row.r2Lanes.map((l) => ({ ...l })),
      r3Lanes: row.r3Lanes.map((l) => ({ ...l })),
      winners: computeFinalsWinners(row.r3Lanes),
    })),
    updatedAt: null,
    updatedBy: null,
  };
}

function cleanText(value: unknown, maxLength = 200): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new AccountError("ข้อความในใบบันทึกกรีฑายาวเกินกำหนด", 400);
  }
  return trimmed;
}

function sanitizeLaneList(
  rawLanes: unknown,
  rawStrings: unknown,
  minCount: number,
  maxCount: number,
): LaneEntry[] {
  const sourceLanes = Array.isArray(rawLanes) ? rawLanes : [];
  const sourceStrings = Array.isArray(rawStrings) ? rawStrings : [];
  const targetLength = Math.max(
    minCount,
    Math.min(maxCount, Math.max(sourceLanes.length, sourceStrings.length, minCount)),
  );

  const fallback = defaultLanes(targetLength);
  const usedRanks = new Set<string>();

  return fallback.map((base, idx) => {
    const raw =
      sourceLanes[idx] && typeof sourceLanes[idx] === "object"
        ? (sourceLanes[idx] as Record<string, unknown>)
        : {};
    const fallbackSchool =
      typeof sourceStrings[idx] === "string" ? sourceStrings[idx] : "";
    const schoolName = cleanText(raw.schoolName ?? fallbackSchool, 200);
    const athleteName = cleanText(raw.athleteName, 200);
    const time = cleanText(raw.time, 50);
    const foulReason = cleanText(raw.foulReason, 200);
    let isFoul = Boolean(raw.isFoul);
    let rank = cleanText(raw.rank, 20).replace(/^ที่\s*/, "");

    if (rank === "DQ") {
      isFoul = true;
    } else if (rank) {
      const num = Number(rank);
      if (!Number.isInteger(num) || num < 1 || num > targetLength) {
        rank = "";
      } else {
        rank = String(num);
      }
    }

    if (isFoul) {
      rank = "DQ";
    } else if (rank && rank !== "DQ") {
      if (usedRanks.has(rank)) {
        rank = "";
      } else {
        usedRanks.add(rank);
      }
    }

    return {
      ...base,
      lane: idx + 1,
      schoolName,
      athleteName,
      time,
      rank,
      isFoul,
      foulReason: isFoul ? foulReason : "",
    };
  });
}

export function validateAthleticsScoresheetRows(input: unknown): AthleticsRow[] {
  if (!Array.isArray(input)) {
    throw new AccountError("รูปแบบข้อมูลใบบันทึกกรีฑาไม่ถูกต้อง", 400);
  }

  const byId = new Map<number, Record<string, unknown>>();
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const id = Number(rec.id);
    if (Number.isInteger(id) && id >= 1 && id <= INITIAL_ATHLETICS_DATA.length) {
      byId.set(id, rec);
    }
  }

  return INITIAL_ATHLETICS_DATA.map((canonical) => {
    const incoming = byId.get(canonical.id);
    if (!incoming) {
      return {
        ...canonical,
        r1: [...canonical.r1],
        r2: [...canonical.r2],
        r3: [...canonical.r3],
        r1Lanes: canonical.r1Lanes.map((l) => ({ ...l })),
        r2Lanes: canonical.r2Lanes.map((l) => ({ ...l })),
        r3Lanes: canonical.r3Lanes.map((l) => ({ ...l })),
        winners: computeFinalsWinners(canonical.r3Lanes),
      };
    }

    const r1Lanes = sanitizeLaneList(incoming.r1Lanes, incoming.r1, 5, 5);
    const r2Lanes = sanitizeLaneList(incoming.r2Lanes, incoming.r2, 5, 5);
    const maxFinalsLanes = canonical.expandableLanes ? 300 : 6;
    const r3Lanes = sanitizeLaneList(
      incoming.r3Lanes,
      incoming.r3,
      6,
      maxFinalsLanes,
    );

    const draftRow: AthleticsRow = {
      ...canonical,
      no: String(canonical.id),
      r1: r1Lanes.map((l) => l.schoolName || ""),
      r2: r2Lanes.map((l) => l.schoolName || ""),
      r3: r3Lanes.map((l) => l.schoolName || ""),
      r1Lanes,
      r2Lanes,
      r3Lanes,
      winners: computeFinalsWinners(r3Lanes),
    };

    const synced = syncQualifiersToFinals(draftRow).row;
    return {
      ...synced,
      winners: computeFinalsWinners(synced.r3Lanes),
    };
  });
}

export async function readAthleticsScoresheet(admin: SupabaseClient): Promise<{
  rows: AthleticsRow[];
  version: string | null;
  updatedAt: string | null;
}> {
  const fallback = defaultAthleticsScoresheetDocument();
  const current = await readDocument<AthleticsScoresheetDocument>(
    admin,
    ATHLETICS_SCORESHEET_PREFIX,
    fallback,
  );
  let rows: AthleticsRow[];
  try {
    rows = validateAthleticsScoresheetRows(current.value?.rows);
  } catch {
    rows = fallback.rows;
  }
  return {
    rows,
    version: current.version,
    updatedAt: current.value?.updatedAt || null,
  };
}

export async function writeAthleticsScoresheet(
  admin: SupabaseClient,
  rowsInput: unknown,
  expectedVersion?: unknown,
  actorId?: string,
): Promise<{
  rows: AthleticsRow[];
  version: string | null;
  updatedAt: string;
}> {
  const rows = validateAthleticsScoresheetRows(rowsInput);
  const updatedAt = new Date().toISOString();
  const payload: AthleticsScoresheetDocument = {
    rows,
    updatedAt,
    updatedBy: actorId || null,
  };
  const fallback = defaultAthleticsScoresheetDocument();

  if (expectedVersion !== undefined) {
    const saved = await writeDocument(
      admin,
      ATHLETICS_SCORESHEET_PREFIX,
      payload,
      expectedVersion,
      fallback,
    );
    return {
      rows: saved.value.rows,
      version: saved.version,
      updatedAt,
    };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await readDocument(
      admin,
      ATHLETICS_SCORESHEET_PREFIX,
      fallback,
    );
    try {
      const saved = await writeDocument(
        admin,
        ATHLETICS_SCORESHEET_PREFIX,
        payload,
        current.version,
        fallback,
      );
      return {
        rows: saved.value.rows,
        version: saved.version,
        updatedAt,
      };
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof AccountError &&
        error.status === 409
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new AccountError(
    "ข้อมูลเปลี่ยนจากอุปกรณ์อื่น กรุณาโหลดหน้าใหม่ก่อนบันทึก",
    409,
  );
}

export function normalizeSchoolNameForMatch(name: string): string {
  if (!name) return "";
  const cleaned = name
    .trim()
    .replace(/^โรงเรียน\s*/, "")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  if (/ท่าคูณ/.test(cleaned)) return "บ้านท่าคูณ";
  if (/วิเศษน้อมมิตร|^บ้านโกสัมพี$/.test(cleaned)) return "บ้านโกสัมพี";
  if (/โละโคะ/.test(cleaned)) return "บ้านโละโคะ";
  if (/มะเดื่อชุมพร/.test(cleaned)) return "บ้านมะเดื่อชุมพร";
  if (/ดงซ่อม|คงซ่อม/.test(cleaned)) return "บ้านดงซ่อม";
  return cleaned;
}

export function matchSchoolByName<T extends { id: string; name: string }>(
  schoolName: string,
  schools: readonly T[],
): T | undefined {
  const target = normalizeSchoolNameForMatch(schoolName);
  if (!target) return undefined;
  return schools.find(
    (s) =>
      s.name === schoolName ||
      normalizeSchoolNameForMatch(s.name) === target,
  );
}

function normalizeBand(grade: string): string {
  return grade
    .trim()
    .replace(/–/g, "-")
    .replace(/^ประถม$/, "ประถมศึกษา")
    .replace(/^มัธยม$/, "มัธยมศึกษา");
}

export function matchAthleticsRowToCompetition(
  row: AthleticsRow,
  competitions: readonly Competition[],
): Competition | undefined {
  const athleticsComps = competitions.filter((c) => c.sport === "กรีฑา");
  if (!athleticsComps.length) return undefined;

  const rowBand = normalizeBand(row.grade);
  const byProgram = athleticsComps.find((c) => {
    if (c.gender !== row.type) return false;
    const policy = (c.registration_policy || {}) as Record<string, unknown>;
    const management = (policy.management || {}) as Record<string, unknown>;
    const program = (management.athleticsProgram || {}) as Record<
      string,
      unknown
    >;
    const slots = Array.isArray(program.slots)
      ? (program.slots as Record<string, unknown>[])
      : [];
    const hasFinalSlot = slots.some(
      (s) =>
        s.stage === "final" && Number(s.sourceNumber) === Number(row.sourceNumber),
    );
    if (!hasFinalSlot) return false;
    if (Number(row.sourceNumber) === 101) {
      const compBand = normalizeBand(
        typeof program.levelBand === "string"
          ? program.levelBand
          : c.age_group,
      );
      return compBand === rowBand;
    }
    return true;
  });
  if (byProgram) return byProgram;

  // Fallback by name + grade + gender
  const cleanEventName = row.name.replace(/^วิ่ง\s+มินิมาราธอน$/, "มินิมาราธอน");
  return athleticsComps.find((c) => {
    if (c.gender !== row.type) return false;
    const normalizedCompName = c.name.replace(/–/g, "-");
    return (
      normalizedCompName.includes(cleanEventName) &&
      (normalizedCompName.includes(row.grade) ||
        normalizeBand(c.age_group) === rowBand)
    );
  });
}

/**
 * แปลงผลการแข่งขันรอบชิงชนะเลิศ (อันดับ 1 = ทอง, 2 = เงิน, 3 = ทองแดง)
 * จากใบบันทึกผลกรีฑา 20 รายการ ให้เป็นรายการ Award สำหรับตารางสรุปเหรียญรางวัลรวมของระบบ
 */
export function athleticsScoresheetAwards(
  rows: readonly AthleticsRow[],
  schools: readonly { id: string; name: string }[],
  competitions: readonly Competition[] = [],
): Award[] {
  const awards: Award[] = [];
  for (const row of rows) {
    const winners = computeFinalsWinners(row.r3Lanes);
    const matchedComp = matchAthleticsRowToCompetition(row, competitions);
    for (const w of winners) {
      if (!w.schoolName) continue;
      const school = matchSchoolByName(w.schoolName, schools);
      if (!school) continue;
      const medal =
        w.rank === 1 ? "gold" : w.rank === 2 ? "silver" : w.rank === 3 ? "bronze" : "";
      if (!medal) continue;
      awards.push({
        id: `athletics-scoresheet:${row.id}:rank-${w.rank}:${school.id}`,
        event: `${row.name} (${row.grade} ${row.type})`,
        division: matchedComp?.age_group || row.grade,
        gender: row.type,
        school_id: school.id,
        medal,
        ...(matchedComp ? { competition_id: matchedComp.id } : {}),
      });
    }
  }
  return awards;
}

export function mergeAthleticsScoresheetAwards(
  calculated: readonly Award[],
  scoresheetAwards: readonly Award[],
): Award[] {
  if (!scoresheetAwards.length) return [...calculated];
  const coveredCompetitionIds = new Set(
    scoresheetAwards
      .map((a) => a.competition_id)
      .filter((id): id is string => Boolean(id)),
  );
  const coveredEvents = new Set(scoresheetAwards.map((a) => a.event));
  return [
    ...calculated.filter((a) => {
      if (a.competition_id && coveredCompetitionIds.has(a.competition_id)) {
        return false;
      }
      if (coveredEvents.has(a.event)) {
        return false;
      }
      return true;
    }),
    ...scoresheetAwards,
  ];
}
