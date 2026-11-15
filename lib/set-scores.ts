export type SetScore = { home: number; away: number };
export const isSetSport = (sport: string) =>
  /วอลเลย์บอล|ตะกร้อ|volleyball|takraw/i.test(sport);
export function validateSetScores(
  raw: unknown,
  homeScore: unknown,
  awayScore: unknown,
  sport: string,
): SetScore[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isSetSport(sport)) throw Error("รายการนี้ไม่รองรับคะแนนรายเซต");
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 3)
    throw Error("กรุณาระบุคะแนน 2 หรือ 3 เซต");
  let home = 0,
    away = 0;
  const sets = raw.map((set): SetScore => {
    if (home === 2 || away === 2)
      throw Error("ไม่สามารถเพิ่มเซตหลังได้ผู้ชนะแล้ว");
    if (!set || typeof set !== "object" || Array.isArray(set))
      throw Error("คะแนนเซตไม่ถูกต้อง");
    const h = set.home,
      a = set.away;
    if (
      ![h, a].every(
        (n) =>
          typeof n === "number" &&
          Number.isSafeInteger(n) &&
          n >= 0 &&
          n <= 999,
      ) ||
      h === a
    )
      throw Error("คะแนนเซตต้องเป็นจำนวนเต็ม 0–999 และไม่เสมอกัน");
    if (h > a) home++;
    else away++;
    return { home: h, away: a };
  });
  if (Math.max(home, away) !== 2 || home !== homeScore || away !== awayScore)
    throw Error("ผลรวมเซตไม่ตรงกับคะแนนการแข่งขัน");
  return sets;
}
/** Compare Postgres/ISO timestamp spellings without discarding microseconds. */
export function normalizedMatchStamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return undefined;
  const fraction = /\.(\d+)(?:Z|[+-]\d\d:?\d\d)$/.exec(value)?.[1] || "";
  return (
    new Date(value).toISOString().slice(0, 19) +
    "." +
    fraction.padEnd(6, "0").slice(0, 6) +
    "Z"
  );
}
export function readSetReport(
  policy: unknown,
  match: {
    id: string;
    revision: number;
    updated_at?: string;
    home_score: number | null;
    away_score: number | null;
  },
  sport: string,
): SetScore[] | undefined {
  const entry = (policy as { matchReports?: Record<string, any> } | null)
    ?.matchReports?.[match.id];
  // Legacy reports stored one record; new reports retain every pending attempt.
  const report = entry?.updatedAt
    ? entry
    : entry?.[normalizedMatchStamp(match.updated_at) || ""];

  if (
    !report ||
    report.revision !== match.revision ||
    !normalizedMatchStamp(match.updated_at) ||
    normalizedMatchStamp(match.updated_at) !==
      normalizedMatchStamp(report.updatedAt) ||
    report.homeScore !== match.home_score ||
    report.awayScore !== match.away_score
  )
    return undefined;
  try {
    return validateSetScores(
      report.sets,
      match.home_score,
      match.away_score,
      sport,
    );
  } catch {
    return undefined;
  }
}

/** Persist this allocation with the policy CAS before using it on the match. */
export function allocateMatchStamp(previous: unknown): string {
  const normalized = normalizedMatchStamp(previous);
  const previousMicros = normalized
    ? BigInt(Date.parse(normalized)) * 1000n + BigInt(normalized.slice(23, 26))
    : 0n;
  const now = BigInt(Date.now()) * 1000n;
  const micros = now > previousMicros ? now : previousMicros + 1n;
  return new Date(Number(micros / 1000n))
    .toISOString()
    .replace(/Z$/, `${String(micros % 1000n).padStart(3, "0")}Z`);
}
