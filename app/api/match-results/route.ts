import { assertCompetitionOpen } from "@/lib/competition-reset";
import {
  accountAdmin,
  accountBody,
  accountError,
  accountJson,
  authenticateAccount,
  accountProfile,
  AccountError,
} from "../../../lib/account-server";
import { saveMatchResult } from "../../../lib/match-results";
export async function POST(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile || !["admin", "recorder", "referee"].includes(profile.role))
      throw new AccountError("ไม่มีสิทธิ์บันทึกผลแข่งขัน", 403);
    const body = await accountBody(request);
    const admin = accountAdmin();
    await assertCompetitionOpen(admin);
    return accountJson(
      await saveMatchResult(admin, body.match, {
        id: user.id,
        role: profile.role,
      }),
    );
  } catch (error) {
    return accountError(error);
  }
}
