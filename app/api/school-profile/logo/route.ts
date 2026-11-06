import { accountAdmin, accountError, AccountError } from "@/lib/account-server";
import {
  emptySchoolProfile,
  profilePrefix,
  readDocument,
  requireSchool,
  safeLogo,
  schoolUuid,
} from "@/lib/school-storage";
export async function GET(request: Request) {
  try {
    const schoolId = schoolUuid(
      new URL(request.url).searchParams.get("schoolId"),
    );
    const admin = accountAdmin();
    await requireSchool(admin, schoolId);
    const { value } = await readDocument(
      admin,
      profilePrefix(schoolId),
      emptySchoolProfile,
    );
    const logo = safeLogo(value.logo);
    if (!logo) throw new AccountError("ไม่พบโลโก้", 404);
    return new Response(new Uint8Array(logo.bytes), {
      headers: {
        "Content-Type": logo.type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    return accountError(error);
  }
}
