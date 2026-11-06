import { accountError, accountJson, AccountError } from "@/lib/account-server";
import {
  authorizeSchool,
  coachesPrefix,
  readDocument,
  schoolBody,
  schoolUuid,
  validateCoaches,
  writeDocument,
  type Coach,
} from "@/lib/school-storage";
async function scope(
  request: Request,
  schoolId: string,
  competitionId: string,
) {
  const admin = await authorizeSchool(request, schoolId);
  const result = await admin
    .from("competitions")
    .select("id")
    .eq("id", competitionId)
    .maybeSingle();
  if (result.error)
    throw new AccountError("ตรวจสอบรายการแข่งขันไม่สำเร็จ", 503);
  if (!result.data) throw new AccountError("ไม่พบรายการแข่งขัน", 404);
  return admin;
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      schoolId = schoolUuid(url.searchParams.get("schoolId")),
      competitionId = schoolUuid(url.searchParams.get("competitionId"));
    const admin = await scope(request, schoolId, competitionId);
    const result = await readDocument<Coach[]>(
      admin,
      coachesPrefix(schoolId, competitionId),
      [],
    );
    return accountJson({ coaches: result.value, version: result.version });
  } catch (error) {
    return accountError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const body = await schoolBody(request),
      schoolId = schoolUuid(body.schoolId),
      competitionId = schoolUuid(body.competitionId);
    const admin = await scope(request, schoolId, competitionId);
    const coaches = validateCoaches(body.coaches, schoolId, competitionId);
    const saved = await writeDocument(
      admin,
      coachesPrefix(schoolId, competitionId),
      coaches,
      body.expectedVersion,
      [],
    );
    return accountJson({ coaches: saved.value, version: saved.version });
  } catch (error) {
    return accountError(error);
  }
}
