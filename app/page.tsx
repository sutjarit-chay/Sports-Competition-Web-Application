"use client";
import { useEffect, useState, useRef } from "react";
import {
  SPORTS,
  initialState,
  parseAthletes,
  roundRobin,
  standings,
  rankRace,
  medals,
  State,
  Athlete,
  Match,
  Race,
  Award,
} from "../lib/domain";
import { supabase } from "../lib/supabase";
import {
  readHosted,
  writeHosted,
  findCompetition,
  type Snapshot,
  writeRegistrationPolicy,
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
  Printer,
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
} from "lucide-react";
const tabs = [
  "ภาพรวม",
  "นักกีฬา",
  "จัดสาย / ตารางแข่ง",
  "บันทึกผล",
  "กรีฑา",
  "ตารางคะแนน",
  "เหรียญรางวัล",
  "โรงเรียน / บัญชี",
];
const icons = [
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardPenLine,
  Activity,
  ChartNoAxesColumn,
  Medal,
  Settings2,
];
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
export default function Home() {
  const [data, setData] = useState<State>(initialState),
    [tab, setTab] = useState(0),
    [demo, setDemo] = useState(true),
    [ready, setReady] = useState(false),
    [role, setRole] = useState("admin"),
    [school, setSchool] = useState("1"),
    [message, setMessage] = useState(""),
    [sport, setSport] = useState(SPORTS[0]),
    [division, setDivision] = useState("ประถม"),
    [gender, setGender] = useState("ชาย"),
    [busy, setBusy] = useState(false);
  const [demoPolicies, setDemoPolicies] = useState<
    Record<string, RegistrationPolicy>
  >({});
  const [registrationRuleId, setRegistrationRuleId] = useState("football-male");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kosamphi-registration-policies-v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.values(parsed).forEach((p) =>
          policyLimits(p as RegistrationPolicy),
        );
        setDemoPolicies(parsed);
      }
    } catch {
      setMessage("อ่านการตั้งค่าโควตาสาธิตไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า");
    }
  }, []);
  const [messageKind, setMessageKind] = useState<"success" | "error">("error");
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [competitionId, setCompetitionId] = useState("");
  const [eventId, setEventId] = useState("");
  const [eventKind, setEventKind] = useState("track");
  const [eventDirection, setEventDirection] = useState("asc");
  const [eventUnit, setEventUnit] = useState("s");
  const [event, setEvent] = useState("วิ่ง 100 เมตร"),
    [stage, setStage] = useState("heat"),
    [heat, setHeat] = useState(1);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kosamphi-demo-v1");
      if (saved) setData(JSON.parse(saved));
    } catch {
      setMessage("ไม่สามารถอ่านข้อมูลสาธิตเดิม");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready && demo)
      localStorage.setItem("kosamphi-demo-v1", JSON.stringify(data));
  }, [data, ready, demo]);
  function chooseCompetition(id: string, source = snapshot) {
    const c = source?.rows.competitions.find((c) => c.id === id);
    if (!c) return;
    setCompetitionId(c.id);
    setSport(c.sport);
    setDivision(c.age_group);
    setGender(c.gender);
    if (id !== competitionId) setEventId("");
  }
  async function refresh() {
    if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
    const { data: session, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError) throw Error(sessionError.message);
    let profile: { role: string; school_id: string | null } | null = null;
    if (session.session) {
      const { data: auth, error } = await supabase.auth.getUser();
      if (error) throw Error(error.message);
      if (auth.user) {
        const res = await supabase
          .from("profiles")
          .select("role,school_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (res.error) throw Error(res.error.message);
        profile = res.data;
      }
    }
    const loaded = await readHosted(
      supabase,
      !!profile &&
        ["admin", "recorder", "referee", "school", "school_admin"].includes(
          profile.role,
        ),
    );
    // Commit mode, permissions and data together only after every read succeeds.
    setSnapshot(loaded);
    setData(loaded.state);
    setRole(profile?.role || "viewer");
    setSchool(
      profile?.school_id ||
        (profile?.role === "admin" ? loaded.state.schools[0]?.id || "" : ""),
    );
    setDemo(false);
    const c =
      loaded.rows.competitions.find((c) => c.id === competitionId) ||
      loaded.rows.competitions[0];
    if (c) chooseCompetition(c.id, loaded);
    else {
      setCompetitionId("");
      setSport("");
      setDivision("");
      setGender("");
    }
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
  async function run(action: () => Promise<void> | void, rethrow = false) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessageKind("success");
      setMessage("บันทึกเรียบร้อย");
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
    if (!demo) {
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

    if (demo && table === "athletes") {
      const groups = new Map<string, Athlete[]>();
      const legacy: Athlete[] = [];
      for (const a of rows as Athlete[]) {
        const matches = compatibleRules(a.sport, a.gender, a.division);
        const id =
          a.roster?.ruleId || (matches.length === 1 ? matches[0].id : "");
        if (!id) {
          if (matches.length > 1)
            throw Error("กรุณาเลือกประเภทกรีฑาและรายการของนักกีฬา");
          throw Error(
            "ประเภทกีฬา เพศ หรือระดับชั้นไม่อยู่ในรายการที่เปิดรับสมัคร กรุณาเลือกประเภทการแข่งขันก่อน",
          );
        }
        groups.set(id, [...(groups.get(id) || []), a]);
      }
      rows = [
        ...legacy,
        ...[...groups].flatMap(([id, values]) =>
          prepareRoster(
            data.athletes,
            values,
            demoPolicies[id] || defaultPolicy(id),
          ),
        ),
      ] as State[K];
    }
    if (demo) {
      setData((d) => ({
        ...d,
        [table]: [
          ...d[table].filter((x) => !rows.some((y) => y.id === x.id)),
          ...rows,
        ],
      }));
      return;
    }
    if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
    if (!snapshot) throw Error("กรุณาโหลดข้อมูล Supabase ใหม่");
    await writeHosted(supabase, snapshot, table, rows);
    await refresh();
  }
  const admin = role === "admin",
    edit = admin || role === "recorder" || role === "referee",
    register = admin || role === "school" || role === "school_admin";
  const competition = snapshot?.rows.competitions.find(
    (c) => c.id === competitionId,
  );
  const ruleCandidates = compatibleRules(sport, gender, division);
  const activeRuleId = ruleCandidates.some((r) => r.id === registrationRuleId)
    ? registrationRuleId
    : ruleCandidates[0]?.id || "";
  const useRoster =
    !!activeRuleId && (demo || snapshot?.registrationExtension === true);
  const activePolicy = demo
    ? demoPolicies[activeRuleId]
    : competition?.registration_policy?.ruleId === activeRuleId
      ? competition.registration_policy
      : undefined;
  const catalogPolicies: Record<string, RegistrationPolicy> = demo
    ? demoPolicies
    : activePolicy
      ? { [activePolicy.ruleId]: activePolicy }
      : {};
  function chooseRegistrationRule(id: string) {
    const r = getRule(id);
    if (!demo) {
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
      return;
    }
    setRegistrationRuleId(id);
    setSport(r.sport);
    if (r.genders.length) setGender(r.genders[0]);
    if (r.levels.length && !r.levels.includes(normalizeLevel(division)))
      setDivision(r.levels[0] === "ประถมศึกษา" ? "ประถม" : r.levels[0]);
  }
  async function configurePolicy(policy: RegistrationPolicy) {
    policyLimits(policy);
    if (!admin) throw Error("เฉพาะผู้ดูแลระบบเท่านั้นที่ตั้งค่าโควตาได้");
    if (demo) {
      const next = { ...demoPolicies, [policy.ruleId]: policy };
      localStorage.setItem(
        "kosamphi-registration-policies-v1",
        JSON.stringify(next),
      );
      setDemoPolicies(next);
    } else {
      if (!supabase || !competition || snapshot?.registrationExtension !== true)
        throw Error("ต้องติดตั้ง migration สำหรับกติกาการสมัครก่อน");
      await writeRegistrationPolicy(supabase, competition.id, policy);
      await refresh();
    }
  }
  const points =
    !demo && competition
      ? {
          win: competition.win_points,
          draw: competition.draw_points,
          loss: competition.loss_points,
        }
      : { win: 3, draw: 1, loss: 0 };
  const eventCandidates = !demo
    ? snapshot?.rows.athletics_events.filter(
        (e) =>
          e.competition_id === competitionId &&
          e.name === event &&
          e.round === stage &&
          e.heat === heat,
      ) || []
    : [];
  const raceEvent = !demo
    ? eventId
      ? snapshot?.rows.athletics_events.find((e) => e.id === eventId)
      : eventCandidates.length === 1
        ? eventCandidates[0]
        : undefined
    : undefined;
  const ambiguousEvent = !demo && !eventId && eventCandidates.length > 1;
  const scopeMatch = (row: {
    sport?: string;
    division: string;
    gender: string;
    competition_id?: string;
  }) =>
    !demo
      ? row.competition_id === competitionId
      : normalizeSport(row.sport || "") === normalizeSport(sport) &&
        normalizeLevel(row.division) === normalizeLevel(division) &&
        row.gender === gender;
  const selected = data.matches.filter((m) => scopeMatch(m));
  const schoolName = (id: string) =>
    data.schools.find((s) => s.id === id)?.name || id;
  const athletes = data.athletes.filter((a) => scopeMatch(a));
  const fields = (f: FormData) => ({
    division: String(f.get("division") || division),
    gender: String(f.get("gender") || gender),
    competition_id: demo ? undefined : competitionId,
  });
  const filter = !demo ? (
    <div className="filters">
      <label>
        รายการแข่งขัน
        <select
          aria-label="รายการแข่งขัน"
          value={competitionId}
          onChange={(e) => chooseCompetition(e.target.value)}
        >
          {snapshot?.rows.competitions.map((c) => (
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
  ) : (
    <div className="filters">
      <label>
        กีฬา
        <select value={sport} onChange={(e) => setSport(e.target.value)}>
          {SPORTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        รุ่น
        <input
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          required
        />
      </label>
      <label>
        เพศ
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          {["ชาย", "หญิง", "ผสม"].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </label>
    </div>
  );
  function selectTab(index: number) {
    setTab(index);
    setMenuOpen(false);
    if (index === 4) {
      setSport("กรีฑา");
      if (!demo) {
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
          {tabs.map((t, i) => (
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
          ))}
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
      <main id="main-content" tabIndex={-1} inert={menuOpen}>
        <header>
          <span>
            <span className="header-desktop-title">ระบบบริหารการแข่งขัน</span>
            <span className="header-mobile-title">นครโกสัมพีเกมส์</span>{" "}
            <span className="badge">
              {demo ? "โหมดสาธิต" : "Supabase · ข้อมูลจริง"}
            </span>
          </span>
          <div>
            <button onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              พิมพ์ / บันทึก PDF
            </button>
          </div>
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
              {demo ? "สาธิต · " : ""}
              {
                (
                  {
                    admin: "ผู้ดูแลระบบ",
                    recorder: "ผู้บันทึกผล",
                    referee: "กรรมการ",
                    school: "โรงเรียน",
                    school_admin: "ผู้ดูแลโรงเรียน",
                    viewer: "ผู้ชม",
                  } as Record<string, string>
                )[role]
              }
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
                    ? "กำลังเตรียมข้อมูลสาธิต"
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
          {tab === 0 && (
            <>
              <PerspectiveTunnelHero
                onRegister={() => selectTab(1)}
                onSchedule={() => selectTab(2)}
                disabled={!ready || busy}
              />
              <div className="stats">
                {[
                  ["โรงเรียนเข้าร่วม", data.schools.length, "แห่ง"],
                  ["นักกีฬาลงทะเบียน", data.athletes.length, "คน"],
                  ["โปรแกรมแข่งขัน", data.matches.length, "คู่"],
                  [
                    "แข่งขันเสร็จแล้ว",
                    data.matches.filter((m) => m.status === "finished").length,
                    "คู่",
                  ],
                ].map(([l, n, u], i) => (
                  <article key={l}>
                    <p>
                      {l}
                      {(() => {
                        const Icon = [School, Users, CalendarDays, CircleCheck][
                          i
                        ];
                        return <Icon aria-hidden="true" />;
                      })()}
                    </p>
                    <strong>{n}</strong>
                    <small>{u}</small>
                  </article>
                ))}
              </div>
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
                        if (!demo) {
                          const c = snapshot?.rows.competitions.find(
                            (c) => c.sport === s,
                          );
                          if (c) chooseCompetition(c.id);
                        }
                        selectTab(s === "กรีฑา" ? 4 : 2);
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
                      rows={medals(
                        data.awards.map((a) => ({
                          school: a.school_id,
                          medal: a.medal,
                        })),
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
                    {data.matches
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
                    {!data.matches.some((m) => m.status === "finished") && (
                      <Empty />
                    )}
                  </div>
                </div>
              </section>
              <div className="notice">
                <Info aria-hidden="true" />
                {demo
                  ? "ข้อมูลสาธิตเก็บในเบราว์เซอร์นี้เท่านั้น ไม่ใช่ข้อมูลการแข่งขันจริง"
                  : "เชื่อมต่อฐานข้อมูลจริง สิทธิ์บังคับใช้ด้วย Supabase RLS"}{" "}
                {demo
                  ? " · ชื่อโรงเรียนเริ่มต้นเป็นชื่อชั่วคราว"
                  : " · ชื่อโรงเรียนจากฐานข้อมูลจริง"}
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
              {!demo && snapshot?.registrationExtension !== true && (
                <p className="notice">
                  ฐานข้อมูลยังไม่ได้ติดตั้งส่วนกติกาการสมัคร
                  แสดงข้อมูลและแบบฟอร์มเดิมอยู่ กรุณาให้ผู้ดูแลติดตั้ง migration
                  เพื่อเปิดแบบฟอร์มแยกตัวจริง/สำรองและตรวจโควตาที่ฐานข้อมูล
                </p>
              )}
              {useRoster ? (
                <RosterRegistrationPanel
                  key={`${demo}-${competitionId}-${activeRuleId}-${school}`}
                  ruleId={activeRuleId}
                  policy={activePolicy || defaultPolicy(activeRuleId)}
                  sport={sport}
                  gender={gender}
                  division={division}
                  competitionId={demo ? undefined : competitionId}
                  athletes={athletes.filter(
                    (a) => !a.roster || a.roster.ruleId === activeRuleId,
                  )}
                  schools={data.schools}
                  school={school}
                  admin={admin}
                  canRegister={register}
                  busy={busy}
                  enabled={
                    demo ||
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
                      if (file.size > 2_000_000)
                        throw Error("ไฟล์ใหญ่เกิน 2 MB");
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
                  !demo &&
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
                                  if (file.size > 2_000_000)
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
                <h2>จัดสายและสร้างโปรแกรมพบกันหมด</h2>
                <p className="muted">
                  เลือกโรงเรียนในสาย ระบบสร้างทุกคู่ในสายเดียวกัน
                  กำหนดวันและสนามได้หลังสร้าง
                </p>
                {edit && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      run(async () => {
                        const pool = String(f.get("pool"));
                        if (selected.some((m) => m.pool === pool))
                          throw Error(
                            "สายนี้มีโปรแกรมแล้ว กรุณาใช้ชื่อสายใหม่",
                          );
                        const teams = f.getAll("teams").map(String);
                        if (teams.length < 2)
                          throw Error("เลือกอย่างน้อย 2 โรงเรียน");
                        await save(
                          "matches",
                          roundRobin(teams).map((p) => ({
                            ...p,
                            id: crypto.randomUUID(),
                            sport,
                            division,
                            gender,
                            competition_id: demo ? undefined : competitionId,
                            pool,
                            starts_at: "",
                            venue: "",
                            status: "scheduled",
                          })),
                        );
                      });
                    }}
                  >
                    <label>
                      ชื่อสาย
                      <input name="pool" defaultValue="A" required />
                    </label>
                    <fieldset>
                      <legend>โรงเรียนในสาย</legend>
                      {data.schools.map((s) => (
                        <label className="check" key={s.id}>
                          <input type="checkbox" name="teams" value={s.id} />
                          {s.name}
                        </label>
                      ))}
                    </fieldset>
                    <button className="primary" disabled={busy}>
                      สร้างตารางแข่งขัน
                    </button>
                  </form>
                )}
                <Table
                  heads={["สาย", "คู่แข่งขัน", "วันเวลา", "สนาม"]}
                  rows={selected.map((m) => [
                    m.pool,
                    `${schoolName(m.home)} — ${schoolName(m.away)}`,
                    m.starts_at || "รอกำหนด",
                    m.venue || "รอกำหนด",
                  ])}
                />
                {edit &&
                  selected.map((m) => (
                    <form
                      key={m.id}
                      className="match-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(() =>
                          save("matches", [
                            {
                              ...m,
                              starts_at: String(f.get("date")),
                              venue: String(f.get("venue")),
                            },
                          ]),
                        );
                      }}
                    >
                      <span>
                        {schoolName(m.home)} / {schoolName(m.away)}
                      </span>
                      <label>
                        วันเวลา (ประเทศไทย)
                        <input
                          name="date"
                          type="datetime-local"
                          defaultValue={m.starts_at}
                        />
                      </label>
                      <label>
                        สนาม
                        <input name="venue" defaultValue={m.venue} />
                      </label>
                      <button disabled={busy}>บันทึกเวลา</button>
                    </form>
                  ))}
              </section>
            </>
          )}
          {tab === 3 && (
            <>
              {filter}
              <section className="panel">
                <h2>บันทึกผลการแข่งขัน</h2>
                <p className="muted">
                  คะแนนลีก: ชนะ {points.win} · เสมอ {points.draw} · แพ้{" "}
                  {points.loss} | เหรียญรางวัลบันทึกแยกหลังยืนยันรอบชิง
                </p>
                {selected.length === 0 && <Empty />}
                {selected.map((m) => (
                  <form
                    className="match-form"
                    key={m.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      run(() =>
                        save("matches", [
                          {
                            ...m,
                            home_score: Number(f.get("home")),
                            away_score: Number(f.get("away")),
                            status: "finished",
                          },
                        ]),
                      );
                    }}
                  >
                    <b>
                      สาย {m.pool} · {schoolName(m.home)} — {schoolName(m.away)}
                    </b>
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
                      {m.status === "finished" ? "จบการแข่งขัน" : "รอผล"}
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
                {!demo && (
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
                        }
                      }}
                    >
                      <option value="">สร้าง/ค้นหารายการตามชื่อและรอบ</option>
                      {snapshot?.rows.athletics_events
                        .filter((e) => e.competition_id === competitionId)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name} · {e.round} · ฮีต {e.heat}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="filters">
                  <label>
                    รายการ
                    <input
                      value={event}
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
                      onChange={(e) => (
                        setHeat(Math.max(1, Number(e.target.value))),
                        setEventId("")
                      )}
                    />
                  </label>
                </div>
                <p className="muted">
                  บันทึกตามหน่วยของรายการ · ผู้ได้ผลเท่ากันได้อันดับร่วม
                </p>
                {ambiguousEvent && (
                  <p role="alert">
                    มีรายการกรีฑาชื่อและรอบซ้ำ กรุณาเลือกรายการกรีฑาที่มีอยู่
                  </p>
                )}
                {!demo && !raceEvent && (
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
                  </div>
                )}
                {edit && (
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
                            (demo || r.competition_id === competitionId) &&
                            (!eventId || r.event_id === eventId),
                        );
                        const status = String(f.get("status"));
                        const value = f.get("value")
                          ? Number(f.get("value"))
                          : null;
                        if (status === "OK" && (value === null || value <= 0))
                          throw Error("กรอกเวลาที่มากกว่า 0");
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
                            kind: raceEvent?.kind || eventKind,
                            direction: raceEvent?.direction || eventDirection,
                            unit: raceEvent?.unit || eventUnit,
                            value,
                            status,
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
                      {demo
                        ? "เวลา (วินาที)"
                        : `ผล (${raceEvent?.unit || eventUnit})`}
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
                        (demo || r.competition_id === competitionId) &&
                        !ambiguousEvent &&
                        (!raceEvent || r.event_id === raceEvent.id),
                    ),
                    !demo &&
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
                              data.races.some(
                                (x) =>
                                  x.event === event &&
                                  x.stage === "final" &&
                                  x.athlete_id === r.athlete_id &&
                                  x.division === division &&
                                  x.gender === gender &&
                                  (demo || x.competition_id === competitionId),
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
                                stage: "final",
                                heat: 1,
                                value: null,
                                status: "DNS",
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
            <section className="panel">
              <h2>ทำเนียบเหรียญรางวัล</h2>
              {edit && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    run(() =>
                      save("awards", [
                        {
                          id: crypto.randomUUID(),
                          event: String(f.get("event")),
                          division,
                          gender,
                          school_id: String(f.get("school")),
                          medal: String(f.get("medal")),
                        },
                      ]),
                    );
                  }}
                >
                  {filter}
                  <label>
                    รายการรอบชิง
                    <input name="event" required placeholder="ฟุตบอล รอบชิง" />
                  </label>
                  <label>
                    โรงเรียน
                    <select name="school">
                      {data.schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    เหรียญ
                    <select name="medal">
                      <option value="gold">ทอง</option>
                      <option value="silver">เงิน</option>
                      <option value="bronze">ทองแดง</option>
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    เพิ่มเหรียญ
                  </button>
                </form>
              )}
              <Table
                heads={[
                  "อันดับ",
                  "โรงเรียน",
                  "🥇 ทอง",
                  "🥈 เงิน",
                  "🥉 ทองแดง",
                  "รวม",
                ]}
                rows={medals(
                  data.awards.map((a) => ({
                    school: a.school_id,
                    medal: a.medal,
                  })),
                ).map((r, i) => [
                  i + 1,
                  schoolName(r.school),
                  r.gold,
                  r.silver,
                  r.bronze,
                  r.gold + r.silver + r.bronze,
                ])}
              />
              <h3>รายการที่ได้รับเหรียญ</h3>
              <Table
                heads={["รายการ", "รุ่น / เพศ", "โรงเรียน", "เหรียญ"]}
                rows={data.awards.map((a) => [
                  a.event,
                  `${a.division} / ${a.gender}`,
                  schoolName(a.school_id),
                  a.medal,
                ])}
              />
            </section>
          )}
          {tab === 7 && (
            <>
              <section className="panel">
                <h2>บัญชีและการเชื่อมต่อ</h2>
                <p>
                  สาธิตแยกจากฐานข้อมูลจริง เปลี่ยนโหมดได้หลังตั้งค่า Supabase
                </p>
                {demo ? (
                  <>
                    <button
                      disabled={!supabase || busy}
                      onClick={() =>
                        run(async () => {
                          await refresh();
                          setDemo(false);
                        })
                      }
                    >
                      เข้าสู่โหมด Supabase
                    </button>
                    {!supabase && (
                      <p className="muted">
                        ยังไม่ได้ตั้งค่า Supabase — ดู README
                        สำหรับการตั้งค่าคีย์สาธารณะและฐานข้อมูล
                      </p>
                    )}
                    <label>
                      ทดลองสิทธิ์ (เฉพาะสาธิต)
                      <select
                        disabled={busy}
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        {["admin", "recorder", "school", "viewer"].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (confirm("ล้างข้อมูลสาธิตทั้งหมดในเบราว์เซอร์นี้?"))
                          setData(initialState());
                      }}
                    >
                      ล้างข้อมูลสาธิต
                    </button>
                  </>
                ) : (
                  <>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        run(async () => {
                          const res = await supabase!.auth.signInWithPassword({
                            email: String(f.get("email")),
                            password: String(f.get("password")),
                          });
                          if (res.error) throw Error(res.error.message);
                          await refresh();
                        });
                      }}
                    >
                      <label>
                        อีเมล
                        <input name="email" type="email" required />
                      </label>
                      <label>
                        รหัสผ่าน
                        <input
                          name="password"
                          type="password"
                          required
                          autoComplete="current-password"
                        />
                      </label>
                      <button disabled={busy}>เข้าสู่ระบบ</button>
                    </form>
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
                          setSchool("");
                          setData((d) => ({ ...d, athletes: [] }));
                          await refresh();
                        })
                      }
                    >
                      ออกจากระบบ
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setDemo(true);
                        const saved = localStorage.getItem("kosamphi-demo-v1");
                        setData(saved ? JSON.parse(saved) : initialState());
                        setRole("admin");
                        setSchool("1");
                        setSnapshot(null);
                        setCompetitionId("");
                        setSport(SPORTS[0]);
                        setDivision("ประถม");
                        setGender("ชาย");
                        setEventId("");
                      }}
                    >
                      กลับสาธิต
                    </button>
                  </>
                )}
              </section>
              <section className="panel">
                <h2>โรงเรียนที่เข้าร่วม</h2>
                {data.schools.map((s) => (
                  <form
                    key={s.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      run(() =>
                        save("schools", [
                          { ...s, name: String(f.get("name")) },
                        ]),
                      );
                    }}
                  >
                    <label>
                      โรงเรียน {s.id}
                      <input
                        name="name"
                        defaultValue={s.name}
                        required
                        disabled={!admin}
                      />
                    </label>
                    {admin && <button disabled={busy}>บันทึก</button>}
                  </form>
                ))}
              </section>
            </>
          )}
          <footer>
            นครโกสัมพีเกมส์ • ปีการศึกษา 2569{" "}
            <span>SPORT · UNITY · FAIR PLAY</span>
          </footer>
        </div>
      </main>
      <nav
        className={`mobile-nav${menuOpen ? " drawer-open" : ""}`}
        aria-label="เมนูมือถือ"
      >
        {[0, 1, 2, 6].map((index) => {
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
              <span>
                {
                  ["ภาพรวม", "นักกีฬา", "ตารางแข่ง", "เหรียญรางวัล"][
                    [0, 1, 2, 6].indexOf(index)
                  ]
                }
              </span>
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
