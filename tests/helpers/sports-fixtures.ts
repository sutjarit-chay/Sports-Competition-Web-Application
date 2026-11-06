import {
  generateFixtures,
  type ManagedCompetition,
} from "../../lib/admin-competitions";
import type { Athlete, State } from "../../lib/domain";
import {
  ATHLETICS_EVENTS,
  RULES,
  type RegistrationPolicy,
} from "../../lib/registration";

const SCHOOL_NAMES = [
  "โรงเรียนบ้านคลองลึก",
  "โรงเรียนชุมชนหนองกลาง",
  "โรงเรียนบ้านดอนแก้ว",
  "โรงเรียนวัดป่ารัง",
  "โรงเรียนบ้านใหม่สามัคคี",
  "โรงเรียนชุมชนทุ่งสว่าง",
  "โรงเรียนบ้านห้วยทราย",
  "โรงเรียนบ้านวังทอง",
  "โรงเรียนชุมชนเขาน้อย",
  "โรงเรียนบ้านดงยาง",
];
const DEMO_EVENT_START = new Date("2026-11-16T00:00:00");
const DEMO_DAILY_STARTS = [
  "08:00",
  "08:45",
  "09:30",
  "10:15",
  "11:00",
  "11:45",
  "13:30",
  "14:15",
  "15:00",
  "15:45",
  "16:30",
  "17:15",
];
const DEMO_VENUES: Record<string, string> = {
  ฟุตบอล: "สนามฟุตบอล",
  แชร์บอล: "สนามแชร์บอล",
  วอลเลย์บอล: "สนามวอลเลย์บอล",
  เซปักตะกร้อ: "สนามตะกร้อ",
  เปตอง: "สนามเปตอง",
  โยนบอล: "สนามโยนบอล",
  กรีฑา: "สนามกรีฑา",
};

function demoFixtureSchedule(
  ruleId: string,
  sport: string,
  teams: string[],
  competitionIndex: number,
) {
  const fixtures = generateFixtures(
    "round_robin",
    teams,
    (() => {
      let fixtureNumber = 0;
      return () =>
        `demo-fixture-${ruleId}-${String(++fixtureNumber).padStart(3, "0")}`;
    })(),
  );
  const rounds = new Map<string, { round: number; game: number }>();
  const circle = [...teams];
  for (let round = 0; round < teams.length - 1; round++) {
    for (let game = 0; game < teams.length / 2; game++) {
      const pair = [circle[game], circle[circle.length - 1 - game]].sort();
      rounds.set(pair.join(":"), { round, game });
    }
    circle.splice(1, 0, circle.pop()!);
  }

  return fixtures
    .map((fixture) => {
      const roundInfo = rounds.get(
        [fixture.home, fixture.away].sort().join(":"),
      );
      if (!roundInfo) throw Error(`ไม่สามารถจัดรอบให้รายการ ${ruleId}`);
      const slot = competitionIndex * (teams.length - 1) + roundInfo.round;
      const eventDate = new Date(DEMO_EVENT_START);
      eventDate.setDate(
        eventDate.getDate() + Math.floor(slot / DEMO_DAILY_STARTS.length),
      );
      const date = [
        eventDate.getFullYear(),
        String(eventDate.getMonth() + 1).padStart(2, "0"),
        String(eventDate.getDate()).padStart(2, "0"),
      ].join("-");
      const time = DEMO_DAILY_STARTS[slot % DEMO_DAILY_STARTS.length];
      return {
        ...fixture,
        round: `รอบ ${roundInfo.round + 1}`,
        startsAt: `${date}T${time}`,
        venue: `${DEMO_VENUES[sport] || "สนามแข่งขัน"} ${roundInfo.game + 1}`,
      };
    })
    .sort((first, second) => first.startsAt.localeCompare(second.startsAt));
}

export type DemoCompetitionData = {
  schools: State["schools"];
  athletes: Athlete[];
  competitions: ManagedCompetition[];
  policies: Record<string, RegistrationPolicy>;
};

export function demoFixturesAsMatches(
  competitions: ManagedCompetition[],
  existing: State["matches"] = [],
): State["matches"] {
  return competitions.flatMap((competition) => {
    const projected: State["matches"] = [];
    for (const fixture of competition.fixtures) {
      const resolve = (team: string) => {
        const source = /^ผู้ชนะคู่ (\d+)$/.exec(team);
        if (!source) return team;
        const match = projected[Number(source[1]) - 1];
        if (
          !match ||
          match.status !== "finished" ||
          match.home_score === undefined ||
          match.away_score === undefined ||
          match.home_score === match.away_score
        )
          return team;
        return match.home_score > match.away_score ? match.home : match.away;
      };
      const home = resolve(fixture.home),
        away = resolve(fixture.away);
      const previous = existing.find(
        (m) =>
          m.id === fixture.id &&
          m.competition_id === competition.id &&
          m.home === home &&
          m.away === away,
      );
      projected.push({
        id: fixture.id,
        sport: competition.sport,
        division: competition.ageGroup,
        gender: competition.gender,
        pool: fixture.round,
        home,
        away,
        starts_at: fixture.startsAt,
        venue: fixture.venue,
        referee_id: fixture.referee_id,
        status: previous?.status || "scheduled",
        home_score: previous?.home_score,
        away_score: previous?.away_score,
        competition_id: competition.id,
        format: competition.format,
        managed: true,
      });
    }
    return projected;
  });
}

/** Reconcile managed schedules without changing unrelated legacy matches. */
export function reconcileManagedMatches(
  existing: State["matches"],
  competitions: ManagedCompetition[],
) {
  const ids = new Set(competitions.map((c) => c.id));
  return [
    ...existing.filter(
      (m) =>
        !m.managed &&
        !ids.has(m.competition_id || "") &&
        !m.competition_id?.startsWith("demo-"),
    ),
    ...demoFixturesAsMatches(competitions, existing),
  ];
}

export function createDemoCompetitionData(
  existingSchools: State["schools"] = [],
): DemoCompetitionData {
  const schools = existingSchools.slice(0, 10);
  const schoolIds = new Set(schools.map((school) => school.id));
  for (let index = 0; schools.length < 10; index++) {
    const id = `demo-school-${String(index + 1).padStart(2, "0")}`;
    if (schoolIds.has(id)) continue;
    schoolIds.add(id);
    schools.push({
      id,
      name: SCHOOL_NAMES[schools.length],
      school_type: schools.length % 2 === 0 ? "ขนาดเล็ก" : "ขยายโอกาส",
    });
  }

  const competitions: ManagedCompetition[] = [];
  const policies: Record<string, RegistrationPolicy> = {};
  const athletes: Athlete[] = [];

  for (const [competitionIndex, rule] of RULES.entries()) {
    const id = `demo-${rule.id}`;
    const ageGroup = rule.levels[0] || "ประถมศึกษา";
    const gender = rule.genders[0] || "ชาย";
    const reserves = rule.reserves ?? 2;
    const starters = rule.starters ?? 2;
    const individual = rule.id === "athletics-individual";
    const eventQuotas: Record<string, number> = individual
      ? Object.fromEntries(
          ATHLETICS_EVENTS.filter((event) => event.id !== "relay").map(
            (event) => [event.id, 2],
          ),
        )
      : {};

    competitions.push({
      id,
      name: `${rule.name} · สาธิต`,
      sport: rule.sport,
      ageGroup,
      gender,
      details: "รายการจำลองสำหรับทดสอบข้อมูลลงทะเบียนครบทุกโรงเรียน",
      starters,
      reserves,
      teamLimit: 10,
      format: "round_robin",
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      teams: schools.map((school) => school.id),
      fixtures: demoFixtureSchedule(
        rule.id,
        rule.sport,
        schools.map((school) => school.id),
        competitionIndex,
      ),
    });
    policies[rule.id] = {
      ruleId: rule.id,
      reserves,
      eventQuotas,
      maxEventsPerAthlete: null,
    };

    schools.forEach((school, schoolIndex) => {
      const addAthlete = (
        position: "starter" | "reserve" | "individual",
        athleteIndex: number,
        events: string[],
      ) => {
        athletes.push({
          id: `demo-athlete-${schoolIndex + 1}-${rule.id}-${position}-${athleteIndex + 1}`,
          name: `${school.name} · ${rule.sport} ${athleteIndex + 1}`,
          school_id: school.id,
          sport: rule.sport,
          gender,
          division: ageGroup,
          bib: `${schoolIndex + 1}${String(athleteIndex + 1).padStart(3, "0")}`,
          competition_id: id,
          roster: { ruleId: rule.id, position, events },
        });
      };

      if (individual) {
        ATHLETICS_EVENTS.filter((event) => event.id !== "relay").forEach(
          (event, eventIndex) => {
            for (let person = 0; person < eventQuotas[event.id]; person++)
              addAthlete("individual", eventIndex * 2 + person, [event.id]);
          },
        );
        return;
      }

      for (let index = 0; index < starters + reserves; index++)
        addAthlete(
          index < starters ? "starter" : "reserve",
          index,
          rule.id === "athletics-relay" ? ["relay"] : [],
        );
    });
  }

  return { schools, athletes, competitions, policies };
}
