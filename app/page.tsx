"use client";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import {
  SPORTS,
  initialState,
  parseAthletes,
  standings,
  rankRace,
  medals,
  State,
  Athlete,
  Match,
  Race,
  Award,
} from "../lib/domain";
import {
  calculateMedalAwards,
  groupSchoolsByMedalCategory,
  hasMultiplePoolsAwaitingFinal,
} from "../lib/medal-calculation";
import { supabase } from "../lib/supabase";
import {
  readHosted,
  writeHosted,
  findCompetition,
  type Snapshot,
} from "../lib/hosted";
import Papa from "papaparse";
import {
  RegistrationRulesTable,
  RosterRegistrationPanel,
} from "@/components/registration-panel";
import {
  RULES,
  compatibleRules,
  defaultPolicy,
  policyLimits,
  prepareRoster,
  getRule,
  normalizeLevel,
  normalizeSport,
  type RegistrationPolicy,
} from "@/lib/registration";
import PerspectiveTunnelHero from "@/components/ui/perspective-tunnel-hero";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardPenLine,
  Activity,
  ChartNoAxesColumn,
  Medal,
  Settings2,
  Trophy,
  ShieldCheck,
  ArrowRight,
  CircleDot,
  School,
  CircleCheck,
  LoaderCircle,
  CircleAlert,
  Info,
  X,
  Menu,
  ChevronRight,
  Volleyball,
  Goal,
  Target,
  CircleDashed,
  CircleArrowUp,
  UserRound,
  ChevronDown,
  Check,
  type LucideIcon,
} from "lucide-react";
import AdminCompetitionManager from "@/components/admin-competition-manager";
import SchoolPortal from "@/components/school-portal";
import {
  managedFromHosted,
  readManagement,
} from "@/lib/production-competitions";
import {
  isManagedCompetition,
  fixturesConflict,
  type ManagedCompetition,
} from "@/lib/admin-competitions";
import { buildScheduleMatches } from "@/lib/schedule-view";
import SpiderSchedule from "@/components/spider-schedule";
import AccountLogin from "@/components/account-login";
import AccountApprovals from "@/components/account-approvals";
import AdminAccountManager from "@/components/admin-account-manager";
import AdminSchoolManager from "@/components/admin-school-manager";
import AdminMaintenance from "@/components/admin-maintenance";
import type { AccountStatus } from "@/lib/account-types";
const tabs = [
  "ภาพรวม",
  "นักกีฬา",
  "ตารางแข่งขัน",
  "บันทึกผล",
  "กรีฑา",
  "ตารางคะแนน",
  "เหรียญรางวัล",
  "โรงเรียน / บัญชี",
  "จัดการรายการแข่งขัน",
  "ข้อมูลโรงเรียน",
  "นักกีฬาและครูผู้ฝึกซ้อม",
];
const viewerTabIndices = [0, 2, 5, 6, 7];
function availableTabIndices(role: string) {
  if (role === "viewer") return viewerTabIndices;
  if (role === "recorder" || role === "referee") return [0, 2, 3, 4, 7];
  if (role === "school" || role === "school_admin")
    return [0, 1, 2, 5, 6, 7, 9, 10];
  if (role === "admin") return [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return viewerTabIndices;
}
const icons = [
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardPenLine,
  Activity,
  ChartNoAxesColumn,
  Medal,
  Settings2,
  Trophy,
  School,
  Users,
];
const mobileTabLabels: Record<number, string> = {
  0: "ภาพรวม",
  1: "นักกีฬา",
  2: "ตารางแข่ง",
  3: "บันทึกผล",
  4: "กรีฑา",
  5: "คะแนน",
  6: "เหรียญรางวัล",
  8: "รายการ",
  9: "ข้อมูล",
  10: "รายชื่อ",
};
const sportIcons = [
  Goal,
  Volleyball,
  CircleDot,
  Target,
  CircleDashed,
  Activity,
  CircleArrowUp,
  CircleDot,
];
const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  school: "โรงเรียน",
  school_admin: "โรงเรียน",
  recorder: "กรรมการ",
  referee: "กรรมการ",
  viewer: "ผู้ชม",
};
const roleIcons: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  school: School,
  school_admin: School,
  recorder: ClipboardPenLine,
  referee: ClipboardPenLine,
  viewer: UserRound,
};
export default function Home() {
  const [data, setData] = useState<State>(initialState),
    [tab, setTab] = useState(0),
    [ready, setReady] = useState(false),
    [role, setRole] = useState("viewer"),
    [school, setSchool] = useState(""),
    [message, setMessage] = useState(""),
    [sport, setSport] = useState(SPORTS[0]),
    [division, setDivision] = useState("ประถม"),
    [gender, setGender] = useState("ชาย"),
    [busy, setBusy] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const refreshGeneration = useRef(0);
  const mounted = useRef(true);
  const [registrationRuleId, setRegistrationRuleId] = useState("football-male");
  const [messageKind, setMessageKind] = useState<"success" | "error">("error");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountState, setAccountState] = useState<AccountStatus | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 701px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const nav = document.getElementById("main-navigation");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nav?.querySelector<HTMLButtonElement>("nav button")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
      if (event.key === "Tab") {
        const controls = [
          ...(nav?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || []),
        ].filter((el): el is HTMLButtonElement => !!el);
        const index = controls.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (event.shiftKey && index === 0) {
          event.preventDefault();
          controls.at(-1)?.focus();
        } else if (!event.shiftKey && index === controls.length - 1) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [profileId, setProfileId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventKind, setEventKind] = useState("track");
  const [eventDirection, setEventDirection] = useState("asc");
  const [eventUnit, setEventUnit] = useState("s");
  const [newEventStartsAt, setNewEventStartsAt] = useState("");
  const [newEventVenue, setNewEventVenue] = useState("");
  const [eventRefereeId, setEventRefereeId] = useState("");
  const [event, setEvent] = useState("วิ่ง 100 เมตร"),
    [stage, setStage] = useState("heat"),
    [heat, setHeat] = useState(1);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("account") === "1")
      setTab(7);
  }, []);
  function chooseCompetition(id: string, source = snapshot) {
    const c = source?.rows.competitions.find((c) => c.id === id);
    if (!c) return;
    setCompetitionId(c.id);
    setSport(c.sport);
    setDivision(c.age_group);
    setGender(c.gender);
    if (id !== competitionId) {
      setEventId("");
      setEventRefereeId("");
    }
  }
  async function refresh() {
    const generation = ++refreshGeneration.current;
    if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
    const { data: session, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) throw Error(sessionError.message);
    let profile: {
      id: string;
      role: string;
      school_id: string | null;
    } | null = null;
    let pending: AccountStatus | null = null;
    if (session.session) {
      const { data: auth, error } = await supabase.auth.getUser();
      if (error) throw Error(error.message);
      if (auth.user) {
        const res = await supabase
          .from("profiles")
          .select("id,role,school_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (res.error) throw Error(res.error.message);
        profile = res.data;
        if (
          (!profile || profile.role === "viewer") &&
          (auth.user.app_metadata.registration ||
            auth.user.email?.endsWith("@accounts.sports-competition.invalid"))
        ) {
          const response = await fetch("/api/school-account", {
            headers: {
              Authorization: `Bearer ${session.session.access_token}`,
            },
          });
          const status = await response.json();
          if (!response.ok)
            throw Error(status.error || "ตรวจสอบสถานะคำขอไม่สำเร็จ");
          pending = status.account;
        }
      }
    }
    const loaded = await readHosted(
      supabase,
      !!profile &&
        ["admin", "recorder", "referee", "school", "school_admin"].includes(
          profile.role,
        ),
    );
    const publicResponse = await fetch("/api/school-profile?public=1");
    const publicBody = await publicResponse.json();
    if (!publicResponse.ok)
      throw Error(publicBody.error || "โหลดข้อมูลโรงเรียนไม่สำเร็จ");
    const extras = new Map<string, Record<string, unknown>>(
      (publicBody.schools || []).map((item: { id: string }) => [item.id, item]),
    );
    loaded.state.schools = loaded.state.schools.map((item) => ({
      ...item,
      ...extras.get(item.id),
      id: item.id,
      name: item.name,
    }));
    loaded.state.matches = loaded.state.matches.map((match) => {
      const policy = loaded.rows.competitions.find(
        (c) => c.id === match.competition_id,
      )?.registration_policy;
      const management = readManagement(policy);
      return management
        ? {
            ...match,
            format: management.format,
            phase: management.fixtures.find((f) => f.id === match.id)?.phase,
          }
        : match;
    });
    if (!mounted.current || generation !== refreshGeneration.current) return;
    setLoadFailed(false);
    setAccessToken(session.session?.access_token || "");
    // Commit permissions and data together only after every read succeeds.
    setSnapshot(loaded);
    setAccountState(pending);
    setData(loaded.state);
    setProfileId(profile?.id || "");
    const nextRole = profile?.role || "viewer";
    setRole(nextRole);
    if (!availableTabIndices(nextRole).includes(tab)) setTab(0);
    setSchool(
      profile?.school_id ||
        (profile?.role === "admin" ? loaded.state.schools[0]?.id || "" : ""),
    );
    const assignedCompetitionIds =
      nextRole === "recorder" || nextRole === "referee"
        ? new Set([
            ...loaded.state.matches
              .filter((match) => match.referee_id === profile?.id)
              .map((match) => match.competition_id)
              .filter((id): id is string => !!id),
            ...loaded.rows.athletics_events
              .filter((event) => event.referee_id === profile?.id)
              .map((event) => event.competition_id),
          ])
        : undefined;
    const availableCompetitions = assignedCompetitionIds
      ? loaded.rows.competitions.filter((item) =>
          assignedCompetitionIds.has(item.id),
        )
      : loaded.rows.competitions;
    const c =
      availableCompetitions.find((item) => item.id === competitionId) ||
      availableCompetitions[0];
    if (c) chooseCompetition(c.id, loaded);
    else {
      setCompetitionId("");
      setSport("");
      setDivision("");
      setGender("");
    }
  }
  useEffect(() => {
    mounted.current = true;
    const load = async () => {
      try {
        await refresh();
      } catch (error) {
        if (!mounted.current) return;
        setLoadFailed(true);
        setMessageKind("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "โหลดข้อมูล Supabase ไม่สำเร็จ",
        );
      } finally {
        if (mounted.current) setReady(true);
      }
    };
    void load();
    const listener = supabase?.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      // Clear privileged/private state before revalidating a changed session.
      ++refreshGeneration.current;
      setRole("viewer");
      setProfileId("");
      setSchool("");
      setAccessToken("");
      setSnapshot(null);
      setAccountState(null);
      setData(initialState());
      setReady(false);
      setTimeout(() => {
        if (mounted.current) void load();
      }, 0);
    });
    return () => {
      mounted.current = false;
      ++refreshGeneration.current;
      listener?.data.subscription.unsubscribe();
    };
  }, []);
  const managedCompetitions = useMemo(
    () =>
      managedFromHosted(
        snapshot?.rows.competitions || [],
        snapshot?.rows.matches || [],
      ),
    [snapshot],
  );
  async function mutateCompetition(action: Record<string, unknown>) {
    const current = await supabase?.auth.getSession();
    const token = current?.data.session?.access_token;
    if (!token) throw Error("กรุณาเข้าสู่ระบบใหม่");
    const response = await fetch("/api/competitions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(action),
    });
    const body = await response.json();
    if (!response.ok) {
      try {
        await refresh();
      } catch {
        /* Keep the original mutation error visible. */
      }
      throw Error(body.error || "บันทึกรายการแข่งขันไม่สำเร็จ");
    }
    await refresh();
  }
  function downloadCsv(name: string, rows: Record<string, string>[]) {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + Papa.unparse(rows)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  const actionLock = useRef(false);
  async function run(
    action: () => Promise<void> | void,
    rethrow = false,
    successMessage = "บันทึกเรียบร้อย",
  ) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessageKind("success");
      setMessage(successMessage);
    } catch (e) {
      setMessageKind("error");
      setMessage(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      if (rethrow) throw e;
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function save<K extends keyof State>(table: K, rows: State[K]) {
    if (table === "matches") {
      for (const match of rows as Match[]) {
        if (
          match.status === "finished" &&
          (!data.schools.some((s) => s.id === match.home) ||
            !data.schools.some((s) => s.id === match.away))
        )
          throw Error("รอทราบทีมผู้ชนะจากรอบก่อน จึงจะบันทึกผลคู่นี้ได้");
        if (
          match.format === "knockout" &&
          match.phase !== "group" &&
          match.status === "finished" &&
          match.home_score === match.away_score
        )
          throw Error(
            "รอบคัดออกต้องมีผู้ชนะ กรุณาบันทึกผลตัดสินหลังต่อเวลาหรือดวลจุดโทษ",
          );
        const proposed = {
          home: match.home,
          away: match.away,
          startsAt: match.starts_at,
          venue: match.venue,
        };
        if (
          data.matches.some(
            (other) =>
              other.id !== match.id &&
              fixturesConflict(proposed, {
                home: other.home,
                away: other.away,
                startsAt: other.starts_at,
                venue: other.venue,
              }),
          )
        )
          throw Error(
            "เวลานี้มีโรงเรียนแข่งขันซ้อนหรือสนามถูกใช้งานในรายการอื่นแล้ว",
          );
      }
    }
    {
      if (!snapshot) throw Error("กรุณาโหลดข้อมูล Supabase ใหม่");
      const active = snapshot.rows.competitions.find(
        (c) => c.id === competitionId,
      );
      rows = rows.map((row) => {
        if (
          table === "schools" ||
          ("competition_id" in row && row.competition_id)
        )
          return row;
        let id = competitionId;
        if (table === "athletes" || table === "matches") {
          const scoped = row as Athlete | Match;
          id =
            active &&
            active.sport === scoped.sport &&
            active.age_group === scoped.division &&
            active.gender === scoped.gender
              ? active.id
              : findCompetition(snapshot.rows.competitions, scoped).id;
        }
        return { ...row, competition_id: id };
      }) as State[K];
    }
    if (table === "athletes") {
      const existing = data.athletes.filter(
        (a) => !rows.some((r) => r.id === a.id),
      );
      const seen = new Set(
        existing.map((a) =>
          [
            a.name,
            a.school_id,
            a.competition_id ||
              [
                a.sport,
                a.gender,
                a.division,
                a.roster?.ruleId || "legacy",
              ].join("|"),
          ].join("|"),
        ),
      );
      for (const a of rows as Athlete[]) {
        if (!a.name.trim() || !a.division.trim())
          throw Error("กรอกชื่อและรุ่นให้ครบ");
        const key = [
          a.name,
          a.school_id,
          a.competition_id ||
            [a.sport, a.gender, a.division, a.roster?.ruleId || "legacy"].join(
              "|",
            ),
        ].join("|");
        if (seen.has(key)) throw Error("ข้อมูลนักกีฬาซ้ำ");
        seen.add(key);
      }
    }
    if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
    if (!snapshot) throw Error("กรุณาโหลดข้อมูล Supabase ใหม่");
    if (table === "matches" || table === "races" || table === "athletes") {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw Error("กรุณาเข้าสู่ระบบใหม่");
      for (const row of rows) {
        const isMatch = table === "matches";
        const response = await fetch(
          isMatch
            ? "/api/match-results"
            : table === "athletes"
              ? "/api/athlete-registrations"
              : "/api/athletics-results",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(
              isMatch
                ? { match: row }
                : table === "athletes"
                  ? { athletes: rows }
                  : { race: row },
            ),
          },
        );
        const result = await response.json();
        if (response.ok && result.note) {
          await refresh();
          throw Error(result.note);
        }
        if (!response.ok) {
          try {
            await refresh();
          } catch {}
          throw Error(result.error || "บันทึกผลไม่สำเร็จ");
        }
        if (table === "athletes") break;
      }
    } else await writeHosted(supabase, snapshot, table, rows);
    await refresh();
  }
  const admin = role === "admin",
    refereeRole = role === "recorder" || role === "referee",
    edit = admin || refereeRole,
    register = admin || role === "school" || role === "school_admin";
  const competition = snapshot?.rows.competitions.find(
    (c) => c.id === competitionId,
  );
  const ruleCandidates = compatibleRules(sport, gender, division);
  const activeRuleId = ruleCandidates.some((r) => r.id === registrationRuleId)
    ? registrationRuleId
    : ruleCandidates[0]?.id || "";
  const useRoster = !!activeRuleId && snapshot?.registrationExtension === true;
  const activePolicy =
    competition?.registration_policy?.ruleId === activeRuleId
      ? competition.registration_policy
      : undefined;
  const catalogPolicies: Record<string, RegistrationPolicy> = activePolicy
    ? { [activePolicy.ruleId]: activePolicy }
    : {};
  function chooseRegistrationRule(id: string) {
    const c =
      snapshot?.rows.competitions.find(
        (c) => c.registration_policy?.ruleId === id,
      ) ||
      snapshot?.rows.competitions.find((c) =>
        compatibleRules(c.sport, c.gender, c.age_group).some(
          (rule) => rule.id === id,
        ),
      );
    if (!c) {
      setMessageKind("error");
      setMessage(
        "ยังไม่มีรายการแข่งขันที่ตรงกับกีฬา เพศ และระดับชั้นนี้ กรุณาให้ผู้ดูแลเตรียมรายการก่อน",
      );
      return;
    }
    chooseCompetition(c.id);
    setRegistrationRuleId(id);
  }
  async function configurePolicy(policy: RegistrationPolicy) {
    policyLimits(policy);
    if (!admin) throw Error("เฉพาะผู้ดูแลระบบเท่านั้นที่ตั้งค่าโควตาได้");
    {
      if (!supabase || !competition || snapshot?.registrationExtension !== true)
        throw Error("ต้องติดตั้ง migration สำหรับกติกาการสมัครก่อน");
      await mutateCompetition({
        action: "policy",
        id: competition.id,
        policy,
        revision: managedCompetitions.find((c) => c.id === competition.id)
          ?.managementRevision,
      });
    }
  }
  const points = competition
    ? {
        win: competition.win_points,
        draw: competition.draw_points,
        loss: competition.loss_points,
      }
    : (() => {
        const ids = new Set(
          data.matches
            .filter(
              (m) =>
                m.sport === sport &&
                m.division === division &&
                m.gender === gender,
            )
            .map((m) => m.competition_id),
        );
        const c = managedCompetitions.find((c) => ids.has(c.id));
        return c
          ? { win: c.winPoints, draw: c.drawPoints, loss: c.lossPoints }
          : { win: 3, draw: 1, loss: 0 };
      })();
  const eventCandidates =
    snapshot?.rows.athletics_events.filter(
      (e) =>
        e.competition_id === competitionId &&
        (!refereeRole || e.referee_id === profileId) &&
        e.name === event &&
        e.round === stage &&
        e.heat === heat,
    ) || [];
  const raceEvent = eventId
    ? snapshot?.rows.athletics_events.find(
        (e) => e.id === eventId && (!refereeRole || e.referee_id === profileId),
      )
    : eventCandidates.length === 1
      ? eventCandidates[0]
      : undefined;
  const ambiguousEvent = !eventId && eventCandidates.length > 1;
  const scopeMatch = (row: {
    sport?: string;
    division: string;
    gender: string;
    competition_id?: string;
  }) => row.competition_id === competitionId;
  const selected = data.matches.filter((m) => scopeMatch(m));
  const scheduleMatches = buildScheduleMatches(
    managedCompetitions,
    data.matches,
  ).filter(scopeMatch);
  const assignedMatches = refereeRole
    ? data.matches.filter((match) => match.referee_id === profileId)
    : data.matches;
  const selectedMatches = refereeRole
    ? selected.filter((match) => match.referee_id === profileId)
    : selected;
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const nowPart = (type: string) =>
    nowParts.find((part) => part.type === type)?.value || "";
  const nowKey = `${nowPart("year")}-${nowPart("month")}-${nowPart("day")}T${nowPart("hour")}:${nowPart("minute")}`;
  const todayMatches = assignedMatches.filter(
    (match) => match.starts_at.slice(0, 10) === todayKey,
  );
  const currentMatches = todayMatches.filter((match) => {
    const start = match.starts_at.slice(0, 16);
    return (
      match.status !== "finished" &&
      start <= nowKey &&
      new Date(`${start}:00+07:00`).getTime() >= Date.now() - 2 * 60 * 60 * 1000
    );
  });
  const nextMatches = assignedMatches
    .filter(
      (match) =>
        match.status !== "finished" &&
        match.starts_at &&
        match.starts_at.slice(0, 16) > nowKey,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 5);
  const awaitingMatchResults = assignedMatches.filter(
    (match) => match.status !== "finished",
  );
  const assignedEvents =
    snapshot?.rows.athletics_events.filter((event) =>
      refereeRole ? event.referee_id === profileId : true,
    ) || [];
  const assignedEventIds = new Set(assignedEvents.map((event) => event.id));
  const assignedEventsToday = assignedEvents.filter(
    (event) => event.starts_at?.slice(0, 10) === todayKey,
  );
  const displayedSchools = data.schools;
  const schoolName = (id: string) => {
    const item = data.schools.find((s) => s.id === id);
    return item?.short_name || item?.name || id;
  };
  const schoolRole = role === "school" || role === "school_admin";
  const schoolMatches = data.matches.filter(
    (match) => match.home === school || match.away === school,
  );
  const medalMatches = schoolRole
    ? schoolMatches
    : refereeRole
      ? assignedMatches
      : data.matches;
  const schoolAthletes = data.athletes.filter(
    (athlete) => athlete.school_id === school,
  );
  const pointsByCompetition = Object.fromEntries(
    (snapshot?.rows.competitions || []).map((item) => [
      item.id,
      {
        win: item.win_points,
        draw: item.draw_points,
        loss: item.loss_points,
      },
    ]),
  );
  const calculatedAwards = calculateMedalAwards({
    matches: data.matches,
    races: data.races,
    athletes: data.athletes,
    pointsByCompetition,
  });
  const visibleAwards = schoolRole
    ? calculatedAwards.filter((award) => award.school_id === school)
    : calculatedAwards;
  const schoolCategories = groupSchoolsByMedalCategory(data.schools);
  const medalsForSchools = (schoolIds: string[]) =>
    medals(
      visibleAwards
        .filter((award) => schoolIds.includes(award.school_id))
        .map((award) => ({
          school: award.school_id,
          medal: award.medal,
        })),
    );
  const medalSummary = (rows: ReturnType<typeof medals>) =>
    rows.map((row, index) => [
      index + 1,
      schoolName(row.school),
      row.gold,
      row.silver,
      row.bronze,
      row.gold + row.silver + row.bronze,
    ]);
  const athletes = data.athletes.filter(
    (a) => scopeMatch(a) && (!schoolRole || a.school_id === school),
  );
  const fields = (f: FormData) => ({
    division: String(f.get("division") || division),
    gender: String(f.get("gender") || gender),
    competition_id: competitionId,
  });
  const filter = (
    <div className="filters">
      <label>
        รายการแข่งขัน
        <select
          aria-label="รายการแข่งขัน"
          value={competitionId}
          onChange={(e) => chooseCompetition(e.target.value)}
        >
          {(refereeRole
            ? snapshot?.rows.competitions.filter(
                (c) =>
                  assignedMatches.some(
                    (match) => match.competition_id === c.id,
                  ) ||
                  assignedEvents.some((event) => event.competition_id === c.id),
              )
            : snapshot?.rows.competitions
          )?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.age_group} · {c.gender}
            </option>
          ))}
        </select>
      </label>
      {!snapshot?.rows.competitions.length && (
        <p>ยังไม่มีรายการแข่งขันที่มีสิทธิ์อ่าน</p>
      )}
    </div>
  );
  function selectTab(index: number) {
    if (!availableTabIndices(role).includes(index)) return;
    setTab(index);
    setMenuOpen(false);
    if (index === 4) {
      setSport("กรีฑา");
      {
        const c = snapshot?.rows.competitions.find((c) => c.sport === "กรีฑา");
        if (c) chooseCompetition(c.id);
      }
    }
    requestAnimationFrame(() => {
      document.getElementById("page-title")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        ข้ามไปเนื้อหาหลัก
      </a>
      <aside
        id="main-navigation"
        className={menuOpen ? "menu-open" : ""}
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen ? true : undefined}
        aria-label="เมนูหลัก"
      >
        <button
          className="drawer-close"
          aria-label="ปิดเมนูหลัก"
          onClick={() => {
            setMenuOpen(false);
            menuButton.current?.focus();
          }}
        >
          <X aria-hidden="true" />
        </button>
        <div className="brand">
          <b aria-hidden="true">
            <Trophy />
          </b>
          <div>
            นครโกสัมพีเกมส์<small>NAKHON KOSAMPHI GAMES</small>
          </div>
        </div>
        <div className="season">
          การแข่งขันกีฬาเครือข่าย
          <br />
          <strong>ปีการศึกษา 2569</strong>
        </div>
        <nav aria-label="การจัดการแข่งขัน">
          {tabs.map((t, i) =>
            availableTabIndices(role).includes(i) ? (
              <button
                key={t}
                aria-label={t}
                disabled={!ready || busy}
                className={tab === i ? "active" : ""}
                aria-current={tab === i ? "page" : undefined}
                onClick={() => selectTab(i)}
              >
                <span aria-hidden="true">
                  {(() => {
                    const Icon = icons[i];
                    return <Icon />;
                  })()}
                </span>
                {t}
              </button>
            ) : null,
          )}
        </nav>
        <div className="aside-bottom">
          {data.schools.length} โรงเรียน · {SPORTS.length} ชนิดกีฬา
          <br />
          <small>ร่วมแรง ร่วมใจ สู่ชัยชนะ</small>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="menu-backdrop"
          aria-label="ปิดเมนู"
          onClick={() => {
            setMenuOpen(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <main id="main-content" tabIndex={-1} inert={menuOpen || undefined}>
        <header>
          <span>
            <span className="header-desktop-title">ระบบบริหารการแข่งขัน</span>
            <span className="header-mobile-title">นครโกสัมพีเกมส์</span>{" "}
            <span className="badge">{"Supabase · ข้อมูลจริง"}</span>
          </span>
          <button
            className="profile-trigger"
            type="button"
            aria-label={`โปรไฟล์ ${roleLabels[role] || "ผู้ชม"}`}
            onClick={() => setTab(7)}
          >
            <span className="profile-avatar">
              <Image
                src="/assets/profile/default-avatar.svg"
                alt=""
                width={40}
                height={40}
                unoptimized
              />
            </span>
            <span className="profile-trigger-copy">
              <strong>{roleLabels[role] || "ผู้ชม"}</strong>
              <small>บัญชีที่เข้าสู่ระบบ</small>
            </span>
          </button>
        </header>
        <div className="content">
          <div className="heading">
            <div>
              <p className="eyebrow">NAKHON KOSAMPHI GAMES 2026</p>
              <h1 id="page-title" tabIndex={-1}>
                {tabs[tab]}
              </h1>
              <p className="muted">
                กีฬาแห่งมิตรภาพ สร้างพลังเยาวชน • ปีการศึกษา 2569
              </p>
            </div>
            <span className="role">
              <ShieldCheck aria-hidden="true" />
              {""}
              {roleLabels[role] || "ผู้ชม"}
            </span>
          </div>
          {(!ready || busy) && (
            <div
              role="status"
              className="feedback feedback-loading"
              aria-live="polite"
            >
              <LoaderCircle className="spin" aria-hidden="true" />
              <div>
                <strong>กำลังโหลดข้อมูล</strong>
                <p>
                  {!ready
                    ? "กำลังโหลดข้อมูล Supabase"
                    : "กำลังดำเนินการ กรุณารอสักครู่"}
                </p>
              </div>
            </div>
          )}
          {message && !busy && (
            <div
              role="status"
              aria-live="polite"
              className={`feedback feedback-${messageKind}`}
            >
              {messageKind === "success" ? (
                <CircleCheck aria-hidden="true" />
              ) : (
                <CircleAlert aria-hidden="true" />
              )}
              <div>
                <strong>
                  {messageKind === "success" ? "สำเร็จ" : "เกิดข้อผิดพลาด"}
                </strong>
                <p>{message}</p>
              </div>
              <button aria-label="ปิดข้อความ" onClick={() => setMessage("")}>
                <X aria-hidden="true" />
              </button>
            </div>
          )}
          {loadFailed && (
            <section className="panel" role="alert">
              <p>
                เชื่อมต่อ Supabase ไม่สำเร็จ
                กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง
              </p>
              <button
                disabled={busy}
                onClick={() => run(refresh, false, "โหลดข้อมูลใหม่แล้ว")}
              >
                โหลดข้อมูลใหม่
              </button>
            </section>
          )}
          {tab === 8 && role === "admin" && (
            <AdminCompetitionManager
              schools={displayedSchools}
              competitions={managedCompetitions}
              busy={busy}
              onMutation={async (action) =>
                run(() => mutateCompetition(action), true)
              }
            />
          )}
          {(tab === 9 || tab === 10) && schoolRole && (
            <SchoolPortal
              key={tab}
              page={tab === 9 ? "profile" : "roster"}
              schoolId={school}
              schools={data.schools}
              athletes={data.athletes}
              competitions={snapshot?.rows.competitions || []}
              busy={busy}
              accessToken={accessToken}
              onSaveSchool={async (schoolRecord) => {
                const response = await fetch("/api/schools", {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({
                    schoolId: schoolRecord.id,
                    name: schoolRecord.name,
                    expectedName: data.schools.find(
                      (s) => s.id === schoolRecord.id,
                    )?.name,
                  }),
                });
                const result = await response.json();
                if (!response.ok)
                  throw Error(result.error || "บันทึกชื่อโรงเรียนไม่สำเร็จ");
              }}
              onSaved={refresh}
              onSaveAthletes={async (rows) => save("athletes", rows)}
              onImportAthletes={async (file, selectedCompetitionId) => {
                if (file.size > 2000000) throw Error("ไฟล์ใหญ่เกิน 2 MB");
                const rows = parseAthletes(await file.text(), data.schools);
                if (rows.some((row) => row.school_id !== school))
                  throw Error("นำเข้าได้เฉพาะรายชื่อนักกีฬาในโรงเรียนตนเอง");
                await save(
                  "athletes",
                  rows.map((row) => ({
                    ...row,
                    competition_id: selectedCompetitionId,
                  })),
                );
              }}
              onDownloadAthleteTemplate={(schoolId, selectedCompetition) => {
                const rule = compatibleRules(
                  selectedCompetition.sport,
                  selectedCompetition.gender,
                  selectedCompetition.age_group,
                )[0];
                downloadCsv("athletes-template.csv", [
                  {
                    name: "นักกีฬาตัวอย่าง",
                    school_id: schoolId,
                    sport: selectedCompetition.sport,
                    gender: selectedCompetition.gender,
                    division: selectedCompetition.age_group,
                    competition_id: selectedCompetition.id,
                    rule_id: rule?.id || "",
                    position: "auto",
                  },
                ]);
              }}
              onDownloadSchoolCodes={() =>
                downloadCsv("schools.csv", data.schools)
              }
            />
          )}
          {tab === 0 && (
            <>
              <PerspectiveTunnelHero
                onRegister={
                  role === "viewer" || refereeRole
                    ? undefined
                    : () => selectTab(1)
                }
                onSchedule={() => selectTab(2)}
                disabled={!ready || busy}
              />
              {refereeRole && (
                <section className="panel referee-dashboard">
                  <div className="panel-title">
                    <div>
                      <p className="eyebrow">REFEREE DESK</p>
                      <h2>งานกรรมการวันนี้</h2>
                    </div>
                    <span>{todayKey}</span>
                  </div>
                  <div className="referee-work-stats">
                    <article>
                      <small>กำลังแข่งขัน</small>
                      <strong>{currentMatches.length}</strong>
                    </article>
                    <article>
                      <small>คู่ถัดไป</small>
                      <strong>{nextMatches.length}</strong>
                    </article>
                    <article>
                      <small>คู่รอส่งผล</small>
                      <strong>{awaitingMatchResults.length}</strong>
                    </article>
                    <article>
                      <small>รายการกรีฑาวันนี้</small>
                      <strong>{assignedEventsToday.length}</strong>
                    </article>
                  </div>
                  <div className="referee-work-list">
                    <h3>คู่แข่งขันวันนี้</h3>
                    {todayMatches.length ? (
                      todayMatches.map((match) => (
                        <article key={match.id}>
                          <div>
                            <strong>
                              {schoolName(match.home)} –{" "}
                              {schoolName(match.away)}
                            </strong>
                            <small>
                              {match.starts_at.slice(11, 16) || "ไม่ระบุเวลา"} ·{" "}
                              {match.venue || "ไม่ระบุสนาม"}
                            </small>
                          </div>
                          <span>
                            {match.status === "finished"
                              ? "ส่งผลแล้ว"
                              : currentMatches.some(
                                    (current) => current.id === match.id,
                                  )
                                ? "กำลังแข่งขัน"
                                : "รอส่งผล"}
                          </span>
                          {match.status !== "finished" && (
                            <button onClick={() => selectTab(3)}>
                              บันทึกผล
                            </button>
                          )}
                        </article>
                      ))
                    ) : (
                      <Empty />
                    )}
                    <h3>คู่ถัดไป</h3>
                    {nextMatches.length ? (
                      nextMatches.map((match) => (
                        <article key={match.id}>
                          <div>
                            <strong>
                              {schoolName(match.home)} –{" "}
                              {schoolName(match.away)}
                            </strong>
                            <small>
                              {match.starts_at.replace("T", " ")} ·{" "}
                              {match.venue || "ไม่ระบุสนาม"}
                            </small>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="muted">ไม่มีคู่แข่งขันที่กำลังจะเริ่ม</p>
                    )}
                  </div>
                  <div className="referee-dashboard-actions">
                    <button onClick={() => selectTab(2)}>ดูตารางแข่งขัน</button>
                    <button onClick={() => selectTab(4)}>บันทึกผลกรีฑา</button>
                  </div>
                </section>
              )}
              {!refereeRole && (
                <div className="stats">
                  {[
                    [
                      "โรงเรียนเข้าร่วม",
                      schoolRole ? (school ? 1 : 0) : data.schools.length,
                      "แห่ง",
                    ],
                    [
                      "นักกีฬาลงทะเบียน",
                      schoolRole ? schoolAthletes.length : data.athletes.length,
                      "คน",
                    ],
                    [
                      "โปรแกรมแข่งขัน",
                      schoolRole
                        ? schoolMatches.length
                        : refereeRole
                          ? assignedMatches.length
                          : data.matches.length,
                      "คู่",
                    ],
                    [
                      "แข่งขันเสร็จแล้ว",
                      (schoolRole
                        ? schoolMatches
                        : refereeRole
                          ? assignedMatches
                          : data.matches
                      ).filter((m) => m.status === "finished").length,
                      "คู่",
                    ],
                  ].map(([l, n, u], i) => (
                    <article key={l}>
                      <p>
                        {l}
                        {(() => {
                          const Icon = [
                            School,
                            Users,
                            CalendarDays,
                            CircleCheck,
                          ][i];
                          return <Icon aria-hidden="true" />;
                        })()}
                      </p>
                      <strong>{n}</strong>
                      <small>{u}</small>
                    </article>
                  ))}
                </div>
              )}
              {!refereeRole && (
                <section className="panel">
                  <h2>
                    ชนิดกีฬาที่เปิดแข่งขัน <small>8 ชนิดกีฬา</small>
                  </h2>
                  <div className="sports">
                    {SPORTS.map((s, i) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSport(s);
                          {
                            const c = snapshot?.rows.competitions.find(
                              (c) => c.sport === s,
                            );
                            if (c) chooseCompetition(c.id);
                          }
                          selectTab(
                            role === "viewer" ? 2 : s === "กรีฑา" ? 4 : 2,
                          );
                        }}
                      >
                        <span aria-hidden="true">
                          {(() => {
                            const Icon = sportIcons[i];
                            return <Icon />;
                          })()}
                        </span>
                        <b>{s}</b>
                        <small>
                          ดูรายการแข่งขัน <ArrowRight aria-hidden="true" />
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {!refereeRole && (
                <section className="panel overview-results">
                  <div className="panel-title">
                    <div>
                      <p className="eyebrow">THE MOMENTS THAT MATTER</p>
                      <h2>คะแนนและเกียรติยศ</h2>
                    </div>
                    <button onClick={() => selectTab(6)}>
                      เหรียญรางวัล <ChevronRight aria-hidden="true" />
                    </button>
                  </div>
                  <div className="overview-result-grid">
                    <div>
                      <h3>
                        <Medal aria-hidden="true" />
                        ทำเนียบเหรียญรางวัล
                      </h3>
                      <Table
                        heads={[
                          "อันดับ",
                          "โรงเรียน",
                          "ทอง",
                          "เงิน",
                          "ทองแดง",
                          "รวม",
                        ]}
                        rows={medalsForSchools(
                          schoolRole
                            ? school
                              ? [school]
                              : []
                            : data.schools.map((s) => s.id),
                        )
                          .slice(0, 5)
                          .map((r, i) => [
                            i + 1,
                            schoolName(r.school),
                            r.gold,
                            r.silver,
                            r.bronze,
                            r.gold + r.silver + r.bronze,
                          ])}
                      />
                    </div>
                    <div>
                      <h3>
                        <Trophy aria-hidden="true" />
                        ผลการแข่งขันที่จบแล้ว
                      </h3>
                      {(schoolRole
                        ? schoolMatches
                        : refereeRole
                          ? assignedMatches
                          : data.matches
                      )
                        .filter((m) => m.status === "finished")
                        .slice(-3)
                        .reverse()
                        .map((m) => (
                          <div className="result-card" key={m.id}>
                            <p>
                              {m.sport} · {m.division} · {m.gender}
                            </p>
                            <div>
                              <span>{schoolName(m.home)}</span>
                              <strong>
                                {m.home_score} : {m.away_score}
                              </strong>
                              <span>{schoolName(m.away)}</span>
                            </div>
                            <small>จบการแข่งขัน</small>
                          </div>
                        ))}
                      {!(
                        schoolRole
                          ? schoolMatches
                          : refereeRole
                            ? assignedMatches
                            : data.matches
                      ).some((m) => m.status === "finished") && <Empty />}
                    </div>
                  </div>
                </section>
              )}
              <div className="notice">
                <Info aria-hidden="true" />
                {"เชื่อมต่อฐานข้อมูลจริง สิทธิ์บังคับใช้ด้วย Supabase RLS"}{" "}
                {" · ชื่อโรงเรียนจากฐานข้อมูลจริง"}
              </div>
            </>
          )}
          {tab === 1 && (
            <>
              <RegistrationRulesTable policies={catalogPolicies} />
              <section className="panel registration-chooser">
                <label>
                  ประเภทการแข่งขัน
                  <select
                    aria-label="ประเภทการแข่งขัน"
                    value={activeRuleId}
                    disabled={busy}
                    onChange={(e) => chooseRegistrationRule(e.target.value)}
                  >
                    <option value="" disabled>
                      รายการเดิม / เลือกประเภทการแข่งขัน
                    </option>
                    {RULES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
              {filter}
              {snapshot?.registrationExtension !== true && (
                <p className="notice">
                  ฐานข้อมูลยังไม่ได้ติดตั้งส่วนกติกาการสมัคร
                  แสดงข้อมูลและแบบฟอร์มเดิมอยู่ กรุณาให้ผู้ดูแลติดตั้ง migration
                  เพื่อเปิดแบบฟอร์มแยกตัวจริง/สำรองและตรวจโควตาที่ฐานข้อมูล
                </p>
              )}
              {useRoster ? (
                <RosterRegistrationPanel
                  key={`${competitionId}-${activeRuleId}-${school}`}
                  ruleId={activeRuleId}
                  policy={activePolicy || defaultPolicy(activeRuleId)}
                  sport={sport}
                  gender={gender}
                  division={division}
                  competitionId={competitionId}
                  athletes={athletes.filter(
                    (a) => !a.roster || a.roster.ruleId === activeRuleId,
                  )}
                  schools={displayedSchools}
                  school={school}
                  admin={admin}
                  canRegister={register}
                  busy={busy}
                  enabled={
                    competition?.registration_policy?.ruleId === activeRuleId
                  }
                  onRuleChange={chooseRegistrationRule}
                  onSubmit={(rows) => run(() => save("athletes", rows), true)}
                  onConfigure={(policy) =>
                    run(() => configurePolicy(policy), true)
                  }
                  onTemplate={(templateSchool) =>
                    downloadCsv("athletes-template.csv", [
                      {
                        name: "นักกีฬาตัวอย่าง",
                        school_id: templateSchool || data.schools[0]?.id || "",
                        sport,
                        gender,
                        division,
                        rule_id: activeRuleId,
                        position:
                          activeRuleId === "athletics-individual"
                            ? "individual"
                            : "starter",
                        events:
                          activeRuleId === "athletics-individual"
                            ? Object.keys(activePolicy?.eventQuotas || {})[0] ||
                              "run100"
                            : activeRuleId === "athletics-relay"
                              ? "relay"
                              : "",
                      },
                    ])
                  }
                  onSchoolCodes={() => downloadCsv("schools.csv", data.schools)}
                  onImport={(file) =>
                    run(async () => {
                      if (file.size > 2000000) throw Error("ไฟล์ใหญ่เกิน 2 MB");
                      const rows = parseAthletes(
                        await file.text(),
                        data.schools,
                      );
                      if (!admin && rows.some((r) => r.school_id !== school))
                        throw Error("นำเข้าได้เฉพาะโรงเรียนตนเอง");
                      await save("athletes", rows);
                    })
                  }
                />
              ) : (
                <section className="panel">
                  <h2>ลงทะเบียนนักกีฬา</h2>
                  {register &&
                  true &&
                  snapshot?.registrationExtension !== true ? (
                    <>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const f = new FormData(form);
                          run(async () => {
                            await save("athletes", [
                              {
                                id: crypto.randomUUID(),
                                name: String(f.get("name")).trim(),
                                school_id: String(f.get("school_id")),
                                sport,
                                bib:
                                  String(f.get("bib") || "").trim() ||
                                  undefined,
                                ...fields(f),
                              },
                            ]);
                            form.reset();
                          });
                        }}
                      >
                        <label>
                          ชื่อ–นามสกุล
                          <input name="name" required maxLength={120} />
                        </label>
                        <label>
                          เลขประจำตัว (bib)
                          <input
                            name="bib"
                            maxLength={100}
                            placeholder="เว้นว่างเพื่อใช้รหัสอัตโนมัติ"
                          />
                        </label>
                        <label>
                          โรงเรียน
                          {admin ? (
                            <select
                              name="school_id"
                              value={school}
                              onChange={(e) => setSchool(e.target.value)}
                            >
                              {data.schools
                                .filter((s) => admin || s.id === school)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <>
                              <span>{schoolName(school)}</span>
                              <input
                                type="hidden"
                                name="school_id"
                                value={school}
                              />
                            </>
                          )}
                        </label>
                        <button className="primary" disabled={busy}>
                          + เพิ่มนักกีฬา
                        </button>
                      </form>
                      <div className="import">
                        <label>
                          นำเข้า CSV
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file)
                                run(async () => {
                                  if (file.size > 2000000)
                                    throw Error("ไฟล์ใหญ่เกิน 2 MB");
                                  const rows = parseAthletes(
                                    await file.text(),
                                    data.schools,
                                  );
                                  if (
                                    !admin &&
                                    rows.some((r) => r.school_id !== school)
                                  )
                                    throw Error("นำเข้าได้เฉพาะโรงเรียนตนเอง");
                                  await save("athletes", rows);
                                });
                              e.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            downloadCsv("athletes-template.csv", [
                              {
                                name: "นักกีฬาตัวอย่าง",
                                school_id: school || data.schools[0]?.id || "",
                                sport,
                                gender,
                                division,
                                bib: "101",
                              },
                            ])
                          }
                        >
                          ดาวน์โหลดแบบฟอร์ม CSV
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadCsv("schools.csv", data.schools)
                          }
                        >
                          ดาวน์โหลดรหัสโรงเรียน
                        </button>
                      </div>
                    </>
                  ) : (
                    <p>
                      {register
                        ? "รายการเดิมนี้ยังไม่ได้ผูกกติกา เปิดดูข้อมูลเก่าได้ กรุณาเลือกประเภทการแข่งขันที่เปิดรับสมัคร"
                        : "บัญชีนี้ไม่มีสิทธิ์ลงทะเบียน"}
                    </p>
                  )}
                  <Table
                    heads={[
                      "ชื่อ–นามสกุล",
                      "โรงเรียน",
                      "กีฬา",
                      "รุ่น / เพศ",
                      "bib",
                    ]}
                    rows={athletes.map((a) => [
                      a.name,
                      schoolName(a.school_id),
                      a.sport,
                      `${a.division} / ${a.gender}`,
                      a.bib || "—",
                    ])}
                  />
                </section>
              )}
            </>
          )}
          {tab === 2 && (
            <>
              {filter}
              <section className="panel">
                <h2>
                  {schoolRole ? "ตารางแข่งขันของโรงเรียน" : "ตารางแข่งขัน"}
                </h2>
                <SpiderSchedule
                  matches={
                    schoolRole
                      ? scheduleMatches.filter(
                          (match) =>
                            match.home === school || match.away === school,
                        )
                      : refereeRole
                        ? selectedMatches
                        : scheduleMatches
                  }
                  schoolName={(id) =>
                    data.schools.find((item) => item.id === id)?.name || id
                  }
                  canEdit={admin}
                  busy={busy}
                  canAssign={admin}
                  onSave={(match, startsAt, venue, refereeId) =>
                    run(async () => {
                      if (
                        refereeId &&
                        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                          refereeId,
                        )
                      )
                        throw Error(
                          "รหัสผู้ใช้กรรมการต้องเป็น UUID ที่ถูกต้อง",
                        );
                      const managed = managedCompetitions.find(
                        (c) => c.id === match.competition_id,
                      );
                      if (
                        managed?.fixtures.some((f) => f.id === match.id) &&
                        readManagement(
                          snapshot?.rows.competitions.find(
                            (c) => c.id === match.competition_id,
                          )?.registration_policy,
                        )
                      ) {
                        await mutateCompetition({
                          action: "schedule",
                          id: match.competition_id,
                          fixtureId: match.id,
                          startsAt,
                          venue,
                          refereeId: refereeId || null,
                          revision: managed.managementRevision,
                        });
                        return;
                      }
                      await save("matches", [
                        {
                          ...match,
                          starts_at: startsAt,
                          venue,
                          referee_id: refereeId || undefined,
                        },
                      ]);
                    })
                  }
                />
              </section>
            </>
          )}
          {tab === 3 && (
            <>
              {filter}
              <section className="panel">
                <h2>บันทึกผลการแข่งขัน</h2>
                <p className="muted">
                  ผลคัดออกที่ยืนยันแล้วแก้คะแนนได้เฉพาะกรณีผู้ชนะเดิมไม่เปลี่ยน
                  · คะแนนลีก: ชนะ {points.win} · เสมอ {points.draw} · แพ้{" "}
                  {points.loss} | เหรียญคำนวณจากผลที่ยืนยันแล้ว
                </p>
                {refereeRole && (
                  <p className="muted">
                    แสดงเฉพาะคู่ที่มอบหมายให้บัญชีกรรมการนี้
                  </p>
                )}
                {selectedMatches.length === 0 && <Empty />}
                {selectedMatches.map((m) => (
                  <form
                    className="match-form"
                    key={m.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const homeScore = Number(f.get("home"));
                      const awayScore = Number(f.get("away"));
                      if (
                        !window.confirm(
                          `ตรวจสอบผลก่อนยืนยัน:\n${schoolName(m.home)} ${homeScore} – ${awayScore} ${schoolName(m.away)}\n${m.starts_at || "ไม่ระบุเวลา"} · ${m.venue || "ไม่ระบุสนาม"}`,
                        )
                      )
                        return;
                      run(() =>
                        save("matches", [
                          {
                            ...m,
                            home_score: homeScore,
                            away_score: awayScore,
                            status: "finished",
                          },
                        ]),
                      );
                    }}
                  >
                    <b>
                      สาย {m.pool} · {schoolName(m.home)} — {schoolName(m.away)}
                    </b>
                    <small className="muted">
                      {m.starts_at || "ไม่ระบุเวลา"} ·{" "}
                      {m.venue || "ไม่ระบุสนาม"}
                    </small>
                    <label>
                      เจ้าบ้าน
                      <input
                        type="number"
                        name="home"
                        min="0"
                        step="1"
                        required
                        defaultValue={m.home_score}
                        disabled={!edit}
                      />
                    </label>
                    <label>
                      ทีมเยือน
                      <input
                        type="number"
                        name="away"
                        min="0"
                        step="1"
                        required
                        defaultValue={m.away_score}
                        disabled={!edit}
                      />
                    </label>
                    <span className="badge">
                      {m.status === "finished"
                        ? `ยืนยันผลแล้ว · ${m.home_score} – ${m.away_score}`
                        : "รอส่งผล"}
                    </span>
                    {edit && (
                      <button className="primary" disabled={busy}>
                        ยืนยันผล
                      </button>
                    )}
                  </form>
                ))}
              </section>
            </>
          )}
          {tab === 4 && (
            <>
              {filter}
              <section className="panel">
                <h2>กรีฑา · ฮีตและรอบชิง</h2>
                {
                  <label>
                    รายการกรีฑาที่มีอยู่
                    <select
                      aria-label="รายการกรีฑาที่มีอยู่"
                      value={eventId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setEventId(id);
                        const selected = snapshot?.rows.athletics_events.find(
                          (x) => x.id === id,
                        );
                        if (selected) {
                          setEvent(selected.name);
                          setStage(selected.round);
                          setHeat(selected.heat);
                          setEventKind(selected.kind);
                          setEventDirection(selected.direction);
                          setEventUnit(selected.unit);
                          setEventRefereeId(selected.referee_id || "");
                        } else {
                          setEventRefereeId("");
                        }
                      }}
                    >
                      {!refereeRole && (
                        <option value="">สร้าง/ค้นหารายการตามชื่อและรอบ</option>
                      )}
                      {snapshot?.rows.athletics_events
                        .filter(
                          (e) =>
                            e.competition_id === competitionId &&
                            (!refereeRole || e.referee_id === profileId),
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} · {e.round} · ฮีต {e.heat}
                          </option>
                        ))}
                    </select>
                  </label>
                }
                {admin && raceEvent && true && (
                  <form
                    className="referee-assignment-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(async () => {
                        const nextId = eventRefereeId.trim() || null;
                        if (
                          nextId &&
                          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                            nextId,
                          )
                        )
                          throw Error(
                            "รหัสผู้ใช้กรรมการต้องเป็น UUID ที่ถูกต้อง",
                          );
                        if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
                        const response = await fetch("/api/athletics-results", {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                          },
                          body: JSON.stringify({
                            eventId: raceEvent.id,
                            refereeId: nextId,
                          }),
                        });
                        const result = await response.json();
                        if (!response.ok)
                          throw Error(
                            result.error || "มอบหมายกรรมการไม่สำเร็จ",
                          );
                        await refresh();
                      });
                    }}
                  >
                    <label>
                      มอบหมายกรรมการ (UUID)
                      <input
                        value={eventRefereeId}
                        onChange={(e) => setEventRefereeId(e.target.value)}
                        maxLength={36}
                        placeholder="เว้นว่างเพื่อถอนการมอบหมาย"
                      />
                    </label>
                    <button disabled={busy}>บันทึกผู้รับผิดชอบ</button>
                  </form>
                )}
                {refereeRole && !raceEvent && (
                  <p className="muted">
                    เลือกรายการกรีฑาที่มอบหมายให้บัญชีนี้ก่อนบันทึกผล
                  </p>
                )}
                <div className="filters">
                  <label>
                    รายการ
                    <input
                      value={event}
                      disabled={refereeRole}
                      onChange={(e) => {
                        setEvent(e.target.value);
                        setEventId("");
                      }}
                    />
                  </label>
                  <label>
                    รอบ
                    <select
                      value={stage}
                      disabled={refereeRole}
                      onChange={(e) => {
                        setStage(e.target.value);
                        setEventId("");
                      }}
                    >
                      <option value="heat">ฮีต</option>
                      <option value="final">รอบชิง</option>
                    </select>
                  </label>
                  <label>
                    ฮีต
                    <input
                      type="number"
                      min="1"
                      value={heat}
                      disabled={refereeRole}
                      onChange={(e) => (
                        setHeat(Math.max(1, Number(e.target.value))),
                        setEventId("")
                      )}
                    />
                  </label>
                </div>
                {edit && (
                  <div className="filters">
                    <label>
                      วันเวลารายการใหม่ / รอบชิง
                      <input
                        type="datetime-local"
                        value={newEventStartsAt}
                        onChange={(e) => setNewEventStartsAt(e.target.value)}
                      />
                    </label>
                    <label>
                      สนามรายการใหม่ / รอบชิง
                      <input
                        value={newEventVenue}
                        onChange={(e) => setNewEventVenue(e.target.value)}
                        maxLength={200}
                      />
                    </label>
                  </div>
                )}
                <p className="muted">
                  บันทึกตามหน่วยของรายการ · ผู้ได้ผลเท่ากันได้อันดับร่วม
                </p>
                {ambiguousEvent && (
                  <p role="alert">
                    มีรายการกรีฑาชื่อและรอบซ้ำ กรุณาเลือกรายการกรีฑาที่มีอยู่
                  </p>
                )}
                {!raceEvent && !refereeRole && (
                  <div className="filters">
                    <label>
                      ประเภท
                      <select
                        aria-label="ประเภทกรีฑา"
                        value={eventKind}
                        onChange={(e) => setEventKind(e.target.value)}
                      >
                        <option value="track">ลู่</option>
                        <option value="field">ลาน</option>
                      </select>
                    </label>
                    <label>
                      ทิศทางอันดับ
                      <select
                        aria-label="ทิศทางอันดับ"
                        value={eventDirection}
                        onChange={(e) => setEventDirection(e.target.value)}
                      >
                        <option value="asc">น้อยชนะ</option>
                        <option value="desc">มากชนะ</option>
                      </select>
                    </label>
                    <label>
                      หน่วย
                      <input
                        aria-label="หน่วย"
                        value={eventUnit}
                        onChange={(e) => setEventUnit(e.target.value)}
                      />
                    </label>
                    {admin && (
                      <label>
                        มอบหมายกรรมการ (UUID)
                        <input
                          value={eventRefereeId}
                          onChange={(e) => setEventRefereeId(e.target.value)}
                          maxLength={36}
                          placeholder="เว้นว่างหากยังไม่มอบหมาย"
                        />
                      </label>
                    )}
                  </div>
                )}
                {edit && (!refereeRole || !!raceEvent) && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      run(async () => {
                        const aid = String(f.get("athlete"));
                        const existing = data.races.find(
                          (r) =>
                            r.event === event &&
                            r.division === division &&
                            r.gender === gender &&
                            r.stage === stage &&
                            r.athlete_id === aid &&
                            r.competition_id === competitionId &&
                            (!eventId || r.event_id === eventId),
                        );
                        const status = String(f.get("status"));
                        const value = f.get("value")
                          ? Number(f.get("value"))
                          : null;
                        if (status === "OK" && (value === null || value <= 0))
                          throw Error("กรอกเวลาที่มากกว่า 0");
                        if (
                          admin &&
                          eventRefereeId &&
                          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                            eventRefereeId,
                          )
                        )
                          throw Error(
                            "รหัสผู้ใช้กรรมการต้องเป็น UUID ที่ถูกต้อง",
                          );
                        if (
                          refereeRole &&
                          (!raceEvent ||
                            !window.confirm(
                              `ตรวจสอบผลก่อนบันทึก:\n${event} · ${stage} ฮีต ${heat}\n${data.athletes.find((athlete) => athlete.id === aid)?.name || "นักกีฬา"} · ${status === "OK" ? value : status}`,
                            ))
                        )
                          return;
                        await save("races", [
                          {
                            id: existing?.id || crypto.randomUUID(),
                            event,
                            division,
                            gender,
                            stage,
                            heat,
                            athlete_id: aid,
                            event_id: raceEvent?.id,
                            starts_at: newEventStartsAt,
                            venue: newEventVenue,
                            kind: raceEvent?.kind || eventKind,
                            direction: raceEvent?.direction || eventDirection,
                            unit: raceEvent?.unit || eventUnit,
                            value,
                            status,
                            referee_id: refereeRole
                              ? profileId
                              : eventRefereeId || undefined,
                          },
                        ]);
                      });
                    }}
                  >
                    <label>
                      นักกีฬา
                      <select name="athlete" required>
                        {data.athletes
                          .filter((a) => a.sport === "กรีฑา" && scopeMatch(a))
                          .map((a) => (
                            <option value={a.id} key={a.id}>
                              {a.name} · {schoolName(a.school_id)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      {`ผล (${raceEvent?.unit || eventUnit})`}
                      <input
                        name="value"
                        type="number"
                        min="0.001"
                        step="0.001"
                      />
                    </label>
                    <label>
                      สถานะ
                      <select name="status">
                        {["OK", "DNS", "DNF", "DQ"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <button className="primary" disabled={busy}>
                      บันทึกเวลา
                    </button>
                  </form>
                )}
                <Table
                  heads={[
                    "อันดับ",
                    "นักกีฬา / โรงเรียน / bib",
                    "ผล",
                    "สถานะ",
                    "เข้ารอบ",
                  ]}
                  rows={rankRace(
                    data.races.filter(
                      (r) =>
                        r.event === event &&
                        r.division === division &&
                        r.gender === gender &&
                        r.stage === stage &&
                        r.heat === heat &&
                        r.competition_id === competitionId &&
                        (!refereeRole ||
                          (r.event_id && assignedEventIds.has(r.event_id))) &&
                        !ambiguousEvent &&
                        (!raceEvent || r.event_id === raceEvent.id),
                    ),
                    (raceEvent?.direction || eventDirection) === "desc",
                  ).map((r) => [
                    r.rank ?? "—",
                    data.athletes.find((a) => a.id === r.athlete_id)?.name ||
                      `${schoolName(r.school_id || "")} · bib ${r.bib || "—"}`,
                    r.value ?? "—",
                    r.status,
                    edit &&
                    stage === "heat" &&
                    r.rank !== null &&
                    !!r.athlete_id ? (
                      <button
                        key={r.id}
                        onClick={() =>
                          run(async () => {
                            if (
                              refereeRole &&
                              !window.confirm(
                                `ยืนยันส่ง ${data.athletes.find((athlete) => athlete.id === r.athlete_id)?.name || "นักกีฬา"} เข้ารอบชิงรายการ ${r.event}?`,
                              )
                            )
                              return;
                            if (
                              data.races.some(
                                (x) =>
                                  x.event === event &&
                                  x.stage === "final" &&
                                  x.athlete_id === r.athlete_id &&
                                  x.division === division &&
                                  x.gender === gender &&
                                  x.competition_id === competitionId,
                              )
                            )
                              throw Error("เข้ารอบชิงแล้ว");
                            await save("races", [
                              {
                                event: r.event,
                                competition_id: r.competition_id,
                                direction: r.direction,
                                unit: r.unit,
                                kind: r.kind,
                                division: r.division,
                                gender: r.gender,
                                athlete_id: r.athlete_id,
                                id: crypto.randomUUID(),
                                source_event_id: r.event_id,
                                starts_at: newEventStartsAt,
                                venue: newEventVenue,
                                stage: "final",
                                heat: 1,
                                value: null,
                                status: "DNS",
                                referee_id: refereeRole
                                  ? profileId
                                  : raceEvent?.referee_id || undefined,
                              },
                            ]);
                          })
                        }
                      >
                        ส่งเข้ารอบชิง
                      </button>
                    ) : (
                      "—"
                    ),
                  ])}
                />
              </section>
            </>
          )}
          {tab === 5 && (
            <>
              {filter}
              <section className="panel">
                <h2>ตารางคะแนนแยกสาย</h2>
                {[...new Set(selected.map((m) => m.pool))].map((pool) => (
                  <div key={pool}>
                    <h3>สาย {pool}</h3>
                    <Table
                      heads={[
                        "อันดับ",
                        "โรงเรียน",
                        "แข่ง",
                        "ชนะ",
                        "เสมอ",
                        "แพ้",
                        "ได้",
                        "เสีย",
                        "คะแนน",
                      ]}
                      rows={standings(
                        selected
                          .filter((m) => m.pool === pool)
                          .map((m) => ({
                            ...m,
                            homeScore: m.home_score,
                            awayScore: m.away_score,
                          })),
                        points,
                      ).map((r, i) => [
                        i + 1,
                        schoolName(r.school),
                        r.played,
                        r.won,
                        r.drawn,
                        r.lost,
                        r.gf,
                        r.ga,
                        r.points,
                      ])}
                    />
                  </div>
                ))}
                {!selected.length && <Empty />}
              </section>
            </>
          )}
          {tab === 6 && (
            <>
              {filter}
              <section className="panel">
                <h2>เหรียญรางวัลจากผลการแข่งขัน</h2>
                <p className="muted">
                  คำนวณอัตโนมัติจากผลที่กรรมการยืนยันแล้ว: อันดับ 1 เหรียญทอง ·
                  อันดับ 2 เหรียญเงิน · อันดับ 3 เหรียญทองแดง
                  ไม่มีการเพิ่มหรือบันทึกเหรียญด้วยตนเอง
                </p>
                <p className="notice">
                  {medalMatches.length === 0
                    ? "ยังไม่มีตารางแข่งขันให้คำนวณเหรียญ"
                    : medalMatches.some(
                          (match) =>
                            match.status !== "finished" ||
                            match.home_score === undefined ||
                            match.away_score === undefined,
                        )
                      ? `${
                          medalMatches.filter(
                            (match) =>
                              match.status !== "finished" ||
                              match.home_score === undefined ||
                              match.away_score === undefined,
                          ).length
                        } คู่ยังรอกรรมการบันทึกผล`
                      : "ผลการแข่งขันที่ยืนยันแล้วถูกนำมาคำนวณเหรียญอัตโนมัติ"}
                  {medalMatches.some((match) =>
                    /รอบคัดเลือก|คัดเลือก|รอบรองชนะเลิศ|รอบรอง|semi/i.test(
                      match.pool,
                    ),
                  ) &&
                    !medalMatches.some((match) =>
                      /รอบชิง|ชิงชนะเลิศ|final/i.test(match.pool),
                    ) &&
                    " · รอบคัดเลือกและรอบรองชนะเลิศยังไม่คิดเป็นเหรียญ รอผลรอบชิง"}
                  {medalMatches.some((match) =>
                    /รอบชิง|ชิงชนะเลิศ|final/i.test(match.pool),
                  ) &&
                    !medalMatches.some((match) =>
                      /ชิงอันดับ\s*3|ชิงที่\s*3|อันดับ\s*3|third/i.test(
                        match.pool,
                      ),
                    ) &&
                    " · เหรียญทองแดงรอผลการแข่งขันชิงอันดับ 3"}
                  {hasMultiplePoolsAwaitingFinal(medalMatches) &&
                    " · มีหลายสาย รอผลรอบชิงเพื่อสรุปเหรียญรวม"}
                </p>
                <h3>
                  {schoolRole
                    ? "เหรียญรางวัลของโรงเรียน"
                    : "ผลรวมเหรียญทุกโรงเรียน"}
                </h3>
                <Table
                  heads={[
                    "อันดับ",
                    "โรงเรียน",
                    "🥇 ทอง",
                    "🥈 เงิน",
                    "🥉 ทองแดง",
                    "รวม",
                  ]}
                  rows={medalSummary(
                    medalsForSchools(
                      schoolRole
                        ? school
                          ? [school]
                          : []
                        : data.schools.map((school) => school.id),
                    ),
                  )}
                />
                {!schoolRole && (
                  <div className="medal-category-grid">
                    {[
                      {
                        title: "โรงเรียนขนาดเล็ก",
                        schools: schoolCategories.small,
                      },
                      {
                        title: "โรงเรียนขยายโอกาส",
                        schools: schoolCategories.extended,
                      },
                    ].map((category) => {
                      const rows = medalsForSchools(
                        category.schools.map((school) => school.id),
                      );
                      return (
                        <section
                          className="medal-category"
                          key={category.title}
                        >
                          <h3>{category.title}</h3>
                          {rows.length ? (
                            <Table
                              heads={[
                                "อันดับ",
                                "โรงเรียน",
                                "ทอง",
                                "เงิน",
                                "ทองแดง",
                                "รวม",
                              ]}
                              rows={medalSummary(rows)}
                            />
                          ) : (
                            <p className="muted">
                              ยังไม่มีผลเหรียญในกลุ่มนี้
                              โรงเรียนเดิมที่ไม่มีประเภทจะแสดงในผลรวมทุกโรงเรียนเท่านั้น
                            </p>
                          )}
                        </section>
                      );
                    })}
                  </div>
                )}
                {!schoolRole && (
                  <p className="muted">
                    โรงเรียนเดิมที่ยังไม่มีประเภทจะแสดงเฉพาะผลรวม
                    ส่วนการแยกกลุ่มจะทำได้เมื่อประเภทโรงเรียนถูกบันทึกในข้อมูลจริง
                    (ต้องบันทึกประเภทโรงเรียนในข้อมูลจริงก่อนจึงจะแยกกลุ่มได้)
                  </p>
                )}
                <h3>รายการผลที่คำนวณเป็นเหรียญ</h3>
                {visibleAwards.length ? (
                  <Table
                    heads={["รายการ", "รุ่น / เพศ", "โรงเรียน", "เหรียญ"]}
                    rows={visibleAwards.map((award) => [
                      award.event,
                      `${award.division} / ${award.gender}`,
                      schoolName(award.school_id),
                      award.medal === "gold"
                        ? "ทอง"
                        : award.medal === "silver"
                          ? "เงิน"
                          : "ทองแดง",
                    ])}
                  />
                ) : (
                  <Empty />
                )}
              </section>
              {data.awards.filter(
                (award) => !schoolRole || award.school_id === school,
              ).length > 0 && (
                <details className="panel legacy-awards">
                  <summary>รายการเหรียญที่บันทึกไว้เดิม</summary>
                  <p className="muted">
                    เก็บข้อมูลเดิมไว้โดยไม่ลบ แต่ไม่นำมาคำนวณยอดเหรียญใหม่
                  </p>
                  <Table
                    heads={["รายการ", "รุ่น / เพศ", "โรงเรียน", "เหรียญ"]}
                    rows={data.awards
                      .filter(
                        (award) => !schoolRole || award.school_id === school,
                      )
                      .map((award) => [
                        award.event,
                        `${award.division} / ${award.gender}`,
                        schoolName(award.school_id),
                        award.medal,
                      ])}
                  />
                </details>
              )}
            </>
          )}
          {tab === 7 && (
            <>
              <section className="panel">
                <h2>บัญชีและการเชื่อมต่อ</h2>
                <p className="muted">
                  ผู้ดูแลระบบใช้อีเมล โรงเรียนและกรรมการใช้ชื่อบัญชีและรหัสผ่าน
                  บัญชีใหม่ต้องรอผู้ดูแลระบบอนุมัติ
                </p>
                <p>
                  <a href="/school-registration">
                    สมัครบัญชีโรงเรียน / กรรมการ
                  </a>
                </p>
                {accountState && accountState.status !== "approved" && (
                  <p role="status" className="registration-message">
                    {accountState.status === "rejected"
                      ? `คำขอไม่ได้รับอนุมัติ${accountState.note ? `: ${accountState.note}` : " กรุณาติดต่อผู้ดูแลระบบ"}`
                      : accountState.status === "pending"
                        ? "รอผู้ดูแลระบบอนุมัติ ขณะนี้ยังไม่มีสิทธิ์โรงเรียนหรือกรรมการ"
                        : "บัญชียังไม่มีคำขอสมัคร กรุณาติดต่อผู้ดูแลระบบ"}
                  </p>
                )}
                {role === "viewer" && (
                  <AccountLogin
                    busy={busy}
                    onSession={() => run(refresh, true)}
                  />
                )}
                {
                  <>
                    <button disabled={busy} onClick={() => run(refresh)}>
                      โหลดข้อมูลใหม่
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const { error } = await supabase!.auth.signOut();
                          if (error) throw Error(error.message);
                          setRole("viewer");
                          setProfileId("");
                          setTab(0);
                          setSchool("");
                          setData((d) => ({ ...d, athletes: [] }));
                          await refresh();
                        })
                      }
                    >
                      ออกจากระบบ
                    </button>
                  </>
                }
              </section>
              {admin && (
                <>
                  <AccountApprovals onReviewed={() => run(refresh, true)} />
                  <AdminAccountManager
                    schools={data.schools}
                    onChanged={refresh}
                  />
                  <AdminSchoolManager
                    schools={data.schools}
                    onChanged={refresh}
                  />
                  <AdminMaintenance onChanged={refresh} />
                </>
              )}
              <section className="panel">
                <h2>โรงเรียนในระบบ</h2>
                {data.schools.length ? (
                  <ul className="registered-school-list">
                    {data.schools.map((item) => (
                      <li key={item.id}>
                        <School aria-hidden="true" />
                        <span>{item.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-schools">
                    <School aria-hidden="true" />
                    <strong>ยังไม่มีโรงเรียนในระบบ</strong>
                    <p>โรงเรียนที่ยื่นลงทะเบียนและผ่านการตรวจสอบจะแสดงที่นี่</p>
                    <a href="/school-registration">ลงทะเบียนโรงเรียน</a>
                  </div>
                )}
              </section>
            </>
          )}
          <footer>
            <span className="footer-credit">
              ระบบจัดการและรายงานผลการแข่งขันกีฬา
              <span>
                พัฒนาโดย นายสุจริต แจ่มจำรัส · แจ้งข้อบกพร่อง{" "}
                <a href="tel:0854012644">085-401-2644</a>
                {" · "}
                <a
                  href="https://line.me/R/ti/p/~chayprojubjub"
                  target="_blank"
                  rel="noreferrer"
                >
                  LINE: chayprojubjub
                </a>
              </span>
            </span>
            <span className="footer-tagline">SPORT · UNITY · FAIR PLAY</span>
          </footer>
        </div>
      </main>
      <nav
        className={`mobile-nav${menuOpen ? " drawer-open" : ""}`}
        aria-label="เมนูมือถือ"
      >
        {(role === "viewer"
          ? [0, 2, 5, 6]
          : role === "admin"
            ? [0, 8, 2, 6]
            : schoolRole
              ? [0, 9, 10, 2, 6]
              : refereeRole
                ? [0, 2, 3, 4]
                : [0, 1, 2, 6]
        ).map((index) => {
          const Icon = icons[index];
          return (
            <button
              key={index}
              aria-label={tabs[index]}
              aria-current={tab === index ? "page" : undefined}
              className={tab === index ? "active" : ""}
              disabled={!ready || busy}
              onClick={() => selectTab(index)}
            >
              <Icon aria-hidden="true" />
              <span>{mobileTabLabels[index]}</span>
            </button>
          );
        })}
        <button
          ref={menuButton}
          disabled={!ready || busy}
          aria-label="เมนูทั้งหมด"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          tabIndex={menuOpen ? -1 : 0}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span>เมนูทั้งหมด</span>
        </button>
      </nav>
    </div>
  );
}
function Empty() {
  return (
    <div className="empty">
      <CalendarDays aria-hidden="true" />
      <strong>ยังไม่มีข้อมูลในรายการนี้</strong>
      <p>เริ่มเพิ่มข้อมูลหรือเลือกรายการอื่นเพื่อดูการแข่งขัน</p>
    </div>
  );
}
function Table({
  heads,
  rows,
}: {
  heads: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div
      className="table-wrap"
      role="region"
      aria-label="ตารางข้อมูลการแข่งขัน เลื่อนเพื่อดูคอลัมน์เพิ่มเติม"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h} scope="col" className={columnClass(h)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={columnClass(heads[j])}>
                  {heads[j] === "อันดับ" && typeof c === "number" ? (
                    <span className={`rank rank-${c}`}>{c}</span>
                  ) : heads[j] === "เหรียญ" && typeof c === "string" ? (
                    <span
                      className={`medal-label medal-${c}`}
                      title={
                        (
                          {
                            gold: "เหรียญทอง",
                            silver: "เหรียญเงิน",
                            bronze: "เหรียญทองแดง",
                          } as Record<string, string>
                        )[c]
                      }
                    >
                      <Medal aria-hidden="true" />
                      {c}
                    </span>
                  ) : (
                    c
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
function columnClass(heading: string) {
  if (heading.includes("ทองแดง")) return "numeric medal-bronze";
  if (heading.includes("ทอง")) return "numeric medal-gold";
  if (heading.includes("เงิน")) return "numeric medal-silver";
  if (["คะแนน", "รวม"].includes(heading)) return "numeric points-total";
  if (
    ["อันดับ", "แข่ง", "ชนะ", "เสมอ", "แพ้", "ได้", "เสีย", "ผล"].includes(
      heading,
    )
  )
    return "numeric";
  return "";
}
