import { accountError, accountJson, AccountError } from "@/lib/account-server";
import {
  certificateAccess,
  defaultTemplate,
  templatePrefix,
} from "@/lib/certificate-server";
import { readDocument, writeDocument } from "@/lib/school-storage";
import { validateCertificateTemplate } from "@/lib/certificate-template";
import { DEFAULT_CERTIFICATE_BACKGROUND } from "@/lib/certificate-types";
import { assertCompetitionOpen } from "@/lib/competition-reset";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { admin } = await certificateAccess(request, true);
    const current = await readDocument(admin, templatePrefix, defaultTemplate);
    return accountJson({
      template: current.value,
      version: current.version,
      defaultBackground: DEFAULT_CERTIFICATE_BACKGROUND,
    });
  } catch (e) {
    return accountError(e);
  }
}
async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("ไม่พบข้อมูล");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1_900_000) {
      await reader.cancel();
      throw new AccountError(
        "ภาพมีขนาดใหญ่เกินไป รองรับภาพไม่เกิน 1.3 MB",
        413,
      );
    }
    chunks.push(value);
  }
  try {
    const b = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!b || typeof b !== "object" || Array.isArray(b)) throw Error();
    return b;
  } catch {
    throw new AccountError("รูปแบบข้อมูลไม่ถูกต้อง");
  }
}
export async function PUT(request: Request) {
  try {
    const { admin } = await certificateAccess(request, true);
    await assertCompetitionOpen(admin);
    const b = await body(request);
    let template;
    try {
      template = await validateCertificateTemplate(b.template);
    } catch (error) {
      throw new AccountError(
        error instanceof Error ? error.message : "ข้อมูลแม่แบบไม่ถูกต้อง",
      );
    }
    const saved = await writeDocument(
      admin,
      templatePrefix,
      template,
      b.expectedVersion,
      defaultTemplate,
    );
    return accountJson({
      template: saved.value,
      version: saved.version,
      defaultBackground: DEFAULT_CERTIFICATE_BACKGROUND,
    });
  } catch (e) {
    return accountError(e);
  }
}
