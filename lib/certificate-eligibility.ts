import type { Snapshot } from "./hosted";
import type { Coach } from "./school-storage";
import type {
  CertificateAward,
  CertificateCandidate,
} from "./certificate-types";
import { calculateMedalAwards } from "./medal-calculation";
import { rankRace } from "./domain";
import { readManagement } from "./production-competitions";
import { ATHLETICS_EVENTS } from "./registration";

const order: CertificateAward[] = ["gold", "silver", "bronze", "participation"];
const best = (awards: CertificateAward[]): CertificateAward =>
  order.find((a) => awards.includes(a)) || "participation";
const medal = (rank: number | null): CertificateAward =>
  rank === 1
    ? "gold"
    : rank === 2
      ? "silver"
      : rank === 3
        ? "bronze"
        : "participation";
const eventName = (id: string) =>
  ATHLETICS_EVENTS.find((e) => e.id === id)?.name || id;

/** Derive recipients only from trusted registrations and completed source results. */
export function buildCertificateCandidates(
  snapshot: Snapshot,
  coaches: Coach[],
): { candidates: CertificateCandidate[]; blocked: string[] } {
  const candidates: CertificateCandidate[] = [];
  const blocked: string[] = [];
  for (const competition of [...snapshot.rows.competitions].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const athletes = snapshot.state.athletes.filter(
      (a) => a.competition_id === competition.id,
    );
    const local: CertificateCandidate[] = [];
    const fail = (reason: string) =>
      blocked.push(`${competition.name}: ${reason}`);
    const add = (
      id: string,
      name: string,
      schoolId: string,
      event: string,
      award: CertificateAward,
      recipientType: "athlete" | "coach" = "athlete",
    ) => {
      const school = snapshot.state.schools.find((s) => s.id === schoolId);
      if (!school) {
        fail("ไม่พบข้อมูลโรงเรียนของผู้รับ");
        return;
      }
      local.push({
        recipientId: id,
        recipientName: name,
        recipientType,
        schoolId,
        schoolName: school.name,
        competitionId: competition.id,
        competitionName: competition.name,
        event,
        award,
      });
    };
    if (competition.sport !== "กรีฑา") {
      const matches = snapshot.state.matches.filter(
        (m) => m.competition_id === competition.id,
      );
      const management = readManagement(competition.registration_policy);
      const rawManagement =
        competition.registration_policy &&
        "management" in competition.registration_policy;
      if (
        (rawManagement && !management) ||
        !matches.length ||
        (management &&
          (!management.fixtures.length ||
            management.fixtures.length !== matches.length ||
            management.fixtures.some(
              (f) => !matches.some((m) => m.id === f.id),
            ))) ||
        matches.some(
          (m) =>
            m.status !== "finished" ||
            !Number.isFinite(m.home_score) ||
            !Number.isFinite(m.away_score) ||
            (m.expectedFixtureCount !== undefined &&
              m.expectedFixtureCount !== matches.length) ||
            ((m.phase === "knockout" ||
              (m.format === "knockout" && m.phase !== "group") ||
              (management?.format === "knockout" &&
                management.fixtures.find((f) => f.id === m.id)?.phase !==
                  "group") ||
              /รอบชิง|รอบรอง|semi|final|third|อันดับ/i.test(m.pool)) &&
              m.home_score === m.away_score),
        )
      ) {
        fail("การแข่งขันยังไม่ครบหรือผลการแข่งขันยังไม่ยืนยัน");
        continue;
      }
      const awards = calculateMedalAwards({
        matches,
        races: [],
        athletes,
        pointsByCompetition: {
          [competition.id]: {
            win: competition.win_points,
            draw: competition.draw_points,
            loss: competition.loss_points,
          },
        },
      });
      if (!awards.length) {
        fail("ยังไม่มีผลตัดสินรางวัลที่สมบูรณ์");
        continue;
      }
      if (
        athletes.some(
          (a) =>
            !matches.some(
              (m) => m.home === a.school_id || m.away === a.school_id,
            ),
        )
      ) {
        fail("โรงเรียนที่ลงทะเบียนยังไม่มีผลการแข่งขัน");
        continue;
      }
      for (const a of athletes) {
        add(
          a.id,
          a.name,
          a.school_id,
          competition.name,
          best(
            awards
              .filter((w) => w.school_id === a.school_id)
              .map((w) => w.medal as CertificateAward),
          ),
        );
      }
    } else {
      const races = snapshot.state.races.filter(
        (r) => r.competition_id === competition.id,
      );
      const events = new Set([
        ...athletes.flatMap((a) => (a.roster?.events || []).map(eventName)),
        ...races.map((r) => r.event),
        ...snapshot.rows.athletics_events
          .filter((e) => e.competition_id === competition.id)
          .map((e) => e.name),
      ]);
      let invalid = athletes.some((a) => !a.roster?.events.length);
      if (invalid) fail("นักกรีฑาบางคนไม่มีรายการที่ลงทะเบียน");
      const bibs = athletes
        .filter((a) => a.bib)
        .map((a) => `${a.school_id}:${a.bib}`);
      if (new Set(bibs).size !== bibs.length) {
        fail("หมายเลขประจำตัวนักกรีฑาซ้ำ ไม่สามารถระบุผู้รับได้");
        continue;
      }
      if (!events.size) {
        fail("ยังไม่มีรายการกรีฑาที่สมบูรณ์");
        continue;
      }
      for (const event of events) {
        const eventRaces = races.filter((r) => r.event === event);
        const finals = races.filter(
          (r) => r.event === event && r.stage === "final",
        );
        const relay =
          /relay|ผลัด/i.test(event) || finals.some((r) => r.kind === "relay");
        const registered = athletes.filter((a) =>
          a.roster?.events.some((e) => eventName(e) === event),
        );
        const eventDefs = snapshot.rows.athletics_events.filter(
          (e) => e.competition_id === competition.id && e.name === event,
        );
        if (
          !finals.length ||
          eventDefs.some((e) => !eventRaces.some((r) => r.event_id === e.id)) ||
          eventRaces.some(
            (r) =>
              !["OK", "DNS", "DNF", "DQ"].includes(r.status) ||
              (r.status === "OK" &&
                (r.value === null || !Number.isFinite(r.value))),
          ) ||
          !finals.some((r) => r.status === "OK")
        ) {
          fail(`${event}: ผลรอบชิงยังไม่สมบูรณ์`);
          invalid = true;
          continue;
        }
        const ranked = rankRace(finals, finals[0].direction === "desc");
        for (const a of registered) {
          const identifies = (r: (typeof races)[number]) =>
            relay
              ? r.school_id === a.school_id
              : r.athlete_id === a.id &&
                (!r.school_id || r.school_id === a.school_id);
          const participation = eventRaces.filter(identifies);
          const rows = ranked.filter((r) => identifies(r));
          if (rows.length > 1 || !participation.length) {
            fail(`${event}: ไม่พบผลยืนยันการเข้าร่วมของ ${a.name}`);
            invalid = true;
            continue;
          }
          // DNS confirms nonattendance; prior settled heats still prove participation.
          if (!participation.some((r) => r.status !== "DNS")) continue;
          add(
            a.id,
            a.name,
            a.school_id,
            event,
            rows.length ? medal(rows[0].rank) : "participation",
          );
        }
        if (
          eventRaces.some(
            (r) =>
              !registered.some((a) =>
                relay
                  ? a.school_id === r.school_id
                  : a.id === r.athlete_id &&
                    (!r.school_id || a.school_id === r.school_id),
              ),
          )
        ) {
          fail(`${event}: ผลการแข่งขันไม่ตรงกับผู้ลงทะเบียน`);
          invalid = true;
        }
      }
      // Participation requires the whole competition to be settled; unknown identity blocks issuance.
      if (invalid) continue;
    }
    for (const coach of coaches.filter(
      (c) => c.competition_id === competition.id,
    )) {
      const team = local.filter((c) => c.schoolId === coach.school_id);
      if (team.length)
        add(
          coach.id,
          coach.name,
          coach.school_id,
          competition.name,
          best(team.map((c) => c.award)),
          "coach",
        );
    }
    candidates.push(...local);
  }
  return {
    candidates: candidates.sort(
      (a, b) =>
        a.competitionId.localeCompare(b.competitionId) ||
        a.recipientId.localeCompare(b.recipientId) ||
        a.event.localeCompare(b.event),
    ),
    blocked: [...new Set(blocked)].sort(),
  };
}
