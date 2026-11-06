import { assertCompetitionOpen } from "@/lib/competition-reset";
import { accountBody, accountError, accountJson } from "@/lib/account-server";
import { authorizeAdministrator } from "@/lib/admin-accounts";
import {
  deleteEmptySchool,
  schoolDependencyPreview,
} from "@/lib/admin-schools";
export async function GET(request: Request) {
  try {
    const admin = await authorizeAdministrator(request);
    return accountJson({
      preview: await schoolDependencyPreview(
        admin,
        new URL(request.url).searchParams.get("schoolId"),
      ),
    });
  } catch (error) {
    return accountError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const admin = await authorizeAdministrator(request);
    await assertCompetitionOpen(admin);
    const result = await deleteEmptySchool(admin, await accountBody(request));
    return accountJson({ ok: true, ...result });
  } catch (error) {
    return accountError(error);
  }
}
