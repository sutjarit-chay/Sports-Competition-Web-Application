import {
  accountAdmin,
  accountBody,
  accountError,
  accountJson,
  accountProfile,
  authenticateAccount,
  AccountError,
} from "@/lib/account-server";
import {
  saveAthleticsResult,
  assignAthleticsReferee,
} from "@/lib/athletics-results";
export async function POST(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile) throw new AccountError("ไม่มีสิทธิ์บันทึกผลกรีฑา", 403);
    const body = await accountBody(request);
    await saveAthleticsResult(accountAdmin(), body.race, {
      id: user.id,
      role: profile.role,
    });
    return accountJson({ ok: true });
  } catch (error) {
    return accountError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (profile?.role !== "admin")
      throw new AccountError("เฉพาะผู้ดูแลระบบเท่านั้น", 403);
    const body = await accountBody(request);
    await assignAthleticsReferee(accountAdmin(), body.eventId, body.refereeId, {
      id: user.id,
      role: profile.role,
    });
    return accountJson({ ok: true });
  } catch (error) {
    return accountError(error);
  }
}
