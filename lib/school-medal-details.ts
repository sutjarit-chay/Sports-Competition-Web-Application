import { medals, type Award } from "./domain";
export type SchoolMedalRow = Award & { name: string };
const order: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
export const medalNames: Record<string, string> = {
  gold: "🥇 ทอง",
  silver: "🥈 เงิน",
  bronze: "🥉 ทองแดง",
};
export function schoolMedalDetails(
  awards: Award[],
  schoolId: string,
  competitionName: (id: string | undefined) => string = () => "",
) {
  const selected = awards.filter(
    (award) =>
      award.school_id === schoolId && Object.hasOwn(order, award.medal),
  );
  const summary = medals(
    selected.map((award) => ({ school: award.school_id, medal: award.medal })),
  )[0];
  const totals = {
    gold: summary?.gold || 0,
    silver: summary?.silver || 0,
    bronze: summary?.bronze || 0,
    total: selected.length,
  };
  const rows: SchoolMedalRow[] = selected
    .map((award) => ({
      ...award,
      name: competitionName(award.competition_id) || award.event,
    }))
    .sort(
      (a, b) =>
        order[a.medal] - order[b.medal] ||
        a.name.localeCompare(b.name, "th") ||
        a.event.localeCompare(b.event, "th") ||
        a.division.localeCompare(b.division, "th") ||
        a.gender.localeCompare(b.gender, "th"),
    );
  return { totals, rows };
}
