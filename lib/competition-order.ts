export function sortCompetitionsByName<T extends { name: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "th"));
}
