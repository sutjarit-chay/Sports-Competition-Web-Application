import {
  accountAdmin,
  accountError,
  accountJson,
  accountProfile,
  authenticateAccount,
  AccountError,
} from "@/lib/account-server";
import { assertCompetitionOpen } from "@/lib/competition-reset";
import { schoolBody } from "@/lib/school-storage";
import {
  readAthleticsScoresheet,
  writeAthleticsScoresheet,
} from "@/lib/athletics-scoresheet-store";

export async function GET() {
  try {
    const admin = accountAdmin();
    const state = await readAthleticsScoresheet(admin);
    return accountJson(state);
  } catch (error) {
    return accountError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile || !["admin", "recorder", "referee"].includes(profile.role)) {
      throw new AccountError("ไม่มีสิทธิ์บันทึกผลกรีฑา", 403);
    }

    const admin = accountAdmin();
    await assertCompetitionOpen(admin);
    const body = await schoolBody(request);
    const saved = await writeAthleticsScoresheet(
      admin,
      body.rows,
      body.expectedVersion,
      user.id,
    );
    return accountJson({ ok: true, ...saved });
  } catch (error) {
    return accountError(error);
  }
}
