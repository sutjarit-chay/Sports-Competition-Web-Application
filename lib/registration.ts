import catalog from "./registration-rules.json";
import type { Athlete } from "./domain";

export type RegistrationRule = {
  id: string;
  name: string;
  sport: string;
  genders: string[];
  levels: string[];
  starters: number | null;
  reserves: number | null;
  note: string;
};
export const RULES: RegistrationRule[] = catalog;
export const REGISTRATION_NOTICE =
  "จำนวนตัวสำรองเป็นแนวทางสำหรับการขึ้นทะเบียนเบื้องต้น การแข่งขันจริงให้ยึดระเบียบเฉพาะของผู้จัดการแข่งขันเป็นหลัก";
export const ATHLETICS_EVENTS = [
  { id: "run60", name: "วิ่ง 60 เมตร" },
  { id: "run80", name: "วิ่ง 80 เมตร" },
  { id: "run100", name: "วิ่ง 100 เมตร" },
  { id: "run200", name: "วิ่ง 200 เมตร" },
  { id: "miniMarathon", name: "มินิมาราธอน" },
  { id: "relay", name: "วิ่งผลัด" },
] as const;
export type RosterDetails = {
  ruleId: string;
  position: "starter" | "reserve" | "individual" | "auto";
  events: string[];
};
export type RegistrationPolicy = {
  ruleId: string;
  reserves: number | null;
  eventQuotas: Record<string, number>;
  maxEventsPerAthlete: number | null;
};
export function defaultPolicy(ruleId: string): RegistrationPolicy {
  const rule = getRule(ruleId);
  return {
    ruleId,
    reserves: rule.reserves,
    eventQuotas: {},
    maxEventsPerAthlete: null,
  };
}
export function getRule(id: string) {
  const rule = RULES.find((r) => r.id === id);
  if (!rule) throw Error("ไม่พบประเภทการแข่งขัน กรุณาเลือกรายการใหม่");
  return rule;
}
export function normalizeLevel(level: string) {
  return (
    ({ ประถม: "ประถมศึกษา", มัธยม: "มัธยมศึกษา" } as Record<string, string>)[
      level.trim()
    ] || level.trim()
  );
}
export function normalizeSport(sport: string) {
  return sport === "ตะกร้อ" ? "เซปักตะกร้อ" : sport;
}
export function compatibleRules(sport: string, gender: string, level: string) {
  const normalizedSport = normalizeSport(sport);
  return RULES.filter(
    (r) =>
      r.sport === normalizedSport &&
      (!r.genders.length || r.genders.includes(gender)) &&
      (!r.levels.length || r.levels.includes(normalizeLevel(level))),
  );
}
export function policyLimits(policy: RegistrationPolicy) {
  const rule = getRule(policy.ruleId);
  if (rule.reserves !== null && policy.reserves !== rule.reserves)
    throw Error("ห้ามเปลี่ยนจำนวนสำรองของประเภทที่กำหนดตายตัว");
  const reserves = rule.reserves === null ? policy.reserves : rule.reserves;
  if (
    reserves !== null &&
    (!Number.isSafeInteger(reserves) || reserves < 0 || reserves > 100)
  )
    throw Error("จำนวนสำรองไม่ถูกต้อง ต้องเป็นจำนวนเต็ม 0–100 คน");
  if (
    policy.maxEventsPerAthlete !== null &&
    (!Number.isInteger(policy.maxEventsPerAthlete) ||
      policy.maxEventsPerAthlete < 1 ||
      policy.maxEventsPerAthlete > ATHLETICS_EVENTS.length)
  )
    throw Error("จำนวนรายการต่อคนไม่ถูกต้อง");
  for (const [id, limit] of Object.entries(policy.eventQuotas)) {
    if (
      !ATHLETICS_EVENTS.some((e) => e.id === id && e.id !== "relay") ||
      !Number.isSafeInteger(limit) ||
      limit < 0 ||
      limit > 100
    )
      throw Error("โควตากรีฑาต้องเป็นจำนวนเต็ม 0–100 คนในรายการที่กำหนด");
  }
  return {
    rule,
    starters: rule.starters,
    reserves,
    maximum:
      rule.starters !== null && reserves !== null
        ? rule.starters + reserves
        : null,
  };
}
function scope(a: Athlete) {
  return [
    a.school_id,
    a.competition_id ||
      [normalizeSport(a.sport), a.gender, normalizeLevel(a.division)].join("|"),
  ].join("|");
}
export function validateRoster(
  existing: Athlete[],
  incoming: Athlete[],
  policy: RegistrationPolicy,
) {
  const { rule, starters, reserves, maximum } = policyLimits(policy);
  const replaceIds = new Set(incoming.map((a) => a.id));
  if (replaceIds.size !== incoming.length)
    throw Error("รหัสนักกีฬาซ้ำในชุดสมัคร");
  const combined = [
    ...existing.filter((a) => !replaceIds.has(a.id)),
    ...incoming,
  ];
  for (const a of incoming) {
    if (!a.name.trim() || !a.school_id || !a.division.trim())
      throw Error("กรอกชื่อ โรงเรียน และระดับชั้นให้ครบ");
    if (
      !compatibleRules(a.sport, a.gender, a.division).some(
        (r) => r.id === rule.id,
      )
    )
      throw Error("ประเภทกีฬา เพศ หรือระดับชั้นไม่ตรงกับรายการแข่งขัน");
    if (!a.roster || a.roster.ruleId !== rule.id)
      throw Error("กรุณาระบุประเภทการแข่งขันและสถานะนักกีฬา");
    if (!["starter", "reserve", "individual"].includes(a.roster.position))
      throw Error("สถานะตัวจริง/สำรองไม่ถูกต้อง");
    const peers = combined.filter(
      (x) =>
        scope(x) === scope(a) && (!x.roster || x.roster.ruleId === rule.id),
    );
    if (peers.filter((x) => x.name.trim() === a.name.trim()).length > 1)
      throw Error("ข้อมูลนักกีฬาซ้ำในรายการและโรงเรียนเดียวกัน");
    if (
      a.bib &&
      peers.filter((x) => x.bib?.trim() === a.bib?.trim()).length > 1
    )
      throw Error("bib ซ้ำในรายการแข่งขัน");
    if (rule.id === "athletics-individual") {
      if (a.roster.position !== "individual")
        throw Error("กรีฑาเดี่ยวต้องระบุสถานะผู้แข่งขัน");
      if (
        !a.roster.events.length ||
        new Set(a.roster.events).size !== a.roster.events.length
      )
        throw Error("เลือกรายการกรีฑาอย่างน้อยหนึ่งรายการ และไม่ซ้ำกัน");
      if (
        policy.maxEventsPerAthlete !== null &&
        a.roster.events.length > policy.maxEventsPerAthlete
      )
        throw Error(`ลงได้ไม่เกิน ${policy.maxEventsPerAthlete} รายการต่อคน`);
      if (peers.some((x) => !x.roster))
        throw Error(
          "มีข้อมูลกรีฑาเดิมที่ยังไม่ระบุรายการ กรุณาให้ผู้ดูแลตรวจทานก่อนสมัครเพิ่ม",
        );
      for (const id of a.roster.events) {
        const event = ATHLETICS_EVENTS.find(
          (e) => e.id === id && e.id !== "relay",
        );
        if (!event) throw Error("รายการกรีฑาไม่ถูกต้อง");
        const quota = policy.eventQuotas[id];
        if (quota === undefined)
          throw Error(`ผู้ดูแลยังไม่ได้กำหนดโควตา ${event.name}`);
        if (peers.filter((x) => x.roster?.events.includes(id)).length > quota)
          throw Error(`${event.name} เกินโควตา ${quota} คนต่อโรงเรียน`);
      }
    } else {
      if (reserves === null)
        throw Error("ผู้ดูแลยังไม่ได้กำหนดจำนวนสำรองตามระเบียบผู้จัด");
      if (a.roster.position === "individual")
        throw Error("กรุณาแยกนักกีฬาตัวจริงและนักกีฬาสำรอง");
      if (peers.length > maximum!)
        throw Error(`จำนวนรวมเกิน ${maximum} คนต่อโรงเรียนในรายการนี้`);
      if (
        peers.filter((x) => x.roster?.position === "starter").length > starters!
      )
        throw Error(`นักกีฬาตัวจริงเกิน ${starters} คน`);
      if (
        peers.filter((x) => x.roster?.position === "reserve").length > reserves
      )
        throw Error(`นักกีฬาสำรองเกิน ${reserves} คน`);
      if (
        rule.id === "athletics-relay" &&
        (a.roster.events.length !== 1 || a.roster.events[0] !== "relay")
      )
        throw Error("วิ่งผลัดต้องเลือกรายการวิ่งผลัด");
      if (rule.id !== "athletics-relay" && a.roster.events.length)
        throw Error("กีฬาทีมนี้ไม่รับรายการกรีฑา");
    }
  }
}
/** CSV without positions uses available slots; existing records are never rewritten. */
export function prepareRoster(
  existing: Athlete[],
  incoming: Athlete[],
  policy: RegistrationPolicy,
) {
  const { rule, starters, reserves } = policyLimits(policy);
  const prepared: Athlete[] = [];
  for (const a of incoming) {
    if (a.roster && a.roster.position !== "auto") {
      prepared.push({
        ...a,
        roster: { ...a.roster, events: [...a.roster.events] },
      });
      continue;
    }
    const peers = [...existing, ...prepared].filter(
      (x) =>
        scope(x) === scope(a) && (!x.roster || x.roster.ruleId === rule.id),
    );
    const starterCount = peers.filter(
      (x) => !x.roster || x.roster.position === "starter",
    ).length;
    const position =
      starters === null
        ? "individual"
        : starterCount < starters
          ? "starter"
          : "reserve";
    if (position === "reserve" && reserves === 0)
      throw Error("จำนวนเต็มแล้ว ไม่มีรายชื่อนักกีฬาสำรองในประเภทนี้");
    prepared.push({
      ...a,
      roster: {
        ruleId: rule.id,
        position,
        events: a.roster?.events.length
          ? [...a.roster.events]
          : rule.id === "athletics-relay"
            ? ["relay"]
            : [],
      },
    });
  }
  validateRoster(existing, prepared, policy);
  return prepared;
}
export function rosterLabel(a: Athlete) {
  if (!a.roster) return "ข้อมูลเดิม · ยังไม่ระบุตัวจริง/สำรอง";
  return {
    starter: "นักกีฬาตัวจริง",
    reserve: "นักกีฬาสำรอง",
    individual: "ผู้แข่งขันประเภทเดี่ยว",
    auto: "รอจัดสถานะก่อนบันทึก",
  }[a.roster.position];
}
export function eventNames(ids: string[]) {
  return ids
    .map((id) => ATHLETICS_EVENTS.find((e) => e.id === id)?.name || id)
    .join(", ");
}
