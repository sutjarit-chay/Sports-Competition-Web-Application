export function canManageCompetitions(role: string): boolean {
  return ["admin", "referee", "recorder"].includes(role);
}
