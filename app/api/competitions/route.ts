import { canManageCompetitions } from "@/lib/competition-access";
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
import {
  CompetitionError,
  managedFromHosted,
  performCompetitionAction,
} from "../../../lib/production-competitions";
import type { Competition, HostedMatch } from "../../../lib/hosted";
export async function GET(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile || !canManageCompetitions(profile.role))
      throw new AccountError("ไม่มีสิทธิ์จัดการแข่งขัน", 403);
    const admin = accountAdmin();
    const [c, m] = await Promise.all([
      admin.from("competitions").select("*"),
      admin.from("matches").select("*"),
    ]);
    if (c.error || m.error) throw new AccountError("โหลดรายการไม่สำเร็จ", 503);
    return accountJson({
      competitions: managedFromHosted(
        c.data as Competition[],
        m.data as HostedMatch[],
      ),
    });
  } catch (error) {
    return accountError(error);
  }
}
export async function POST(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile) throw new AccountError("ไม่มีสิทธิ์จัดการแข่งขัน", 403);
    const body = await accountBody(request);
    if (!canManageCompetitions(profile.role))
      throw new AccountError("ไม่มีสิทธิ์จัดการแข่งขัน", 403);
    const admin = accountAdmin();
    await assertCompetitionOpen(admin);
    await performCompetitionAction(admin, body, {
      id: user.id,
      role: profile.role,
    });
    return accountJson({ ok: true });
  } catch (error) {
    return accountError(
      error instanceof CompetitionError
        ? new AccountError(error.message, error.status)
        : error,
    );
  }
}
