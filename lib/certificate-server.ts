import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AccountError,
  accountAdmin,
  accountProfile,
  authenticateAccount,
} from "./account-server";
import {
  readDocument,
  writeDocument,
  coachesPrefix,
  schoolUuid,
  type Coach,
} from "./school-storage";
import { readHosted } from "./hosted";
import { buildCertificateCandidates } from "./certificate-eligibility";
import {
  DEFAULT_CERTIFICATE_LAYOUT,
  type CertificateTemplate,
  type CertificateIssue,
  type CertificateRecord,
} from "./certificate-types";
export const templatePrefix = "certificate-settings";
export const defaultTemplate: CertificateTemplate = {
  background: null,
  layout: DEFAULT_CERTIFICATE_LAYOUT,
};
export const issuePrefix = (id: string) =>
  `certificate-issues/${schoolUuid(id)}`;
export async function certificateAccess(request: Request, adminOnly = false) {
  const { user, client } = await authenticateAccount(request);
  const profile = await accountProfile(client, user.id);
  if (
    !profile ||
    !(
      profile.role === "admin" ||
      (!adminOnly &&
        ["school", "school_admin"].includes(profile.role) &&
        profile.school_id)
    )
  )
    throw new AccountError("ไม่มีสิทธิ์จัดการเกียรติบัตร", 403);
  return { admin: accountAdmin(), profile, user };
}
export async function certificateSource(
  admin: SupabaseClient,
  competitionId: string,
) {
  const loaded = await readHosted(admin, true);
  const c = loaded.rows.competitions.find((c) => c.id === competitionId);
  if (!c) throw new AccountError("ไม่พบรายการแข่งขัน", 404);
  loaded.rows.competitions = [c];
  loaded.rows.registrations = loaded.rows.registrations.filter(
    (r) => r.competition_id === competitionId,
  );
  loaded.rows.matches = loaded.rows.matches.filter(
    (r) => r.competition_id === competitionId,
  );
  loaded.rows.athletics_events = loaded.rows.athletics_events.filter(
    (r) => r.competition_id === competitionId,
  );
  const eventIds = new Set(loaded.rows.athletics_events.map((e) => e.id));
  loaded.rows.athletics_results = loaded.rows.athletics_results.filter((r) =>
    eventIds.has(r.event_id),
  );
  loaded.rows.medals = loaded.rows.medals.filter(
    (r) => r.competition_id === competitionId,
  );
  const schoolIds = [
    ...new Set(loaded.rows.registrations.map((r) => r.school_id)),
  ].sort();
  const documents = await Promise.all(
    schoolIds.map((id) =>
      readDocument<Coach[]>(admin, coachesPrefix(id, competitionId), []),
    ),
  );
  const coaches = documents.flatMap((d) => d.value);
  const result = buildCertificateCandidates(loaded, coaches);
  const template = await readDocument(admin, templatePrefix, defaultTemplate);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        rows: loaded.rows,
        coaches,
        templateVersion: template.version,
        candidates: result.candidates,
        blocked: result.blocked,
      }),
    )
    .digest("hex");
  return { ...result, fingerprint, templateVersion: template.version };
}
export async function readIssue(admin: SupabaseClient, id: string) {
  return readDocument<CertificateIssue | null>(admin, issuePrefix(id), null);
}
export async function saveIssue(
  admin: SupabaseClient,
  issue: CertificateIssue,
  expected: unknown,
) {
  if (Buffer.byteLength(JSON.stringify(issue)) > 1_900_000)
    throw new AccountError(
      "รายชื่อเกียรติบัตรมีจำนวนมากเกินไป กรุณาติดต่อผู้ดูแล",
      413,
    );
  return writeDocument<CertificateIssue | null>(
    admin,
    issuePrefix(issue.competitionId),
    issue,
    expected,
    null,
  );
}
export async function issueTemplate(
  admin: SupabaseClient,
  version: string | null,
): Promise<CertificateTemplate> {
  if (version === null) return defaultTemplate;
  if (!/^[0-9a-f-]{36}\.json$/.test(version))
    throw new AccountError("เวอร์ชันแม่แบบไม่ถูกต้อง", 503);
  const r = await admin.storage
    .from("team-files")
    .download(`${templatePrefix}/${version}`);
  if (r.error || !r.data)
    throw new AccountError("อ่านแม่แบบเกียรติบัตรฉบับนี้ไม่สำเร็จ", 503);
  try {
    return JSON.parse(await r.data.text());
  } catch {
    throw new AccountError("ข้อมูลแม่แบบไม่สมบูรณ์", 503);
  }
}
export function ownIssue(
  issue: CertificateIssue | null,
  profile: { role: string; school_id: string | null },
) {
  return issue
    ? {
        ...issue,
        records:
          profile.role === "admin"
            ? issue.records
            : issue.records.filter((r) => r.schoolId === profile.school_id),
      }
    : null;
}
export function createCertificateRecords(
  candidates: Omit<CertificateRecord, "id" | "number">[],
  issueId: string,
) {
  return candidates.map((c, index) => ({
    ...c,
    id: randomUUID(),
    number: `NKG2569-${issueId.replaceAll("-", "").slice(0, 12).toUpperCase()}-${String(index + 1).padStart(4, "0")}`,
  }));
}
