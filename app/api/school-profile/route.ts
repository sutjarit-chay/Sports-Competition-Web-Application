import {
  accountAdmin,
  accountError,
  accountJson,
  AccountError,
} from "@/lib/account-server";
import {
  authorizeSchool,
  emptySchoolProfile,
  profilePrefix,
  readDocument,
  schoolBody,
  schoolUuid,
  validateProfile,
  writeDocument,
  type PrivateSchoolProfile,
} from "@/lib/school-storage";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("public") === "1") {
      const admin = accountAdmin();
      const result = await admin.from("schools").select("id");
      if (result.error) throw new AccountError("อ่านโรงเรียนไม่สำเร็จ", 503);
      const schools = await Promise.all(
        (result.data || []).map(async (school) => {
          const { value } = await readDocument<PrivateSchoolProfile>(
            admin,
            profilePrefix(school.id),
            emptySchoolProfile,
          );
          return {
            id: school.id,
            short_name: value.shortName,
            school_type: value.schoolType,
            logo: value.logo
              ? `/api/school-profile/logo?schoolId=${school.id}`
              : "",
          };
        }),
      );
      return accountJson({ schools });
    }
    const schoolId = schoolUuid(url.searchParams.get("schoolId"));
    const admin = await authorizeSchool(request, schoolId);
    const result = await readDocument(
      admin,
      profilePrefix(schoolId),
      emptySchoolProfile,
    );
    return accountJson({ profile: result.value, version: result.version });
  } catch (error) {
    return accountError(error);
  }
}
export async function PUT(request: Request) {
  try {
    const body = await schoolBody(request);
    const schoolId = schoolUuid(body.schoolId);
    const admin = await authorizeSchool(request, schoolId);
    const profile = validateProfile(body.profile);
    const saved = await writeDocument(
      admin,
      profilePrefix(schoolId),
      profile,
      body.expectedVersion,
      emptySchoolProfile,
    );
    return accountJson({ profile: saved.value, version: saved.version });
  } catch (error) {
    return accountError(error);
  }
}
