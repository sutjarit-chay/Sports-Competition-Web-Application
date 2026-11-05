import { rankRace, standings } from "./domain";
import type { Award, Athlete, Match, Race } from "./domain";

type SchoolWithType = {
  id: string;
  name: string;
  school_type?: string | null;
};

type Points = { win: number; draw: number; loss: number };

function isComplete(match: Match) {
  return (
    match.status === "finished" &&
    Number.isFinite(match.home_score) &&
    Number.isFinite(match.away_score)
  );
}

function eventLabel(match: Match) {
  return [match.sport, match.division, match.gender]
    .filter(Boolean)
    .join(" · ");
}

function medalForRank(rank: number): string | null {
  return rank === 1
    ? "gold"
    : rank === 2
      ? "silver"
      : rank === 3
        ? "bronze"
        : null;
}

function addAward(
  awards: Award[],
  event: string,
  division: string,
  gender: string,
  school_id: string,
  medal: string,
  competition_id?: string,
) {
  if (!school_id || !["gold", "silver", "bronze"].includes(medal)) return;
  awards.push({
    id: `${competition_id || "local"}:${event}:${school_id}:${medal}`,
    event,
    division,
    gender,
    school_id,
    medal,
    competition_id,
  });
}

function isFinalRound(round: string) {
  return (
    !isThirdPlaceRound(round) &&
    !isQualificationRound(round) &&
    /รอบชิง|ชิงชนะเลิศ|\bfinal\b/i.test(round)
  );
}

function isThirdPlaceRound(round: string) {
  return /ชิงอันดับ\s*3|ชิงที่\s*3|อันดับ\s*3|third/i.test(round);
}

function isQualificationRound(round: string) {
  return /รอบคัดเลือก|คัดเลือก|รอบรองชนะเลิศ|รอบรอง|semi/i.test(round);
}

function assignMatchFinals(matches: Match[], awards: Award[]) {
  const finals = matches.filter((match) => isFinalRound(match.pool));
  const thirdPlace = matches.filter((match) => isThirdPlaceRound(match.pool));
  for (const match of [...finals, ...thirdPlace]) {
    if (!isComplete(match) || match.home_score === match.away_score) continue;
    const winner =
      match.home_score! > match.away_score! ? match.home : match.away;
    const loser = winner === match.home ? match.away : match.home;
    const event = eventLabel(match);
    if (finals.includes(match)) {
      addAward(
        awards,
        event,
        match.division,
        match.gender,
        winner,
        "gold",
        match.competition_id,
      );
      addAward(
        awards,
        event,
        match.division,
        match.gender,
        loser,
        "silver",
        match.competition_id,
      );
    } else {
      addAward(
        awards,
        event,
        match.division,
        match.gender,
        winner,
        "bronze",
        match.competition_id,
      );
    }
  }
}

function assignRoundRobinMedals(
  matches: Match[],
  awards: Award[],
  points: Points,
) {
  if (!matches.length || matches.some((match) => !isComplete(match))) return;
  if (
    !matches.every((match) => match.format === "round_robin") &&
    new Set(matches.map((match) => match.pool)).size > 1
  )
    return;
  const rankings = standings(
    matches.map((match) => ({
      home: match.home,
      away: match.away,
      homeScore: match.home_score,
      awayScore: match.away_score,
      status: match.status,
    })),
    points,
  );
  const competition = matches[0];
  const rows = rankings.map((row) => ({
    ...row,
    goalDifference: row.gf - row.ga,
  }));
  let rank = 0;
  let previous: (typeof rows)[number] | undefined;
  for (const [index, row] of rows.entries()) {
    if (
      !previous ||
      row.points !== previous.points ||
      row.goalDifference !== previous.goalDifference ||
      row.gf !== previous.gf
    )
      rank = index + 1;
    previous = row;
    const medal = medalForRank(rank);
    if (!medal) continue;
    addAward(
      awards,
      eventLabel(competition),
      competition.division,
      competition.gender,
      row.school,
      medal,
      competition.competition_id,
    );
  }
}

export function calculateMedalAwards({
  matches,
  races,
  athletes,
  pointsByCompetition = {},
}: {
  matches: Match[];
  races: Race[];
  athletes: Athlete[];
  pointsByCompetition?: Record<string, Points>;
}) {
  const awards: Award[] = [];
  const matchGroups = new Map<string, Match[]>();
  for (const match of matches) {
    const key = [
      match.competition_id || "legacy",
      match.sport,
      match.division,
      match.gender,
    ].join(":");
    matchGroups.set(key, [...(matchGroups.get(key) || []), match]);
  }

  for (const group of matchGroups.values()) {
    const finalMatches = group.filter((match) => isFinalRound(match.pool));
    const thirdPlaceMatches = group.filter((match) =>
      isThirdPlaceRound(match.pool),
    );
    if (finalMatches.length || thirdPlaceMatches.length) {
      assignMatchFinals(group, awards);
      continue;
    }
    if (group.some((match) => isQualificationRound(match.pool))) continue;
    const competitionId = group[0].competition_id;
    assignRoundRobinMedals(
      group,
      awards,
      (competitionId && pointsByCompetition[competitionId]) || {
        win: 3,
        draw: 1,
        loss: 0,
      },
    );
  }

  const raceGroups = new Map<string, Race[]>();
  for (const race of races) {
    if (race.stage !== "final") continue;
    const key = [
      race.competition_id || "legacy",
      race.event,
      race.division,
      race.gender,
    ].join(":");
    raceGroups.set(key, [...(raceGroups.get(key) || []), race]);
  }
  for (const group of raceGroups.values()) {
    const ranked = rankRace(group, group[0].direction === "desc");
    for (const result of ranked) {
      if (result.rank === null) continue;
      const medal = medalForRank(result.rank);
      if (!medal) continue;
      const school =
        result.school_id ||
        athletes.find((athlete) => athlete.id === result.athlete_id)?.school_id;
      if (!school) continue;
      addAward(
        awards,
        result.event,
        result.division,
        result.gender,
        school,
        medal,
        result.competition_id,
      );
    }
  }
  return awards;
}

export function groupSchoolsByMedalCategory(schools: SchoolWithType[]) {
  return {
    small: schools.filter((school) => school.school_type === "ขนาดเล็ก"),
    extended: schools.filter((school) => school.school_type === "ขยายโอกาส"),
    unclassified: schools.filter(
      (school) =>
        school.school_type !== "ขนาดเล็ก" && school.school_type !== "ขยายโอกาส",
    ),
  };
}

export function hasMultiplePoolsAwaitingFinal(matches: Match[]) {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const key = [
      match.competition_id || "legacy",
      match.sport,
      match.division,
      match.gender,
    ].join(":");
    groups.set(key, [...(groups.get(key) || []), match]);
  }
  return [...groups.values()].some(
    (group) =>
      !group.every((match) => match.format === "round_robin") &&
      new Set(group.map((match) => match.pool)).size > 1 &&
      !group.some((match) => isFinalRound(match.pool)),
  );
}
