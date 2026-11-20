import type { SupabaseClient } from "@supabase/supabase-js";
import { AccountError } from "./account-server";
import { readDocument, writeDocument } from "./school-storage";
import {
  INITIAL_ATHLETICS_DATA,
  computeFinalsWinners,
  defaultLanes,
  syncQualifiersToFinals,
  type AthleticsRow,
  type LaneEntry,
} from "./athletics-scoresheet-model";

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
  if (expectedVersion === undefined)
    throw new AccountError("กรุณาระบุเวอร์ชันข้อมูลก่อนบันทึก", 400);
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

export {
  athleticsScoresheetAwards, matchAthleticsRowToCompetition, matchSchoolByName,
  mergeAthleticsScoresheetAwards, normalizeSchoolNameForMatch,
} from "./athletics-scoresheet-model";
