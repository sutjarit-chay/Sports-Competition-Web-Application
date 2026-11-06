import Papa from "papaparse";
import type { RosterDetails } from "./registration";
import { compatibleRules, ATHLETICS_EVENTS } from "./registration";
export const SPORTS = [
  "ฟุตบอล",
  "วอลเลย์บอล",
  "แชร์บอล",
  "เปตอง",
  "เซปักตะกร้อ",
  "กรีฑา",
  "โยนบอล",
  "ปิงปอง",
];
export type Athlete = {
  id: string;
  name: string;
  school_id: string;
  sport: string;
  gender: string;
  division: string;
  bib?: string;
  competition_id?: string;
  roster?: RosterDetails;
};
export type Match = {
  id: string;
  sport: string;
  division: string;
  gender: string;
  pool: string;
  home: string;
  away: string;
  starts_at: string;
  venue: string;
  home_score?: number;
  away_score?: number;
  status: string;
  competition_id?: string;
  revision?: number;
  referee_id?: string;
  format?: "round_robin" | "knockout";
  managed?: boolean;
};
export type Race = {
  id: string;
  event: string;
  division: string;
  gender: string;
  stage: string;
  heat: number;
  athlete_id: string;
  value: number | null;
  status: string;
  competition_id?: string;
  event_id?: string;
  source_event_id?: string;
  school_id?: string;
  bib?: string;
  direction?: string;
  unit?: string;
  kind?: string;
  referee_id?: string;
  starts_at?: string;
  venue?: string;
};
export type Award = {
  id: string;
  event: string;
  division: string;
  gender: string;
  school_id: string;
  medal: string;
  competition_id?: string;
};
export type State = {
  schools: {
    id: string;
    name: string;
    short_name?: string;
    logo?: string;
    school_type?: "ขนาดเล็ก" | "ขยายโอกาส";
  }[];
  athletes: Athlete[];
  matches: Match[];
  races: Race[];
  awards: Award[];
};
export function roundRobin(teams: string[]) {
  return [...new Set(teams)].flatMap((home, i, a) =>
    a.slice(i + 1).map((away) => ({ home, away })),
  );
}
export function standings(
  matches: {
    home: string;
    away: string;
    homeScore?: number;
    awayScore?: number;
    status: string;
  }[],
  points = { win: 3, draw: 1, loss: 0 },
) {
  const rows = new Map<
    string,
    {
      school: string;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      gf: number;
      ga: number;
      points: number;
    }
  >();
  for (const m of matches) {
    for (const s of [m.home, m.away])
      if (!rows.has(s))
        rows.set(s, {
          school: s,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          points: 0,
        });
    if (
      m.status !== "finished" ||
      m.homeScore === undefined ||
      m.awayScore === undefined
    )
      continue;
    for (const [s, a, b] of [
      [m.home, m.homeScore, m.awayScore],
      [m.away, m.awayScore, m.homeScore],
    ] as [string, number, number][]) {
      const r = rows.get(s)!;
      r.played++;
      r.gf += a;
      r.ga += b;
      if (a > b) {
        r.won++;
        r.points += points.win;
      } else if (a === b) {
        r.drawn++;
        r.points += points.draw;
      } else {
        r.lost++;
        r.points += points.loss;
      }
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.school.localeCompare(b.school),
  );
}
export function parseAthletes(csv: string, schools = initialState().schools) {
  const p = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  if (
    p.errors.length ||
    !["name", "school_id", "sport", "gender", "division"].every((h) =>
      p.meta.fields?.includes(h),
    )
  )
    throw Error("หัว CSV ต้องเป็น name,school_id,sport,gender,division");
  const seen = new Set<string>();
  return p.data.map((r, i) => {
    const a: Athlete = {
      id: crypto.randomUUID(),
      name: r.name?.trim(),
      school_id: r.school_id?.trim(),
      sport: r.sport?.trim(),
      gender: r.gender?.trim(),
      division: r.division?.trim(),
      bib: r.bib?.trim() || undefined,
    };
    if (a.sport === "ตะกร้อ") a.sport = "เซปักตะกร้อ";
    if (r.rule_id?.trim() || r.position?.trim() || r.events?.trim()) {
      const events = (r.events || "")
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean)
        .map(
          (value) =>
            ATHLETICS_EVENTS.find((e) => e.id === value || e.name === value)
              ?.id || value,
        );
      const matches = compatibleRules(a.sport, a.gender, a.division);
      const inferred = events.includes("relay")
        ? "athletics-relay"
        : a.sport === "กรีฑา"
          ? "athletics-individual"
          : matches[0]?.id;
      a.roster = {
        ruleId: r.rule_id?.trim() || inferred || "",
        position: (r.position?.trim() ||
          (a.sport === "กรีฑา" && !events.includes("relay")
            ? "individual"
            : "auto")) as RosterDetails["position"],
        events,
      };
    }
    const matches = schools.filter(
      (s) => s.id === a.school_id || s.name === a.school_id,
    );
    if (matches.length !== 1)
      throw Error(
        `โรงเรียนแถว ${i + 2} ไม่พบหรือชื่อซ้ำ ใช้รหัสโรงเรียนจากระบบ`,
      );
    a.school_id = matches[0].id;
    if (
      !a.name ||
      !a.division ||
      !SPORTS.includes(a.sport) ||
      !["ชาย", "หญิง", "ผสม"].includes(a.gender)
    )
      throw Error(`ข้อมูลแถว ${i + 2} ไม่ถูกต้อง`);
    const key = [
      a.name,
      a.school_id,
      a.sport,
      a.gender,
      a.division,
      a.roster?.ruleId || "",
    ].join("|");
    if (seen.has(key)) throw Error(`ข้อมูลซ้ำแถว ${i + 2}`);
    seen.add(key);
    return a;
  });
}
export function rankRace<
  T extends { id: string; value: number | null; status: string },
>(rows: T[], descending = false) {
  const sorted = [...rows].sort((a, b) => {
    const av = a.status === "OK" && a.value !== null,
      bv = b.status === "OK" && b.value !== null;
    return (
      Number(bv) - Number(av) ||
      (av && bv ? (descending ? -1 : 1) * (a.value! - b.value!) : 0)
    );
  });
  return sorted.map((r, i) => ({
    ...r,
    rank:
      r.status !== "OK" || r.value === null
        ? null
        : 1 +
          sorted.filter(
            (x) =>
              x.status === "OK" &&
              x.value !== null &&
              (descending ? x.value > r.value! : x.value < r.value!),
          ).length,
  }));
}
export function medals(awards: { school: string; medal: string }[]) {
  const map = new Map<
    string,
    { school: string; gold: number; silver: number; bronze: number }
  >();
  for (const a of awards) {
    if (!map.has(a.school))
      map.set(a.school, { school: a.school, gold: 0, silver: 0, bronze: 0 });
    if (["gold", "silver", "bronze"].includes(a.medal))
      map.get(a.school)![a.medal as "gold"]++;
  }
  return [...map.values()].sort(
    (a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze,
  );
}
export function initialState(): State {
  return {
    schools: [],
    athletes: [],
    matches: [],
    races: [],
    awards: [],
  };
}
