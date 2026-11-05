export const SCHOOL_PROFILE_KEY = "kosamphi-school-profiles-v1";

export type SchoolProfile = {
  shortName: string;
  logo: string;
  contactName: string;
  contactPhone: string;
  address: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredProfile(value: unknown): value is Record<string, unknown> & {
  contactName: string;
  contactPhone: string;
  address: string;
} {
  return (
    isRecord(value) &&
    (value.shortName === undefined || typeof value.shortName === "string") &&
    (value.logo === undefined ||
      (typeof value.logo === "string" &&
        value.logo.length <= 1_000_000 &&
        (value.logo === "" ||
          /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]*={0,2}$/.test(
            value.logo,
          )))) &&
    typeof value.contactName === "string" &&
    typeof value.contactPhone === "string" &&
    typeof value.address === "string"
  );
}

export function parseSchoolProfiles(raw: string | null) {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed) || !Object.values(parsed).every(isStoredProfile))
    throw Error("ข้อมูลประวัติโรงเรียนสาธิตไม่ถูกต้อง");

  const profiles: Record<string, SchoolProfile> = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (!isStoredProfile(value))
      throw Error("ข้อมูลประวัติโรงเรียนสาธิตไม่ถูกต้อง");
    profiles[id] = {
      shortName: typeof value.shortName === "string" ? value.shortName : "",
      logo: typeof value.logo === "string" ? value.logo : "",
      contactName: value.contactName,
      contactPhone: value.contactPhone,
      address: value.address,
    };
  }
  return profiles;
}
