import Papa from "papaparse";
import { roundRobin, SPORTS } from "./domain";

export type CompetitionFormat = "knockout" | "round_robin";

export type ManagedFixture = {
  id: string;
  round: string;
  home: string;
  away: string;
  startsAt: string;
  venue: string;
  referee_id?: string;
};

export type ManagedCompetition = {
  id: string;
  name: string;
  sport: string;
  ageGroup: string;
  gender: string;
  details: string;
  starters: number;
  reserves: number;
  teamLimit: number;
  format: CompetitionFormat;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  teams: string[];
  fixtures: ManagedFixture[];
};

export function isManagedCompetition(
  value: unknown,
): value is ManagedCompetition {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const competition = value as Record<string, unknown>;
  return (
    typeof competition.id === "string" &&
    typeof competition.name === "string" &&
    typeof competition.sport === "string" &&
    typeof competition.ageGroup === "string" &&
    typeof competition.gender === "string" &&
    typeof competition.details === "string" &&
    Number.isInteger(competition.starters) &&
    Number.isInteger(competition.reserves) &&
    Number.isInteger(competition.teamLimit) &&
    (competition.format === "knockout" ||
      competition.format === "round_robin") &&
    Number.isInteger(competition.winPoints) &&
    Number.isInteger(competition.drawPoints) &&
    Number.isInteger(competition.lossPoints) &&
    Array.isArray(competition.teams) &&
    competition.teams.every((team) => typeof team === "string") &&
    new Set(competition.teams).size === competition.teams.length &&
    Array.isArray(competition.fixtures) &&
    competition.fixtures.every((fixture) => {
      if (typeof fixture !== "object" || fixture === null) return false;
      const item = fixture as Record<string, unknown>;
      return (
        typeof item.id === "string" &&
        typeof item.round === "string" &&
        typeof item.home === "string" &&
        typeof item.away === "string" &&
        typeof item.startsAt === "string" &&
        typeof item.venue === "string" &&
        (item.referee_id === undefined || typeof item.referee_id === "string")
      );
    })
  );
}

export type CompetitionCsvRow = Omit<
  ManagedCompetition,
  "id" | "teams" | "fixtures"
>;
export type TeamCsvRow = { competition: string; school: string };
export type FixtureCsvRow = {
  competition: string;
  round: string;
  home: string;
  away: string;
  startsAt: string;
  venue: string;
};

export function fixturesConflict(
  first: Pick<ManagedFixture, "home" | "away" | "startsAt" | "venue">,
  second: Pick<ManagedFixture, "home" | "away" | "startsAt" | "venue">,
) {
  if (!first.startsAt || first.startsAt !== second.startsAt) return false;
  const firstTeams = [first.home, first.away].filter(
    (team) => team && !team.startsWith("ผู้ชนะคู่"),
  );
  const secondTeams = [second.home, second.away].filter(
    (team) => team && !team.startsWith("ผู้ชนะคู่"),
  );
  const sameTeam = firstTeams.some((team) => secondTeams.includes(team));
  const sameVenue = !!first.venue && first.venue === second.venue;
  return sameTeam || sameVenue;
}

export function generateFixtures(
  format: CompetitionFormat,
  teamIds: string[],
  createId: () => string = () => crypto.randomUUID(),
): ManagedFixture[] {
  if (new Set(teamIds).size !== teamIds.length)
    throw Error("ไม่สามารถเลือกโรงเรียนซ้ำในรายการเดียวกัน");
  if (teamIds.length < 2) throw Error("เลือกอย่างน้อย 2 โรงเรียนเพื่อจัดสาย");
  if (format === "round_robin")
    return roundRobin(teamIds).map((pair) => ({
      id: createId(),
      round: "พบกันหมด",
      home: pair.home,
      away: pair.away,
      startsAt: "",
      venue: "",
    }));

  let bracket = [...teamIds];
  const powerOfTwo = 2 ** Math.ceil(Math.log2(bracket.length));
  bracket.push(...Array(powerOfTwo - bracket.length).fill(""));
  const fixtures: ManagedFixture[] = [];
  let round = 1;
  while (bracket.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < bracket.length; index += 2) {
      const home = bracket[index];
      const away = bracket[index + 1];
      const matchNumber = fixtures.length + 1;
      if (home && away) {
        fixtures.push({
          id: createId(),
          round: bracket.length === 2 ? "รอบชิงชนะเลิศ" : `รอบ ${round}`,
          home,
          away,
          startsAt: "",
          venue: "",
        });
        next.push(`ผู้ชนะคู่ ${matchNumber}`);
      } else {
        next.push(home || away);
      }
    }
    bracket = next;
    round += 1;
  }
  return fixtures;
}

function csvRows(csv: string, required: string[]) {
  const parsed = Papa.parse<Record<string, string>>(
    csv.replace(/^\uFEFF/, ""),
    {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
    },
  );
  if (parsed.errors.length) throw Error(parsed.errors[0].message);
  const fields = parsed.meta.fields || [];
  const missing = required.filter((field) => !fields.includes(field));
  if (missing.length) throw Error(`ไม่พบคอลัมน์: ${missing.join(", ")}`);
  if (parsed.data.length === 0) throw Error("ไม่พบข้อมูลในไฟล์ CSV");
  return parsed.data;
}

function positiveInt(
  value: string | undefined,
  field: string,
  allowZero = false,
) {
  const number = Number(value);
  if (!Number.isInteger(number) || (allowZero ? number < 0 : number < 1))
    throw Error(
      `${field} ต้องเป็นจำนวนเต็ม${allowZero ? "ตั้งแต่ 0" : "มากกว่า 0"}`,
    );
  return number;
}

export function parseCompetitionCsv(csv: string): CompetitionCsvRow[] {
  const rows = csvRows(csv, [
    "name",
    "sport",
    "age_group",
    "gender",
    "details",
    "starters",
    "reserves",
    "team_limit",
    "format",
    "win_points",
    "draw_points",
    "loss_points",
  ]);
  const names = new Set<string>();
  return rows.map((row, index) => {
    const line = index + 2;
    const name = row.name?.trim();
    const sport = row.sport?.trim();
    const ageGroup = row.age_group?.trim();
    const gender = row.gender?.trim();
    const format = row.format?.trim();
    if (!name || !ageGroup || !gender)
      throw Error(`แถว ${line}: กรุณาระบุชื่อ รุ่น และเพศ`);
    if (!SPORTS.includes(sport))
      throw Error(`แถว ${line}: ไม่รู้จักชนิดกีฬา "${sport}"`);
    if (!["ชาย", "หญิง", "ผสม"].includes(gender))
      throw Error(`แถว ${line}: เพศต้องเป็น ชาย, หญิง หรือ ผสม`);
    if (format !== "knockout" && format !== "round_robin")
      throw Error(`แถว ${line}: format ต้องเป็น knockout หรือ round_robin`);
    if (names.has(name)) throw Error(`แถว ${line}: ชื่อรายการซ้ำ`);
    names.add(name);
    return {
      name,
      sport,
      ageGroup,
      gender,
      details: row.details || "",
      starters: positiveInt(row.starters, `แถว ${line} starters`),
      reserves: positiveInt(row.reserves, `แถว ${line} reserves`, true),
      teamLimit: positiveInt(row.team_limit, `แถว ${line} team_limit`),
      format,
      winPoints: positiveInt(row.win_points, `แถว ${line} win_points`, true),
      drawPoints: positiveInt(row.draw_points, `แถว ${line} draw_points`, true),
      lossPoints: positiveInt(row.loss_points, `แถว ${line} loss_points`, true),
    };
  });
}

export function parseTeamCsv(
  csv: string,
  competitions: ManagedCompetition[],
  schools: { id: string; name: string }[],
): TeamCsvRow[] {
  const rows = csvRows(csv, ["competition_name", "school_name"]);
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const competitionMatches = competitions.filter(
      (item) => item.name === row.competition_name?.trim(),
    );
    if (competitionMatches.length !== 1)
      throw Error(`แถว ${index + 2}: ไม่พบรายการ "${row.competition_name}"`);
    const competition = competitionMatches[0];
    const matches = schools.filter(
      (school) => school.name === row.school_name?.trim(),
    );
    if (matches.length !== 1)
      throw Error(`แถว ${index + 2}: ไม่พบชื่อโรงเรียนหรือชื่อซ้ำ`);
    const key = `${competition.id}:${matches[0].id}`;
    if (seen.has(key)) throw Error(`แถว ${index + 2}: โรงเรียนซ้ำในรายการ`);
    if (competition.teams.includes(matches[0].id))
      throw Error(`แถว ${index + 2}: โรงเรียนนี้อยู่ในรายการแล้ว`);
    seen.add(key);
    return { competition: competition.id, school: matches[0].id };
  });
}

export function parseFixtureCsv(
  csv: string,
  competitions: ManagedCompetition[],
  schools: { id: string; name: string }[],
): FixtureCsvRow[] {
  const rows = csvRows(csv, [
    "competition_name",
    "round",
    "home_school",
    "away_school",
    "starts_at",
    "venue",
  ]);
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const competitionMatches = competitions.filter(
      (item) => item.name === row.competition_name?.trim(),
    );
    if (competitionMatches.length !== 1)
      throw Error(`แถว ${index + 2}: ไม่พบรายการ "${row.competition_name}"`);
    const competition = competitionMatches[0];
    const findSchool = (name: string | undefined) =>
      schools.filter((school) => school.name === name?.trim());
    const home = findSchool(row.home_school);
    const away = findSchool(row.away_school);
    if (home.length !== 1 || away.length !== 1)
      throw Error(`แถว ${index + 2}: ไม่พบชื่อโรงเรียนหรือชื่อซ้ำ`);
    if (home[0].id === away[0].id)
      throw Error(`แถว ${index + 2}: โรงเรียนแข่งกับตัวเองไม่ได้`);
    if (
      !competition.teams.includes(home[0].id) ||
      !competition.teams.includes(away[0].id)
    )
      throw Error(
        `แถว ${index + 2}: ต้องเพิ่มโรงเรียนทั้งสองทีมเข้ารายการก่อน`,
      );
    const round = row.round?.trim();
    if (!round) throw Error(`แถว ${index + 2}: กรุณาระบุรอบแข่งขัน`);
    const startsAt = row.starts_at?.trim() || "";
    if (
      startsAt &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) ||
        !Number.isFinite(new Date(startsAt).getTime()))
    )
      throw Error(`แถว ${index + 2}: วันเวลาต้องเป็น YYYY-MM-DDTHH:mm`);
    const key = `${competition.id}:${round}:${[home[0].id, away[0].id].sort().join(":")}`;
    if (seen.has(key)) throw Error(`แถว ${index + 2}: คู่แข่งขันซ้ำ`);
    seen.add(key);
    return {
      competition: competition.id,
      round,
      home: home[0].id,
      away: away[0].id,
      startsAt,
      venue: row.venue || "",
    };
  });
}
