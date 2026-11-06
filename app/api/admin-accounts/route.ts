import { accountBody, accountError, accountJson } from "@/lib/account-server";
import {
  adminAccountDirectory,
  authorizeAdministrator,
  changeAdminAccount,
} from "@/lib/admin-accounts";
export async function GET(request: Request) {
  try {
    const admin = await authorizeAdministrator(request);
    return accountJson({ accounts: await adminAccountDirectory(admin) });
  } catch (error) {
    return accountError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const admin = await authorizeAdministrator(request);
    await changeAdminAccount(admin, await accountBody(request));
    return accountJson({ ok: true });
  } catch (error) {
    return accountError(error);
  }
}
