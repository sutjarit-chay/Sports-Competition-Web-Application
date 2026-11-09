import sharp from "sharp";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  type CertificateLayout,
  type CertificateTemplate,
} from "./certificate-types";

const MAX_IMAGE_BYTES = 1_300_000;
export function decodeCertificateBackground(value: string): {
  bytes: Buffer;
  mime: string;
} {
  if (value.length > 1_800_000) throw new Error("ภาพพื้นหลังมีขนาดใหญ่เกินไป");
  const match =
    /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  const encoded = match ? match[2] : value;
  if (
    !encoded ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  )
    throw new Error("รูปแบบ Base64 ไม่ถูกต้อง");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== encoded)
    throw new Error("ข้อมูลภาพไม่ถูกต้องหรือใหญ่เกินไป");
  const mime = bytes
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : null;
  if (!mime || (match && match[1] !== mime))
    throw new Error("รองรับเฉพาะภาพ PNG และ JPEG");
  return { bytes, mime };
}

export async function validateCertificateTemplate(
  value: unknown,
): Promise<CertificateTemplate> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("แม่แบบไม่ถูกต้อง");
  const input = value as Record<string, unknown>;
  if (
    !input.layout ||
    typeof input.layout !== "object" ||
    Array.isArray(input.layout)
  )
    throw new Error("ตำแหน่งข้อความไม่ถูกต้อง");
  const source = input.layout as Record<string, unknown>;
  const layout = {} as CertificateLayout;
  for (const key of Object.keys(
    DEFAULT_CERTIFICATE_LAYOUT,
  ) as (keyof CertificateLayout)[]) {
    const n = source[key];
    const min = key === "fontSize" ? 10 : 5;
    const max = key === "fontSize" ? 36 : key === "qrSize" ? 12 : 95;
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max)
      throw new Error(`ตำแหน่ง ${key} ไม่ถูกต้อง`);
    layout[key] = n;
  }
  const positions = [
    layout.nameY,
    layout.schoolY,
    layout.roleY,
    layout.eventY,
    layout.awardY,
  ].sort((a, b) => a - b);
  if (
    positions.some(
      (value, index) => index > 0 && value - positions[index - 1] < 3,
    )
  )
    throw new Error("ตำแหน่งข้อความต้องห่างกันอย่างน้อย 3% เพื่อให้อ่านได้ครบ");
  // QR size is a percentage of page width; its height must account for A4 aspect ratio.
  if (
    layout.qrX + layout.qrSize > 100 ||
    layout.qrY + layout.qrSize * Math.SQRT2 > 100
  )
    throw new Error("QR ต้องอยู่ภายในกระดาษ");
  let background: string | null = null;
  if (input.background !== null) {
    if (typeof input.background !== "string")
      throw new Error("ภาพพื้นหลังไม่ถูกต้อง");
    const { bytes, mime } = decodeCertificateBackground(input.background);
    try {
      const image = sharp(bytes, {
        limitInputPixels: 20_000_000,
        failOn: "warning",
        animated: false,
      });
      const meta = await image.metadata();
      const width = meta.width ?? 0,
        height = meta.height ?? 0;
      if (
        (meta.format !== "png" && meta.format !== "jpeg") ||
        (meta.pages ?? 1) !== 1 ||
        width < 800 ||
        width > 6000 ||
        height < 400 ||
        height > 6000 ||
        width * height > 20_000_000 ||
        width / height < 1.2 ||
        width / height > 1.8
      )
        throw new Error("dimensions");
      // Decode all pixels, not merely the header, to reject truncated/corrupt files.
      await image.raw().toBuffer();
    } catch {
      throw new Error("ภาพเสียหายหรือขนาดภาพไม่เหมาะสม");
    }
    background = `data:${mime};base64,${bytes.toString("base64")}`;
  }
  const result = { background, layout };
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 1_900_000)
    throw new Error("แม่แบบมีขนาดใหญ่เกินไป");
  return result;
}
