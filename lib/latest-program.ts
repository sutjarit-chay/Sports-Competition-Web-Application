import { createHash } from "node:crypto";
import { buildImageCompetitions, IMAGE_PROGRAM } from "./image-program";
import type { Competition } from "./hosted";
import { defaultPolicy } from "./registration";
import type { Management } from "./production-competitions";

const SOURCE_FILE = "สูจิบัตรกีฬากลุ่ม 69 12.11.69.pdf";
const VENUE = "สนามกีฬาโรงเรียนบ้านหนองแดน";
const date = (day: number) => `2026-11-${day}`;
const identity = (key: string) => {
  const h = createHash("sha256")
    .update(`nakhon-kosamphi/latest-program/2569/${key}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const normalize = (name: string) =>
  name
    .normalize("NFC")
    .replace(/^โรงเรียน\s*/, "")
    .replace(/\s+/g, "")
    .replace("บ้านดงซ่อม", "บ้านคงซ่อม")
    .replace(/^บ้านมะเดื่อชุมพร$/, "มะเดื่อชุมพร")
    .toLowerCase();
const source = (key: string, page: number) => ({
  kind: "latest-pdf-program",
  key,
  year: 2569,
  version: 1,
  file: SOURCE_FILE,
  page,
});
const schedule = (day: number) => ({
  competitionDate: date(day),
  sessionStart: "09:00",
  timeMode: "session" as const,
  startsAt: "",
  venue: VENUE,
});
type Slot = {
  sourceNumber: number;
  stage: "heat" | "final";
  heat: number;
  note?: string;
};
type AthleticsProgram = {
  eventId: string;
  eventName: string;
  levelBand: string;
  date: string;
  sessionStart: string;
  slots: Slot[];
};
export type LatestManagement = Management & {
  source: ReturnType<typeof source>;
  drawPending?: boolean;
  dateRange?: { start: string; end: string };
  registrationPendingReason?: string;
  athleticsProgram?: AthleticsProgram;
};
export type LatestCompetition = Competition & {
  registration_policy: ReturnType<typeof defaultPolicy> & {
    management: LatestManagement;
  };
};

/** Adds authoritative dates without changing any legacy competition or fixture identity. */
export function buildLatestProgram(
  schools: { id: string; name: string }[],
): LatestCompetition[] {
  const ids = new Map<string, string>();
  const legacySchools = Object.entries(IMAGE_PROGRAM.schools).map(
    ([key, name]) => {
      const matches = schools.filter(
        (s) =>
          normalize(s.name) === normalize(name) ||
          (key === "railampang" && normalize(s.name) === "banrailampang"),
      );
      if (matches.length !== 1)
        throw Error(
          matches.length
            ? `ชื่อโรงเรียนซ้ำ: ${name}`
            : `ยังไม่มีโรงเรียน: ${name}`,
        );
      ids.set(key, matches[0].id);
      return { id: matches[0].id, name };
    },
  );
  const pages = [19, 20, 21, 21, 23, 23, 25, 26];
  const existing = buildImageCompetitions(legacySchools).map((c, index) => {
    const m = c.registration_policy.management;
    return {
      ...c,
      registration_policy: {
        ...c.registration_policy,
        management: {
          ...m,
          details:
            "ตามสูจิบัตรฉบับ 12 พ.ย. 2569 เริ่มแข่งขัน 09.00 น. เป็นต้นไปตามลำดับคู่; ยังไม่ระบุเวลาแยกแต่ละคู่",
          source: source(IMAGE_PROGRAM.competitions[index].key, pages[index]),
          fixtures: m.fixtures.map((f, i) => {
            const n = f.sourceNumber!;
            const day =
              index === 0
                ? n <= 8
                  ? 16
                  : 17
                : index === 1
                  ? i < 5
                    ? 16
                    : 17
                  : index === 2
                    ? n <= 6
                      ? 16
                      : 17
                    : index === 3
                      ? 17
                      : index === 4
                        ? n <= 4
                          ? 17
                          : 18
                        : index === 5
                          ? 17
                          : index === 6
                            ? n <= 9
                              ? 17
                              : 18
                            : 18;
            return { ...f, ...schedule(day) };
          }),
        },
      },
    };
  }) as LatestCompetition[];
  const result = [...existing];
  const make = (
    key: string,
    name: string,
    sport: string,
    gender: string,
    level: string,
    ruleId: string,
    page: number,
    extra: Partial<LatestManagement> = {},
  ): LatestCompetition => ({
    id: identity(key),
    name,
    sport,
    gender,
    age_group: level,
    win_points: 3,
    draw_points: 1,
    loss_points: 0,
    registration_policy: {
      ...defaultPolicy(ruleId),
      management: {
        revision: 1,
        format: "round_robin",
        teamLimit: 12,
        teams: [],
        fixtures: [],
        details: "ตามสูจิบัตรฉบับ 12 พ.ย. 2569",
        source: source(key, page),
        ...extra,
      },
    },
  });
  const team = (key: string) => ids.get(key)!;
  const secondary = (
    sport: string,
    prefix: string,
    gender: string,
    pairs: string[][],
    page: number,
    rr = false,
  ) => {
    const key = `${prefix}-secondary-${gender === "ชาย" ? "male" : "female"}`;
    const fixtures = pairs.map(([home, away], i) => ({
      id: identity(`${key}/match/${i + 1}`),
      sourceNumber: i + 1,
      home: ids.has(home) ? team(home) : home,
      away: ids.has(away) ? team(away) : away,
      round: rr
        ? "รอบแรก"
        : i < 2
          ? "รอบแรก"
          : i === 2
            ? "ชิงที่ 3"
            : "ชิงชนะเลิศ",
      phase: rr ? ("group" as const) : ("knockout" as const),
      ...schedule(rr ? (i < 3 ? 16 : 17) : 18),
    }));
    result.push(
      make(
        key,
        `${sport}มัธยม${gender}`,
        sport,
        gender,
        "มัธยมศึกษา",
        `${prefix}-${gender === "ชาย" ? "male" : "female"}`,
        page,
        {
          format: rr ? "round_robin" : "knockout",
          teamLimit: 4,
          teams: ["thakhun", "nongdaen", "khongsom", "nonsombun"].map(team),
          fixtures,
          details:
            "เริ่ม 09.00 น. เป็นต้นไปตามลำดับคู่; ยังไม่ระบุเวลาแยกแต่ละคู่",
        },
      ),
    );
  };
  const finals = [
    ["ผู้แพ้คู่ 1", "ผู้แพ้คู่ 2"],
    ["ผู้ชนะคู่ 1", "ผู้ชนะคู่ 2"],
  ];
  secondary(
    "วอลเลย์บอล",
    "volleyball",
    "ชาย",
    [["thakhun", "nongdaen"], ["khongsom", "nonsombun"], ...finals],
    22,
  );
  secondary(
    "วอลเลย์บอล",
    "volleyball",
    "หญิง",
    [
      ["nongdaen", "khongsom"],
      ["thakhun", "nonsombun"],
      ["nongdaen", "thakhun"],
      ["khongsom", "nonsombun"],
      ["nonsombun", "nongdaen"],
      ["thakhun", "khongsom"],
    ],
    22,
    true,
  );
  secondary(
    "เซปักตะกร้อ",
    "takraw",
    "ชาย",
    [["khongsom", "nonsombun"], ["thakhun", "nongdaen"], ...finals],
    23,
  );
  secondary(
    "เซปักตะกร้อ",
    "takraw",
    "หญิง",
    [["nongdaen", "nonsombun"], ["thakhun", "khongsom"], ...finals],
    24,
  );
  for (const [band, level] of [
    ["primary", "ประถมศึกษา"],
    ["secondary", "มัธยมศึกษา"],
  ])
    for (const gender of ["ชาย", "หญิง"])
      result.push(
        make(
          `petanque-${band}-${gender === "ชาย" ? "male" : "female"}`,
          `เปตอง${level}${gender}`,
          "เปตอง",
          gender,
          level,
          `petanque-${gender === "ชาย" ? "male" : "female"}`,
          19,
          {
            drawPending: true,
            dateRange: { start: date(16), end: date(17) },
            details:
              "ทุกทีมที่ส่งเข้าร่วมการแข่งขัน จับฉลากประกบคู่ ณ สนามแข่งขัน วันที่ 16–17 พฤศจิกายน 2569",
          },
        ),
      );
  const athletics = (
    eventId: string,
    eventName: string,
    band: string,
    level: string,
    gender: string,
    heats: number[],
    final: number,
    note?: string,
  ) => {
    const slots: Slot[] = heats.map((n, i) => ({
      sourceNumber: n,
      stage: "heat",
      heat: i + 1,
      ...(note ? { note } : {}),
    }));
    slots.push({
      sourceNumber: final,
      stage: "final",
      heat: 1,
      ...(note ? { note } : {}),
    });
    const c = make(
      `athletics-${eventId}-${band}-${gender === "ชาย" ? "male" : "female"}`,
      `${eventName} ${band} ${gender}`,
      "กรีฑา",
      gender,
      level,
      "athletics-individual",
      final <= 121 ? 27 : 28,
      {
        athleticsProgram: {
          eventId,
          eventName,
          levelBand: band,
          date: date(20),
          sessionStart: "09:00",
          slots,
        },
        ...(eventId === "run50"
          ? {
              registrationPendingReason:
                "รอรองรับรายการวิ่ง 50 เมตรในระบบรับสมัครและฐานข้อมูล",
            }
          : {}),
      },
    );
    if (eventId !== "run50")
      c.registration_policy.eventQuotas = { [eventId]: 1 };
    result.push(c);
  };
  for (const [band, level] of [
    ["ประถมศึกษา", "ประถมศึกษา"],
    ["มัธยมศึกษา", "มัธยมศึกษา"],
  ])
    for (const gender of ["ชาย", "หญิง"])
      athletics(
        "miniMarathon",
        "มินิมาราธอน",
        band,
        level,
        gender,
        [],
        101,
        "ปล่อยตัวพร้อมกันทุกรุ่นตามรายการที่ 101",
      );
  athletics(
    "run50",
    "วิ่ง 50 เมตร",
    "อนุบาล",
    "อนุบาล",
    "หญิง",
    [102, 103],
    106,
  );
  athletics(
    "run50",
    "วิ่ง 50 เมตร",
    "อนุบาล",
    "อนุบาล",
    "ชาย",
    [104, 105],
    107,
  );
  athletics(
    "run80",
    "วิ่ง 80 เมตร",
    "อนุบาล",
    "อนุบาล",
    "หญิง",
    [108, 109],
    112,
  );
  athletics(
    "run80",
    "วิ่ง 80 เมตร",
    "อนุบาล",
    "อนุบาล",
    "ชาย",
    [110, 111],
    113,
  );
  athletics(
    "run60",
    "วิ่ง 60 เมตร",
    "ป.1–3",
    "ประถมศึกษา",
    "หญิง",
    [114, 115],
    118,
  );
  athletics(
    "run60",
    "วิ่ง 60 เมตร",
    "ป.1–3",
    "ประถมศึกษา",
    "ชาย",
    [116, 117],
    119,
  );
  athletics(
    "run100",
    "วิ่ง 100 เมตร",
    "ป.1–3",
    "ประถมศึกษา",
    "หญิง",
    [120, 121],
    124,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run100",
    "วิ่ง 100 เมตร",
    "ป.1–3",
    "ประถมศึกษา",
    "ชาย",
    [122, 123],
    125,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run100",
    "วิ่ง 100 เมตร",
    "ป.4–6",
    "ประถมศึกษา",
    "หญิง",
    [126, 127],
    130,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run100",
    "วิ่ง 100 เมตร",
    "ป.4–6",
    "ประถมศึกษา",
    "ชาย",
    [128, 129],
    131,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run100",
    "วิ่ง 100 เมตร",
    "ม.1–3",
    "มัธยมศึกษา",
    "หญิง",
    [],
    132,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run100",
    "วิ่ง 100 เมตร",
    "ม.1–3",
    "มัธยมศึกษา",
    "ชาย",
    [],
    133,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run200",
    "วิ่ง 200 เมตร",
    "ป.4–6",
    "ประถมศึกษา",
    "หญิง",
    [134, 135],
    138,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run200",
    "วิ่ง 200 เมตร",
    "ป.4–6",
    "ประถมศึกษา",
    "ชาย",
    [136, 137],
    139,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run200",
    "วิ่ง 200 เมตร",
    "ม.1–3",
    "มัธยมศึกษา",
    "หญิง",
    [],
    140,
    "ใช้สนาม 80 เมตร",
  );
  athletics(
    "run200",
    "วิ่ง 200 เมตร",
    "ม.1–3",
    "มัธยมศึกษา",
    "ชาย",
    [],
    141,
    "ใช้สนาม 80 เมตร",
  );
  return result;
}
