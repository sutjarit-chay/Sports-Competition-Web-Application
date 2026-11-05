const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$/;

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return USERNAME_PATTERN.test(username) ? username : null;
}

export function usernameEmail(username: string): string {
  return `${username}@accounts.sports-competition.invalid`;
}
