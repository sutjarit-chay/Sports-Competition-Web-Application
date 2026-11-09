import { randomUUID } from "node:crypto";
import {
  accountBody,
  accountError,
  accountJson,
  AccountError,
} from "@/lib/account-server";
import {
  certificateAccess,
  certificateSource,
  readIssue,
  saveIssue,
  ownIssue,
  createCertificateRecords,
} from "@/lib/certificate-server";
import { schoolUuid } from "@/lib/school-storage";
import { assertCompetitionOpen } from "@/lib/competition-reset";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { admin, profile } = await certificateAccess(request);
    const id = schoolUuid(
      new URL(request.url).searchParams.get("competitionId"),
    );
    const current = await readIssue(admin, id);
    return accountJson({
      issue: ownIssue(current.value, profile),
      version: profile.role === "admin" ? current.version : null,
    });
  } catch (e) {
    return accountError(e);
  }
}
export async function POST(request: Request) {
  try {
    const { admin, user } = await certificateAccess(request, true);
    const body = await accountBody(request);
    const id = schoolUuid(body.competitionId);
    await assertCompetitionOpen(admin);
    if (body.action === "preview")
      return accountJson(await certificateSource(admin, id));
    if (body.action !== "publish" && body.action !== "revoke")
      throw new AccountError("คำสั่งเกียรติบัตรไม่ถูกต้อง");
    const current = await readIssue(admin, id);
    if (current.version !== body.expectedVersion)
      throw new AccountError(
        "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่ก่อนดำเนินการ",
        409,
      );
    if (body.action === "revoke") {
      if (!current.value)
        throw new AccountError("ยังไม่มีเกียรติบัตรที่เผยแพร่", 404);
      const saved = await saveIssue(
        admin,
        { ...current.value, published: false },
        body.expectedVersion,
      );
      return accountJson({ issue: saved.value, version: saved.version });
    }
    const source = await certificateSource(admin, id);
    if (source.fingerprint !== body.fingerprint)
      throw new AccountError(
        "ข้อมูลผล รายชื่อ หรือพื้นหลังเปลี่ยนแล้ว กรุณาตรวจตัวอย่างใหม่",
        409,
      );
    if (source.blocked.length || !source.candidates.length)
      throw new AccountError(
        "ยังเผยแพร่ไม่ได้ กรุณาตรวจผลการแข่งขันและรายชื่อให้ครบก่อน",
        409,
      );
    const issueId = randomUUID();
    const saved = await saveIssue(
      admin,
      {
        competitionId: id,
        id: issueId,
        published: true,
        createdAt: new Date().toISOString(),
        issuedBy: user.id,
        fingerprint: source.fingerprint,
        templateVersion: source.templateVersion,
        records: createCertificateRecords(source.candidates, issueId),
      },
      body.expectedVersion,
    );
    return accountJson({ issue: saved.value, version: saved.version });
  } catch (e) {
    return accountError(e);
  }
}
