import { accountBody, accountError, AccountError } from "@/lib/account-server";
import {
  certificateAccess,
  certificateSource,
  readIssue,
  issueTemplate,
  defaultTemplate,
  templatePrefix,
} from "@/lib/certificate-server";
import { readDocument, schoolUuid } from "@/lib/school-storage";
import {
  renderCertificatePdf,
  renderCertificateZip,
} from "@/lib/certificate-pdf";
import type { CertificateRecord } from "@/lib/certificate-types";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { admin, profile } = await certificateAccess(request);
    const body = await accountBody(request);
    const id = schoolUuid(body.competitionId);
    if (!["pdf", "zip"].includes(String(body.format)))
      throw new AccountError("เลือกรูปแบบ PDF หรือ ZIP");
    let records: CertificateRecord[],
      template = defaultTemplate;
    if (body.preview === true) {
      if (profile.role !== "admin")
        throw new AccountError("เฉพาะผู้ดูแลสามารถดูตัวอย่างได้", 403);
      const source = await certificateSource(admin, id);
      const t = await readDocument(admin, templatePrefix, defaultTemplate);
      template = t.value;
      const candidate = source.candidates[0] || {
        recipientId: "preview",
        recipientName: "ตัวอย่างชื่อผู้รับเกียรติบัตร",
        recipientType: "athlete" as const,
        schoolId: "preview",
        schoolName: "ตัวอย่างชื่อโรงเรียน",
        competitionId: id,
        competitionName: "ตัวอย่างรายการแข่งขัน",
        event: "ตัวอย่างกีฬา ประเภท และรุ่น",
        award: "participation" as const,
      };
      records = [
        { ...candidate, id: "preview", number: "ตัวอย่าง — ยังไม่ได้เผยแพร่" },
      ];
    } else {
      const issue = (await readIssue(admin, id)).value;
      if (!issue?.published)
        throw new AccountError(
          "ยังไม่มีเกียรติบัตรที่เผยแพร่ หรือถูกยกเลิกแล้ว",
          404,
        );
      records = issue.records.filter(
        (r) => profile.role === "admin" || r.schoolId === profile.school_id,
      );
      if (body.schoolId) {
        const schoolId = schoolUuid(body.schoolId);
        if (profile.role !== "admin" && schoolId !== profile.school_id)
          throw new AccountError("ดาวน์โหลดได้เฉพาะโรงเรียนตนเอง", 403);
        records = records.filter((r) => r.schoolId === schoolId);
      }
      if (body.ids !== undefined) {
        if (
          !Array.isArray(body.ids) ||
          !body.ids.length ||
          body.ids.length > 50 ||
          body.ids.some((v: unknown) => typeof v !== "string")
        )
          throw new AccountError("เลือกรายชื่อไม่เกิน 50 ฉบับ");
        const available = new Set(records.map((r) => r.id));
        if (body.ids.some((v: string) => !available.has(v)))
          throw new AccountError(
            "ไม่มีสิทธิ์ดาวน์โหลดเกียรติบัตรที่เลือก",
            403,
          );
        const wanted = new Set(body.ids);
        records = records.filter((r) => wanted.has(r.id));
      }
      template = await issueTemplate(admin, issue.templateVersion);
    }
    if (!records.length)
      throw new AccountError(
        "ไม่มีเกียรติบัตรสำหรับโรงเรียนหรือรายชื่อที่เลือก",
        404,
      );
    if (records.length > 50)
      throw new AccountError("กรุณาเลือกดาวน์โหลดครั้งละไม่เกิน 50 ฉบับ", 413);
    // One request cannot exhaust serverless memory with dozens of independent image PDFs.
    if (body.format === "zip" && records.length > 10)
      throw new AccountError(
        "ZIP ดาวน์โหลดครั้งละไม่เกิน 10 ฉบับ หรือเลือก PDF รวม",
        413,
      );
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const bytes =
      body.format === "zip"
        ? await renderCertificateZip(records, template, origin, {
            preview: body.preview === true,
          })
        : await renderCertificatePdf(records, template, origin, {
            preview: body.preview === true,
          });
    if (bytes.byteLength > 4_000_000)
      throw new AccountError(
        "ไฟล์ชุดนี้มีขนาดใหญ่ กรุณาลดจำนวนรายชื่อ หรือเลือก PDF รวมแทน ZIP",
        413,
      );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          body.format === "zip" ? "application/zip" : "application/pdf",
        "Content-Disposition": `attachment; filename="certificates-${id}.${body.format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return accountError(e);
  }
}
