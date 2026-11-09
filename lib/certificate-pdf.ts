import { AccountError } from "./account-server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import JSZip from "jszip";
import path from "node:path";
import { readFile } from "node:fs/promises";
import {
  CERTIFICATE_AWARD_LABELS,
  DEFAULT_CERTIFICATE_BACKGROUND,
  type CertificateRecord,
  type CertificateTemplate,
} from "./certificate-types";
import { decodeCertificateBackground } from "./certificate-template";

type Options = { preview?: boolean };
export async function renderCertificatePdf(
  records: CertificateRecord[],
  template: CertificateTemplate,
  verificationBaseUrl: string,
  { preview = false }: Options = {},
): Promise<Buffer> {
  if (!records.length) throw new Error("ไม่มีรายการเกียรติบัตร");
  const background = template.background
    ? decodeCertificateBackground(template.background).bytes
    : await readFile(
        path.join(process.cwd(), "public", DEFAULT_CERTIFICATE_BACKGROUND),
      );
  // PDFKit caches string image sources across pages; Buffer sources are re-embedded.
  // A data URL keeps the original bytes and gives every page one shared image object.
  const backgroundSource = `data:image/${background[0] === 255 ? "jpeg" : "png"};base64,${background.toString("base64")}`;
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 0,
    autoFirstPage: false,
    info: { Title: "เกียรติบัตรการแข่งขันกีฬา" },
  });
  doc.registerFont(
    "Sarabun",
    path.join(process.cwd(), "public/fonts/sarabun-regular.ttf"),
  );
  doc.registerFont(
    "SarabunBold",
    path.join(process.cwd(), "public/fonts/sarabun-bold.ttf"),
  );
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  try {
    for (const record of records) {
      doc.addPage();
      const { width, height } = doc.page;
      doc.image(backgroundSource, 0, 0, { width, height });
      const l = template.layout;
      const lines = [
        { y: l.nameY, text: record.recipientName, bold: true },
        { y: l.schoolY, text: record.schoolName },
        {
          y: l.roleY,
          text: record.recipientType === "coach" ? "ผู้ฝึกสอน" : "นักกีฬา",
        },
        {
          y: l.eventY,
          text:
            record.event === record.competitionName
              ? record.competitionName
              : `${record.competitionName} · ${record.event}`,
        },
        {
          y: l.awardY,
          text: CERTIFICATE_AWARD_LABELS[record.award],
          bold: true,
        },
      ].sort((a, b) => a.y - b.y);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const y = (height * line.y) / 100;
        const availableHeight = Math.max(
          1,
          Math.min(
            40,
            i + 1 < lines.length
              ? ((lines[i + 1].y - line.y) * height) / 100 - 1
              : height - y - 12,
          ),
        );
        const nearQr =
          y + availableHeight >= (height * l.qrY) / 100 &&
          y <= (height * l.qrY) / 100 + (width * l.qrSize) / 100;
        const textWidth = nearQr
          ? Math.max(100, (width * l.qrX) / 100 - 64)
          : width - 128;
        doc.font(line.bold ? "SarabunBold" : "Sarabun");
        let fontSize = l.fontSize * (line.bold ? 1 : 0.8);
        const opts = { width: textWidth, align: "center" as const, lineGap: 0 };
        doc.fontSize(fontSize);
        while (
          fontSize > 8 &&
          doc.heightOfString(line.text, opts) > availableHeight
        ) {
          fontSize -= 0.5;
          doc.fontSize(fontSize);
        }
        if (doc.heightOfString(line.text, opts) > availableHeight)
          throw new AccountError(
            "ข้อความยาวเกินพื้นที่ กรุณาปรับตำแหน่งข้อความในแม่แบบก่อนดาวน์โหลด",
          );
        doc.fillColor("#392c13").text(line.text, 64, y, {
          ...opts,
          height: availableHeight,
          ellipsis: false,
        });
      }
      doc
        .font("Sarabun")
        .fontSize(9)
        .fillColor("#584d36")
        .text(`เลขที่ ${record.number}`, 48, height - 35, {
          width: width - 96,
          align: "left",
          lineBreak: false,
        });
      if (preview) {
        doc
          .save()
          .opacity(0.22)
          .font("SarabunBold")
          .fontSize(60)
          .fillColor("#a52d2d")
          .text("ตัวอย่างเกียรติบัตร", 80, height * 0.67, {
            width: width - 160,
            align: "center",
            lineBreak: false,
          })
          .restore();
      } else {
        const url = new URL(
          "certificates/verify",
          verificationBaseUrl.replace(/\/?$/, "/"),
        );
        url.searchParams.set("competitionId", record.competitionId);
        url.searchParams.set("certificateId", record.id);
        const qr = await QRCode.toBuffer(url.toString(), {
          type: "png",
          errorCorrectionLevel: "M",
          margin: 1,
          width: 280,
        });
        doc.image(qr, (width * l.qrX) / 100, (height * l.qrY) / 100, {
          width: (width * l.qrSize) / 100,
        });
      }
    }
    doc.end();
  } catch (error) {
    doc.end();
    await completed;
    throw error;
  }
  return completed;
}

export async function renderCertificateZip(
  records: CertificateRecord[],
  template: CertificateTemplate,
  verificationBaseUrl: string,
  options: Options = {},
): Promise<Buffer> {
  const zip = new JSZip();
  for (let i = 0; i < records.length; i++) {
    zip.file(
      `certificate-${String(i + 1).padStart(4, "0")}.pdf`,
      await renderCertificatePdf(
        [records[i]],
        template,
        verificationBaseUrl,
        options,
      ),
    );
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
