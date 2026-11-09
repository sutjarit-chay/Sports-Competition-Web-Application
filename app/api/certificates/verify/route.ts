import {
  accountAdmin,
  accountError,
  accountJson,
  AccountError,
} from "@/lib/account-server";
import { readIssue } from "@/lib/certificate-server";
import { schoolUuid } from "@/lib/school-storage";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const u = new URL(request.url),
      competitionId = schoolUuid(u.searchParams.get("competitionId")),
      id = schoolUuid(u.searchParams.get("certificateId"));
    const current = await readIssue(accountAdmin(), competitionId);
    const r = current.value?.published
      ? current.value.records.find((r) => r.id === id)
      : null;
    if (!r)
      throw new AccountError(
        "ไม่พบเกียรติบัตรที่ใช้งานได้ หรือฉบับนี้ถูกยกเลิกแล้ว",
        404,
      );
    return accountJson({
      valid: true,
      certificate: {
        id: r.id,
        number: r.number,
        recipientName: r.recipientName,
        recipientType: r.recipientType,
        schoolName: r.schoolName,
        competitionName: r.competitionName,
        event: r.event,
        award: r.award,
        issuedAt: current.value!.createdAt,
      },
    });
  } catch (e) {
    return accountError(e);
  }
}
