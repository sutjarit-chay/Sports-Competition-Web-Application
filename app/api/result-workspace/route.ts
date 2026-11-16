import {
  accountAdmin,
  accountError,
  accountJson,
  accountProfile,
  authenticateAccount,
  AccountError,
} from "@/lib/account-server";
import { readHosted } from "@/lib/hosted";

// RLS remains unchanged. The server validates the current profile before reading
// the shared result desk; service credentials never reach the browser.
export async function GET(request: Request) {
  try {
    const { user, client } = await authenticateAccount(request);
    const profile = await accountProfile(client, user.id);
    if (!profile || !["admin", "recorder", "referee"].includes(profile.role))
      throw new AccountError("ไม่มีสิทธิ์ใช้งานหน้าบันทึกผล", 403);
    return accountJson({ snapshot: await readHosted(accountAdmin(), true) });
  } catch (error) {
    return accountError(error);
  }
}
