import { createHash } from "node:crypto";
import source from "../data/competition-program-2569.json";
import {
  defaultPolicy,
  policyLimits,
  type RegistrationPolicy,
} from "./registration";
import { readManagement, type Management } from "./production-competitions";
import type { Competition } from "./hosted";
type SourceFixture = {
  sourceNumber: number;
  home: string;
  away: string;
  round: string;
  phase?: "group" | "knockout";
  sourceBlock: number;
};
type SourceCompetition = {
  key: string;
  name: string;
  ruleId: string;
  gender: string;
  level: string;
  format: "knockout" | "round_robin";
  sourcePage: number;
  teams: string[];
  groups: { name: string; teams: string[] }[];
  fixtures: SourceFixture[];
};
type ImageProgram = {
  version: number;
  year: number;
  sourceImages: string[];
  sourceVenueLabel: string;
  sourceStartHint: string;
  scheduleStatus: string;
  schools: Record<string, string>;
  pendingAthletics: {
    genderAgeTablePending: boolean;
    individualQuotaPerSchoolPerEvent: number;
    maxEventsPerAthlete: number | null;
    relayTeamsPerSchool: number;
    relayStarters: number;
    relayReserves: number;
  };
  competitions: SourceCompetition[];
};
export const IMAGE_PROGRAM = source as ImageProgram;
export type ImageCompetition = Omit<Competition, "registration_policy"> & {
  registration_policy: RegistrationPolicy & {
    management: Management & {
      source: {
        kind: string;
        key: string;
        version: number;
        year: number;
        page: number;
        images: string[];
      };
    };
  };
};
function identity(key: string) {
  const h = createHash("sha256")
    .update(
      `nakhon-kosamphi/image-program/${IMAGE_PROGRAM.year}/${IMAGE_PROGRAM.version}/${key}`,
    )
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const normalize = (v: string) =>
  v
    .normalize("NFC")
    .trim()
    .replace(/^โรงเรียน\s*/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
export function buildImageCompetitions(
  schools: { id: string; name: string }[],
): ImageCompetition[] {
  const ids = new Map<string, string>();
  for (const [key, name] of Object.entries(IMAGE_PROGRAM.schools)) {
    const matches = schools.filter(
      (s) =>
        normalize(s.name) === normalize(name) ||
        (key === "railampang" && normalize(s.name) === "banrailampang"),
    );
    if (matches.length > 1) throw Error(`ชื่อโรงเรียนซ้ำ: ${name}`);
    if (!matches.length) throw Error(`ยังไม่มีโรงเรียน: ${name}`);
    ids.set(key, matches[0].id);
  }
  return IMAGE_PROGRAM.competitions.map((c) => {
    if (
      new Set(c.teams).size !== c.teams.length ||
      c.teams.some((key) => !ids.has(key))
    )
      throw Error(`รายชื่อทีมไม่ถูกต้อง: ${c.name}`);
    const numbers = new Set<number>();
    const fixtures = c.fixtures.map((f) => {
      if (
        !Number.isSafeInteger(f.sourceNumber) ||
        f.sourceNumber < 1 ||
        numbers.has(f.sourceNumber)
      )
        throw Error(`เลขคู่ซ้ำหรือไม่ถูกต้อง: ${c.name}`);
      const participant = (value: string) => {
        if (ids.has(value)) {
          if (!c.teams.includes(value))
            throw Error(`ทีมอยู่นอกรายการ: ${c.name}`);
          return ids.get(value)!;
        }
        const ref = /^ผู้(?:ชนะ|แพ้)คู่ (\d+)$/.exec(value);
        if (ref) {
          if (!numbers.has(Number(ref[1])))
            throw Error(`อ้างอิงคู่ก่อนหน้าไม่ถูกต้อง: ${c.name}`);
          return value;
        }
        if (/^ที่ [12] สาย [A-Z]$/.test(value) || value === "ที่ 2 ดีที่สุด")
          return value;
        throw Error(`ชื่อโรงเรียนหรือช่องเข้ารอบไม่ถูกต้อง: ${value}`);
      };
      const home = participant(f.home),
        away = participant(f.away);
      if (home === away) throw Error(`คู่แข่งขันซ้ำทีมตนเอง: ${c.name}`);
      numbers.add(f.sourceNumber);
      return {
        ...f,
        id: identity(`${c.key}/match/${f.sourceNumber}`),
        home,
        away,
        startsAt: "",
        venue: "",
      };
    });
    const policy = defaultPolicy(c.ruleId);
    policyLimits(policy);
    const row: ImageCompetition = {
      id: identity(c.key),
      sport: policyLimits(policy).rule.sport,
      name: c.name,
      age_group: c.level,
      gender: c.gender,
      win_points: 3,
      draw_points: 1,
      loss_points: 0,
      registration_policy: {
        ...policy,
        management: {
          revision: 1,
          format: c.format,
          teamLimit: c.teams.length,
          details:
            "ตามภาพที่ผู้จัดยืนยัน 9 พ.ย. 2569; รอกำหนดวันเวลา สนาม และกรรมการ; ผู้จัดยืนยันทีมเข้ารอบแบ่งสายตามระเบียบ",
          teams: c.teams.map((key) => ids.get(key)!),
          groups: c.groups.map((g) => ({
            name: g.name,
            teams: g.teams.map((key) => {
              if (!c.teams.includes(key))
                throw Error("ทีมในสายไม่อยู่ในรายการ");
              return ids.get(key)!;
            }),
          })),
          fixtures,
          source: {
            kind: "user-image-program",
            key: c.key,
            version: IMAGE_PROGRAM.version,
            year: IMAGE_PROGRAM.year,
            page: c.sourcePage,
            images: IMAGE_PROGRAM.sourceImages,
          },
        },
      },
    };
    if (!readManagement(row.registration_policy))
      throw Error(`รูปแบบตารางไม่ถูกต้อง: ${c.name}`);
    return row;
  });
}
