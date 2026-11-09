import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competition, HostedMatch } from "./hosted";
import {
  generateFixtures,
  fixturesConflict,
  type ManagedCompetition,
  type ManagedFixture,
} from "./admin-competitions";
import {
  compatibleRules,
  defaultPolicy,
  policyLimits,
  type RegistrationPolicy,
} from "./registration";

export type Management = {
  revision: number;
  format: "knockout" | "round_robin";
  teamLimit: number;
  details: string;
  teams: string[];
  fixtures: ManagedFixture[];
  groups?: { name: string; teams: string[] }[];
};
export function isGroupQualifier(label: string) {
  return /^ที่ [12] สาย [A-Za-z]+$/.test(label) || label === "ที่ 2 ดีที่สุด";
}
export function isEliminationFixture(
  management: Management | null,
  id: string,
) {
  const fixture = management?.fixtures.find((f) => f.id === id);
  return (
    !!management &&
    management.format === "knockout" &&
    fixture?.phase !== "group"
  );
}
export class CompetitionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function readManagement(policy: unknown): Management | null {
  const m = object(object(policy).management);
  if (
    !Number.isSafeInteger(m.revision) ||
    Number(m.revision) < 1 ||
    !["knockout", "round_robin"].includes(String(m.format)) ||
    !Number.isInteger(m.teamLimit) ||
    Number(m.teamLimit) < 2 ||
    typeof m.details !== "string" ||
    !Array.isArray(m.teams) ||
    !m.teams.every((x) => typeof x === "string") ||
    !Array.isArray(m.fixtures) ||
    !m.fixtures.every((x) => {
      const f = object(x);
      return (
        (f.phase === undefined ||
          f.phase === "group" ||
          f.phase === "knockout") &&
        (f.sourceNumber === undefined ||
          (Number.isSafeInteger(f.sourceNumber) &&
            Number(f.sourceNumber) > 0)) &&
        (f.resolvedHome === undefined || uuid(f.resolvedHome)) &&
        (f.resolvedAway === undefined || uuid(f.resolvedAway)) &&
        ["id", "round", "home", "away", "startsAt", "venue"].every(
          (k) => typeof f[k] === "string",
        )
      );
    })
  )
    return null;
  const fixtures = m.fixtures as ManagedFixture[];
  const numbers = fixtures.map((f, i) => f.sourceNumber || i + 1);
  if (new Set(numbers).size !== numbers.length) return null;
  if (
    m.groups !== undefined &&
    (!Array.isArray(m.groups) ||
      !m.groups.every((value) => {
        const g = object(value);
        return (
          typeof g.name === "string" &&
          Array.isArray(g.teams) &&
          g.teams.every(
            (t) => typeof t === "string" && (m.teams as string[]).includes(t),
          )
        );
      }))
  )
    return null;
  return m as unknown as Management;
}
export type ProductionManagedCompetition = ManagedCompetition & {
  managementRevision?: number;
  editable?: boolean;
};
export function managedFromHosted(
  competitions: Competition[],
  matches: HostedMatch[],
): ProductionManagedCompetition[] {
  return competitions.map((c) => {
    const m = readManagement(c.registration_policy);
    const rule = compatibleRules(c.sport, c.gender, c.age_group).find(
      (r) => r.id === c.registration_policy?.ruleId,
    );
    const actual = matches.filter((x) => x.competition_id === c.id);
    return {
      managementRevision: m?.revision || 0,
      editable: !!rule,
      id: c.id,
      name: c.name,
      sport: c.sport,
      ageGroup: c.age_group,
      gender: c.gender,
      details: m?.details || "",
      starters: rule?.starters || 0,
      reserves: c.registration_policy?.reserves || 0,
      teamLimit:
        m?.teamLimit ||
        Math.max(
          2,
          new Set(actual.flatMap((x) => [x.home_school_id, x.away_school_id]))
            .size,
        ),
      format: m?.format || "round_robin",
      winPoints: c.win_points,
      drawPoints: c.draw_points,
      lossPoints: c.loss_points,
      teams: m?.teams || [
        ...new Set(actual.flatMap((x) => [x.home_school_id, x.away_school_id])),
      ],
      groups: m?.groups,
      fixtures:
        m?.fixtures.map((f) => {
          const match = actual.find((x) => x.id === f.id);
          return match
            ? {
                ...f,
                ...(isGroupQualifier(f.home)
                  ? { resolvedHome: match.home_school_id }
                  : {}),
                ...(isGroupQualifier(f.away)
                  ? { resolvedAway: match.away_school_id }
                  : {}),
                startsAt: localTime(match.starts_at),
                venue: match.venue || "",
                referee_id: match.referee_id || undefined,
              }
            : f;
        }) ||
        actual.map((x) => ({
          id: x.id,
          round: x.group_name,
          home: x.home_school_id,
          away: x.away_school_id,
          startsAt: localTime(x.starts_at),
          venue: x.venue || "",
          ...(x.referee_id ? { referee_id: x.referee_id } : {}),
        })),
    };
  });
}
function localTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16)
    : "";
}
function dbError(error: unknown) {
  if (error)
    throw new CompetitionError(
      "บันทึกข้อมูลไม่สำเร็จ กรุณาโหลดข้อมูลใหม่แล้วลองอีกครั้ง",
      503,
    );
}
const integer = (v: unknown, min = 0, max = 1000) => {
  if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max)
    throw new CompetitionError("จำนวนไม่ถูกต้อง");
  return Number(v);
};
const text = (v: unknown, max = 200) => {
  if (typeof v !== "string" || v.length > max)
    throw new CompetitionError("ข้อความไม่ถูกต้อง");
  return v.trim();
};
const uuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function compatible(c: Competition, policy: unknown) {
  const p = object(policy);
  const rule = compatibleRules(c.sport, c.gender, c.age_group).find(
    (r) => r.id === p.ruleId,
  );
  if (!rule)
    throw new CompetitionError(
      "รายการเดิมไม่ตรงกับระเบียบที่รองรับ กรุณาตรวจสอบกับผู้จัดก่อนแก้ไข",
      409,
    );
  try {
    policyLimits(p as RegistrationPolicy);
  } catch (error) {
    throw new CompetitionError(
      error instanceof Error ? error.message : "ระเบียบไม่ถูกต้อง",
    );
  }
  return rule;
}
async function savePolicy(
  client: SupabaseClient,
  c: Competition,
  policy: Record<string, unknown>,
  old: Management | null,
  fields: Record<string, unknown> = {},
) {
  let q = client
    .from("competitions")
    .update({ ...fields, registration_policy: policy })
    .eq("id", c.id);
  q = old
    ? q.eq("registration_policy->management->>revision", String(old.revision))
    : q.is("registration_policy->management->>revision", null);
  const result = await q.select("id");
  dbError(result.error);
  if (!result.data?.length)
    throw new CompetitionError(
      "ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
      409,
    );
}
function checkConflicts(fixtures: ManagedFixture[], matches: HostedMatch[]) {
  for (const original of fixtures) {
    const f = {
      ...original,
      home: original.resolvedHome || original.home,
      away: original.resolvedAway || original.away,
    };
    if (!f.startsAt) continue;
    const candidate = {
      ...f,
      startsAt: new Date(
        f.startsAt + (/[zZ]|[+-]\d\d:\d\d$/.test(f.startsAt) ? "" : "+07:00"),
      ).toISOString(),
    };
    for (const match of matches) {
      if (match.id === f.id || !match.starts_at) continue;
      const other = {
        home: match.home_school_id,
        away: match.away_school_id,
        venue: match.venue || "",
        startsAt: new Date(match.starts_at).toISOString(),
      };
      if (fixturesConflict(candidate, other))
        throw new CompetitionError(
          "วันเวลาซ้ำกับโรงเรียนหรือสนามในโปรแกรมอื่น",
          409,
        );
    }
    for (const other of fixtures) {
      if (other.id === f.id || !other.startsAt) continue;
      if (
        fixturesConflict(candidate, {
          ...other,
          home: other.resolvedHome || other.home,
          away: other.resolvedAway || other.away,
          startsAt: new Date(
            other.startsAt +
              (/[zZ]|[+-]\d\d:\d\d$/.test(other.startsAt) ? "" : "+07:00"),
          ).toISOString(),
        })
      )
        throw new CompetitionError(
          "โปรแกรมแข่งขันมีวันเวลาโรงเรียนหรือสนามซ้ำ",
          409,
        );
    }
  }
}
async function materialize(
  client: SupabaseClient,
  c: Competition,
  m: Management,
  matches: HostedMatch[],
) {
  const resolved = new Map<string, string>();
  const resolve = (v: string, selected?: string) => {
    if (/^ผู้(ชนะ|แพ้)คู่ \d+$/.test(v)) return resolved.get(v);
    if (isGroupQualifier(v)) return selected;
    if (!uuid(v)) throw new CompetitionError("โรงเรียนในสายแข่งขันไม่ถูกต้อง");
    return v;
  };
  const ready: ManagedFixture[] = [];
  for (let index = 0; index < m.fixtures.length; index++) {
    const fixture = m.fixtures[index],
      home = resolve(fixture.home, fixture.resolvedHome),
      away = resolve(fixture.away, fixture.resolvedAway);
    const actual = matches.find((x) => x.id === fixture.id);
    if (
      !!actual &&
      ["finished", "confirmed"].includes(actual.status) &&
      actual.home_score !== null &&
      actual.away_score !== null &&
      actual.home_score !== actual.away_score
    ) {
      resolved.set(
        `ผู้ชนะคู่ ${fixture.sourceNumber || index + 1}`,
        actual.home_score > actual.away_score
          ? actual.home_school_id
          : actual.away_school_id,
      );
      resolved.set(
        `ผู้แพ้คู่ ${fixture.sourceNumber || index + 1}`,
        actual.home_score > actual.away_score
          ? actual.away_school_id
          : actual.home_school_id,
      );
    }
    if (!home || !away) continue;
    if (!uuid(home) || !uuid(away) || home === away)
      throw new CompetitionError("โรงเรียนในสายแข่งขันไม่ถูกต้อง");
    if (actual) {
      if (actual.home_school_id !== home || actual.away_school_id !== away)
        throw new CompetitionError(
          "ทีมในคู่ถัดไปไม่ตรงกับผลที่ยืนยัน กรุณาให้ผู้จัดตรวจสอบ",
          409,
        );
      continue;
    }
    // Production requires a real starts_at. Unsheduled bracket slots remain
    // metadata until the organizer supplies their time and venue.
    if (!fixture.startsAt || !fixture.venue) continue;
    ready.push({ ...fixture, home, away });
  }
  checkConflicts(ready, matches);
  for (const fixture of ready) {
    const home = fixture.home,
      away = fixture.away;
    const inserted = await client.from("matches").insert({
      id: fixture.id,
      competition_id: c.id,
      group_name: fixture.round,
      home_school_id: home,
      away_school_id: away,
      starts_at: fixture.startsAt ? fixture.startsAt + "+07:00" : null,
      venue: fixture.venue || null,
      referee_id: fixture.referee_id || null,
      status: "scheduled",
      home_score: null,
      away_score: null,
      revision: 1,
    });
    if (inserted.error) {
      const existing = await client
        .from("matches")
        .select("*")
        .eq("id", fixture.id)
        .maybeSingle();
      if (
        !existing.data ||
        existing.data.home_school_id !== home ||
        existing.data.away_school_id !== away
      )
        dbError(inserted.error);
    }
  }
}
export async function performCompetitionAction(
  client: SupabaseClient,
  body: Record<string, unknown>,
  actor: { id: string; role: string },
) {
  if (body.action !== "advance" && actor.role !== "admin")
    throw new CompetitionError("เฉพาะผู้ดูแลระบบเท่านั้น", 403);
  const [cr, mr] = await Promise.all([
    client.from("competitions").select("*"),
    client.from("matches").select("*"),
  ]);
  dbError(cr.error);
  dbError(mr.error);
  const competitions = (cr.data || []) as Competition[],
    matches = (mr.data || []) as HostedMatch[];
  if (body.action === "create") {
    const v = object(body.competition);
    const ruleId = text(v.ruleId);
    const c = {
      name: text(v.name),
      sport: text(v.sport),
      age_group: text(v.ageGroup),
      gender: text(v.gender),
      win_points: integer(v.winPoints),
      draw_points: integer(v.drawPoints),
      loss_points: integer(v.lossPoints),
    };
    if (!c.name) throw new CompetitionError("กรุณาระบุชื่อรายการ");
    const policy = defaultPolicy(ruleId);
    compatible(c as Competition, policy);
    const management: Management = {
      revision: 1,
      format: v.format === "knockout" ? "knockout" : "round_robin",
      teamLimit: integer(v.teamLimit, 2, 100),
      details: text(v.details || "", 2000),
      teams: [],
      fixtures: [],
    };
    const result = await client
      .from("competitions")
      .insert({ ...c, registration_policy: { ...policy, management } });
    dbError(result.error);
    return;
  }
  const source =
    body.action === "advance"
      ? matches.find((x) => x.id === body.matchId)
      : null;
  if (body.action === "advance") {
    if (!source) throw new CompetitionError("ไม่พบคู่แข่งขัน", 404);
    if (
      actor.role !== "admin" &&
      (!["recorder", "referee"].includes(actor.role) ||
        source.referee_id !== actor.id)
    )
      throw new CompetitionError("ไม่มีสิทธิ์เลื่อนทีมในคู่นี้", 403);
    if (
      !["finished", "confirmed"].includes(source.status) ||
      source.home_score === null ||
      source.away_score === null ||
      source.home_score === source.away_score
    )
      throw new CompetitionError("ต้องยืนยันผลที่มีผู้ชนะก่อนเลื่อนทีม", 409);
  }
  const c = competitions.find(
    (x) => x.id === (source?.competition_id || body.id),
  );
  if (!c) throw new CompetitionError("ไม่พบรายการแข่งขัน", 404);
  compatible(c, c.registration_policy);
  const old = readManagement(c.registration_policy);
  const fallback = managedFromHosted([c], matches)[0];
  const management: Management = old
    ? structuredClone(old)
    : {
        revision: 0,
        format: fallback.format,
        teamLimit: fallback.teamLimit,
        details: "",
        teams: fallback.teams,
        fixtures: fallback.fixtures,
      };
  if (old)
    management.fixtures = management.fixtures.map((f) => {
      const actual = matches.find(
        (x) => x.id === f.id && x.competition_id === c.id,
      );
      return actual
        ? {
            ...f,
            startsAt: localTime(actual.starts_at),
            venue: actual.venue || "",
            referee_id: actual.referee_id || undefined,
          }
        : f;
    });
  if (body.action === "advance") {
    if (
      !old ||
      old.format !== "knockout" ||
      !isEliminationFixture(old, source!.id)
    )
      throw new CompetitionError("ไม่พบสายคัดออกสำหรับคู่นี้", 409);
    checkConflicts(management.fixtures, matches);
    await materialize(client, c, management, matches);
    return;
  }
  if (body.revision !== undefined && body.revision !== (old?.revision || 0))
    throw new CompetitionError(
      "ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
      409,
    );
  let policy = { ...object(c.registration_policy) };
  const fields: Record<string, unknown> = {};
  if (body.action === "policy") {
    const incoming = object(body.policy);
    const candidate = {
      ruleId: incoming.ruleId,
      reserves: incoming.reserves,
      eventQuotas: incoming.eventQuotas,
      maxEventsPerAthlete: incoming.maxEventsPerAthlete,
    };
    compatible(c, candidate);
    policy = { ...policy, ...candidate };
  } else if (body.action === "draw") {
    if (c.sport === "กรีฑา")
      throw new CompetitionError(
        "กรีฑาใช้รายการวิ่งและผลการแข่งขัน ไม่ใช้การจัดสายโรงเรียน",
      );
    if (
      management.fixtures.length &&
      JSON.stringify(body.teams) === JSON.stringify(management.teams)
    ) {
      await materialize(client, c, management, matches);
      return;
    }
    if (
      matches.some((x) => x.competition_id === c.id) ||
      management.fixtures.length
    )
      throw new CompetitionError(
        "มีโปรแกรมแข่งขันแล้ว ไม่สามารถจัดสายใหม่ได้",
        409,
      );
    if (
      !Array.isArray(body.teams) ||
      body.teams.length > management.teamLimit ||
      !body.teams.every(uuid)
    )
      throw new CompetitionError("รายชื่อทีมไม่ถูกต้อง");
    const schools = await client.from("schools").select("id");
    dbError(schools.error);
    if (body.teams.some((id) => !schools.data?.some((s) => s.id === id)))
      throw new CompetitionError("ไม่พบโรงเรียนที่เลือก");
    management.teams = body.teams as string[];
    management.fixtures = generateFixtures(management.format, management.teams);
  } else if (body.action === "schedule") {
    const actual = matches.find((x) => x.id === body.fixtureId);
    if (!!actual && ["finished", "confirmed"].includes(actual.status))
      throw new CompetitionError(
        "คู่ที่ยืนยันผลแล้วไม่สามารถแก้ไขโปรแกรมได้",
        409,
      );
    const f = management.fixtures.find((x) => x.id === body.fixtureId);
    if (!f) throw new CompetitionError("ไม่พบคู่แข่งขัน", 404);
    for (const [key, side] of [
      ["resolvedHome", "home"],
      ["resolvedAway", "away"],
    ] as const) {
      if (body[key] === undefined) continue;
      if (!isGroupQualifier(f[side]))
        throw new CompetitionError("เลือกทีมได้เฉพาะช่องผู้ผ่านรอบแบ่งกลุ่ม");
      const selected = body[key];
      if (selected === "" || selected === null) {
        if (actual)
          throw new CompetitionError(
            "ไม่สามารถเปลี่ยนทีมที่มีคู่แข่งขันแล้ว",
            409,
          );
        delete f[key];
        continue;
      }
      const groupName = /^ที่ [12] สาย (.+)$/.exec(f[side])?.[1];
      const group = management.groups?.find((g) => g.name === groupName);
      if (
        !uuid(selected) ||
        !management.teams.includes(selected as string) ||
        (group && !group.teams.includes(selected as string))
      )
        throw new CompetitionError("โรงเรียนไม่อยู่ในสายที่เลือก");
      if (
        actual &&
        selected !==
          actual[side === "home" ? "home_school_id" : "away_school_id"]
      )
        throw new CompetitionError(
          "ไม่สามารถเปลี่ยนทีมที่มีคู่แข่งขันแล้ว",
          409,
        );
      f[key] = selected as string;
    }
    if ((f.resolvedHome || f.home) === (f.resolvedAway || f.away))
      throw new CompetitionError("โรงเรียนแข่งกับตัวเองไม่ได้");
    const participants = management.fixtures
      .filter((x) => x.round === f.round)
      .flatMap((x) => [x.resolvedHome || x.home, x.resolvedAway || x.away])
      .filter(uuid);
    if (
      new Set(participants).size !== participants.length &&
      f.phase === "knockout"
    )
      throw new CompetitionError("โรงเรียนซ้ำในรอบคัดออก");
    const startsAt = text(body.startsAt, 30);
    if (
      !startsAt ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) ||
      !Number.isFinite(new Date(startsAt + "+07:00").getTime())
    )
      throw new CompetitionError("วันเวลาไม่ถูกต้อง");
    f.startsAt = startsAt;
    f.venue = text(body.venue);
    if (!f.venue) throw new CompetitionError("กรุณาระบุสนามแข่งขัน");
    if (body.refereeId !== undefined) {
      if (body.refereeId !== null && !uuid(body.refereeId))
        throw new CompetitionError("กรรมการไม่ถูกต้อง");
      if (body.refereeId) {
        const referee = await client
          .from("profiles")
          .select("id,role")
          .eq("id", body.refereeId)
          .maybeSingle();
        dbError(referee.error);
        if (
          !referee.data ||
          !["referee", "recorder"].includes(referee.data.role)
        )
          throw new CompetitionError("บัญชีนี้ไม่ใช่กรรมการหรือผู้บันทึก");
        f.referee_id = body.refereeId as string;
      } else delete f.referee_id;
    }
    checkConflicts(management.fixtures, matches);
  } else if (body.action === "update") {
    const v = object(body.competition);
    if (v.name !== undefined) {
      fields.name = text(v.name);
      if (!fields.name) throw new CompetitionError("กรุณาระบุชื่อรายการ");
    }
    for (const [input, column] of [
      ["winPoints", "win_points"],
      ["drawPoints", "draw_points"],
      ["lossPoints", "loss_points"],
    ]) {
      if (v[input] !== undefined) fields[column] = integer(v[input]);
    }
    management.details = text(v.details, 2000);
    management.teamLimit = integer(
      v.teamLimit,
      Math.max(2, management.teams.length),
      100,
    );
    if (
      !management.fixtures.length &&
      ["knockout", "round_robin"].includes(String(v.format))
    )
      management.format = v.format as Management["format"];
  } else throw new CompetitionError("คำสั่งไม่ถูกต้อง");
  management.revision = (old?.revision || 0) + 1;
  policy.management = management;
  await savePolicy(client, c, policy, old, fields);
  if (body.action === "draw") await materialize(client, c, management, matches);
  if (body.action === "schedule") {
    const f = management.fixtures.find((x) => x.id === body.fixtureId)!;
    const actual = matches.find((x) => x.id === f.id);
    if (actual) {
      const result = await client
        .from("matches")
        .update({
          starts_at: f.startsAt ? f.startsAt + "+07:00" : null,
          venue: f.venue || null,
          referee_id: f.referee_id || null,
          revision: actual.revision + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", actual.id)
        .eq("revision", actual.revision)
        .eq("status", actual.status)
        .select("id");
      dbError(result.error);
      if (!result.data?.length)
        throw new CompetitionError(
          "ผลหรือโปรแกรมเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่",
          409,
        );
    } else await materialize(client, c, management, matches);
  }
}
