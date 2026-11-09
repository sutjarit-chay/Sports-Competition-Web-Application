export type CertificateAward = "gold" | "silver" | "bronze" | "participation";
export type CertificateCandidate = {
  recipientId: string;
  recipientName: string;
  recipientType: "athlete" | "coach";
  schoolId: string;
  schoolName: string;
  competitionId: string;
  competitionName: string;
  event: string;
  award: CertificateAward;
};
export type CertificateRecord = CertificateCandidate & {
  id: string;
  number: string;
};
export type CertificateLayout = {
  nameY: number;
  schoolY: number;
  roleY: number;
  eventY: number;
  awardY: number;
  fontSize: number;
  qrX: number;
  qrY: number;
  qrSize: number;
};
export type CertificateTemplate = {
  background: string | null;
  layout: CertificateLayout;
};
export const DEFAULT_CERTIFICATE_LAYOUT: CertificateLayout = {
  nameY: 44,
  schoolY: 49,
  roleY: 53,
  eventY: 57,
  awardY: 61,
  fontSize: 22,
  qrX: 88,
  qrY: 83,
  qrSize: 8,
};
export const DEFAULT_CERTIFICATE_BACKGROUND =
  "/assets/certificates/nkg-2569-white-gold.png";
export type CertificateIssue = {
  competitionId: string;
  id: string;
  published: boolean;
  createdAt: string;
  issuedBy: string;
  fingerprint: string;
  templateVersion: string | null;
  records: CertificateRecord[];
};
export const CERTIFICATE_AWARD_LABELS: Record<CertificateAward, string> = {
  gold: "รางวัลชนะเลิศ เหรียญทอง",
  silver: "รางวัลรองชนะเลิศอันดับ 1 เหรียญเงิน",
  bronze: "รางวัลรองชนะเลิศอันดับ 2 เหรียญทองแดง",
  participation: "เข้าร่วมการแข่งขัน",
};
