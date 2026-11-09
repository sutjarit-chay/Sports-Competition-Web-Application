import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import JSZip from "jszip";
import { validateCertificateTemplate } from "../lib/certificate-template";
import {
  renderCertificatePdf,
  renderCertificateZip,
} from "../lib/certificate-pdf";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  type CertificateRecord,
} from "../lib/certificate-types";

const record: CertificateRecord = {
  id: "../../escape",
  number: "../bad",
  recipientId: "a1",
  recipientName: "สมชาย ใจดี ผู้เข้าแข่งขันชื่อยาวมาก ".repeat(5),
  recipientType: "athlete",
  schoolId: "s1",
  schoolName: "โรงเรียนทดสอบ",
  competitionId: "c1",
  competitionName: "กีฬานักเรียน",
  event: "วิ่ง 100 เมตร",
  award: "gold",
};
async function template() {
  const bytes = await sharp({
    create: { width: 1200, height: 850, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  return {
    bytes,
    validated: await validateCertificateTemplate({
      background: bytes.toString("base64"),
      layout: DEFAULT_CERTIFICATE_LAYOUT,
    }),
  };
}
test("template validates raster bytes and preserves originals", async () => {
  const { bytes, validated } = await template();
  assert.equal(
    validated.background,
    `data:image/png;base64,${bytes.toString("base64")}`,
  );
  assert.deepEqual(
    await validateCertificateTemplate({
      background: null,
      layout: DEFAULT_CERTIFICATE_LAYOUT,
    }),
    { background: null, layout: DEFAULT_CERTIFICATE_LAYOUT },
  );
});
test("template rejects malformed, noncanonical, mismatched, corrupt and oversized content", async () => {
  const { bytes } = await template();
  const inputs = [
    "<svg/>",
    "data:image/svg+xml;base64,PHN2Zy8+",
    "AAAA=",
    "AB==",
    bytes.toString("base64") + "\n",
    `data:image/jpeg;base64,${bytes.toString("base64")}`,
    bytes.subarray(0, 50).toString("base64"),
    Buffer.alloc(1_300_001).toString("base64"),
  ];
  for (const background of inputs)
    await assert.rejects(
      validateCertificateTemplate({
        background,
        layout: DEFAULT_CERTIFICATE_LAYOUT,
      }),
    );
});
test("template rejects invalid dimensions and QR bounds", async () => {
  const bytes = await sharp({
    create: { width: 1000, height: 1000, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    validateCertificateTemplate({
      background: bytes.toString("base64"),
      layout: DEFAULT_CERTIFICATE_LAYOUT,
    }),
  );
  for (const layout of [
    { ...DEFAULT_CERTIFICATE_LAYOUT, fontSize: NaN },
    { ...DEFAULT_CERTIFICATE_LAYOUT, qrX: 95, qrSize: 12 },
    { ...DEFAULT_CERTIFICATE_LAYOUT, qrY: 95 },
  ])
    await assert.rejects(
      validateCertificateTemplate({ background: null, layout }),
    );
});
test("PDF embeds Thai fonts and produces exactly one page per record including long Unicode names", async () => {
  const { validated } = await template();
  const pdf = await renderCertificatePdf(
    [record, { ...record, id: "second" }],
    validated,
    "https://example.test",
    { preview: true },
  );
  const raw = pdf.toString("latin1");
  assert.ok(raw.startsWith("%PDF-"));
  assert.equal((raw.match(/\/Type \/Page\b/g) ?? []).length, 2);
  assert.match(raw, /\/FontFile2/);
  assert.match(raw, /\/ToUnicode/);
  assert.ok(pdf.length > 10_000);
});
test("issued PDF contains QR image while preview excludes active QR", async () => {
  const { validated } = await template();
  const issued = await renderCertificatePdf(
    [record],
    validated,
    "https://example.test",
  );
  const preview = await renderCertificatePdf(
    [record],
    validated,
    "https://example.test",
    { preview: true },
  );
  const images = (pdf: Buffer) =>
    (pdf.toString("latin1").match(/\/Subtype \/Image\b/g) ?? []).length;
  assert.ok(images(issued) > images(preview));
});
test("ZIP filenames cannot traverse paths via recipient data or IDs", async () => {
  const { validated } = await template();
  const zipped = await renderCertificateZip(
    [record],
    validated,
    "https://example.test",
    { preview: true },
  );
  const archive = await JSZip.loadAsync(zipped);
  assert.deepEqual(Object.keys(archive.files), ["certificate-0001.pdf"]);
  assert.ok(
    (await archive.file("certificate-0001.pdf")!.async("nodebuffer"))
      .toString("latin1")
      .startsWith("%PDF-"),
  );
});

test("multi-page PDF embeds the original background once", async () => {
  const { validated } = await template();
  const single = await renderCertificatePdf(
    [record],
    validated,
    "https://example.test",
    { preview: true },
  );
  const multiple = await renderCertificatePdf(
    [record, { ...record, id: "second" }, { ...record, id: "third" }],
    validated,
    "https://example.test",
    { preview: true },
  );
  const countImages = (pdf: Buffer) =>
    (pdf.toString("latin1").match(/\/Subtype \/Image\b/g) ?? []).length;
  assert.equal(countImages(single), 1);
  assert.equal(countImages(multiple), 1);
  assert.equal(
    (multiple.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
    3,
  );
});

test("template rejects overlapping text positions instead of silently clipping names", async () => {
  await assert.rejects(
    validateCertificateTemplate({
      background: null,
      layout: {
        ...DEFAULT_CERTIFICATE_LAYOUT,
        schoolY: DEFAULT_CERTIFICATE_LAYOUT.nameY,
      },
    }),
  );
});
