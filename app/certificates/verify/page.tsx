import { GET as verify } from "@/app/api/certificates/verify/route";
import {
  CERTIFICATE_AWARD_LABELS,
  type CertificateAward,
} from "@/lib/certificate-types";
export const dynamic = "force-dynamic";
export default async function VerifyCertificate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["competitionId", "certificateId"])
    if (typeof params[key] === "string") query.set(key, params[key] as string);
  const response = await verify(
    new Request(
      `https://certificate-verification.internal/api/certificates/verify?${query}`,
    ),
  );
  const data = await response.json();
  const c = data.certificate;
  return (
    <main className="certificate-verification">
      <section className="panel">
        <p className="eyebrow">นครโกสัมพีเกมส์ ปีการศึกษา 2569</p>
        <h1>ตรวจสอบเกียรติบัตร</h1>
        {response.ok && c ? (
          <>
            <p className="certificate-success">
              เกียรติบัตรฉบับนี้ได้รับการยืนยันจากระบบ
            </p>
            <dl>
              <dt>เลขเกียรติบัตร</dt>
              <dd>{c.number}</dd>
              <dt>ชื่อผู้รับ</dt>
              <dd>{c.recipientName}</dd>
              <dt>ประเภทผู้รับ</dt>
              <dd>{c.recipientType === "coach" ? "ผู้ฝึกสอน" : "นักกีฬา"}</dd>
              <dt>โรงเรียน</dt>
              <dd>{c.schoolName}</dd>
              <dt>รายการแข่งขัน</dt>
              <dd>
                {c.competitionName}
                {c.event !== c.competitionName ? ` · ${c.event}` : ""}
              </dd>
              <dt>รางวัล</dt>
              <dd>{CERTIFICATE_AWARD_LABELS[c.award as CertificateAward]}</dd>
            </dl>
          </>
        ) : (
          <p role="alert" className="certificate-error">
            {data.error || "ตรวจสอบเกียรติบัตรไม่สำเร็จ กรุณาลองใหม่"}
          </p>
        )}
        <a href="/">กลับหน้าเว็บไซต์</a>
      </section>
    </main>
  );
}
