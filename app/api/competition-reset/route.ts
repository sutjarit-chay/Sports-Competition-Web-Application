import {
  accountBody,
  accountError,
  accountJson,
  AccountError,
} from "@/lib/account-server";
import {
  authorizeReset,
  currentResetJob,
  resetPreview,
  resetBackup,
  resetArchives,
  startReset,
  stepReset,
  releaseReset,
} from "@/lib/competition-reset";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const client = await authorizeReset(request),
      url = new URL(request.url);
    if (url.searchParams.get("status") === "1")
      return accountJson({ job: await currentResetJob(client) });
    if (url.searchParams.get("archives") === "1")
      return accountJson(
        await resetArchives(client, url.searchParams.get("offset")),
      );
    if (url.searchParams.has("archiveId"))
      return accountJson(
        await resetBackup(
          client,
          url.searchParams.get("archiveId"),
          url.searchParams.get("part"),
        ),
      );
    const job = await currentResetJob(client);
    try {
      return accountJson({ preview: await resetPreview(client), job });
    } catch (error) {
      if (!job) throw error;
      return accountJson({
        job,
        preview: null,
        previewError:
          error instanceof AccountError
            ? error.message
            : "ไม่สามารถอ่านตัวอย่างได้ กรุณาตรวจสอบสถานะงาน",
      });
    }
  } catch (error) {
    return accountError(error);
  }
}
export async function POST(request: Request) {
  try {
    const client = await authorizeReset(request),
      body = await accountBody(request);
    if (body.action === "preview")
      return accountJson({
        preview: await resetPreview(client),
        job: await currentResetJob(client),
      });
    if (body.action === "start")
      return accountJson({ job: await startReset(client, body) });
    if (body.action === "step")
      return accountJson({ job: await stepReset(client, body.jobId) });
    if (body.action === "release")
      return accountJson(await releaseReset(client, body.jobId));
    throw new AccountError("คำสั่งไม่ถูกต้อง");
  } catch (error) {
    return accountError(error);
  }
}
