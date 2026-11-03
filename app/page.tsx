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
} from "../lib/hosted";
import Papa from "papaparse";
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
const icons = ["◈", "♙", "▦", "✎", "⚑", "≡", "♕", "⚙"];
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
  async function run(action: () => Promise<void> | void) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await action();
      setMessage("บันทึกเรียบร้อย");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
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
            a.competition_id || [a.sport, a.gender, a.division].join("|"),
          ].join("|"),
        ),
      );
      for (const a of rows as Athlete[]) {
        if (!a.name.trim() || !a.division.trim())
          throw Error("กรอกชื่อและรุ่นให้ครบ");
        const key = [
          a.name,
          a.school_id,
          a.competition_id || [a.sport, a.gender, a.division].join("|"),
        ].join("|");
        if (seen.has(key)) throw Error("ข้อมูลนักกีฬาซ้ำ");
        seen.add(key);
      }
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
      : row.sport === sport &&
        row.division === division &&
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
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <b>✦</b>
          <div>
            นครโกสัมพีเกมส์<small>SPORTS MANAGEMENT · 2569</small>
          </div>
        </div>
        <div className="season">
          การแข่งขันกีฬาเครือข่าย
          <br />
          <strong>ปีการศึกษา 2569</strong>
        </div>
        <nav>
          {tabs.map((t, i) => (
            <button
              key={t}
              aria-label={t}
              disabled={!ready || busy}
              className={tab === i ? "active" : ""}
              onClick={() => {
                setTab(i);
                if (i === 4) {
                  setSport("กรีฑา");
                  if (!demo) {
                    const c = snapshot?.rows.competitions.find(
                      (c) => c.sport === "กรีฑา",
                    );
                    if (c) chooseCompetition(c.id);
                  }
                }
              }}
            >
              <span>{icons[i]}</span>
              {t}
            </button>
          ))}
        </nav>
        <div className="aside-bottom">
          10 โรงเรียน · 8 ชนิดกีฬา
          <br />
          <small>ร่วมแรง ร่วมใจ สู่ชัยชนะ</small>
        </div>
      </aside>
      <main>
        <header>
          <span>
            ระบบบริหารการแข่งขัน{" "}
            <span className="badge">
              {demo ? "โหมดสาธิต" : "Supabase · ข้อมูลจริง"}
            </span>
          </span>
          <div>
            <button onClick={() => window.print()}>↗ พิมพ์ / บันทึก PDF</button>
          </div>
        </header>
        <div className="content">
          <div className="heading">
            <div>
              <p className="eyebrow">NAKHON KOSAMPHI GAMES 2026</p>
              <h1>{tabs[tab]}</h1>
              <p className="muted">
                กีฬาแห่งมิตรภาพ สร้างพลังเยาวชน • ปีการศึกษา 2569
              </p>
            </div>
            <span className="role">
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
          {message && (
            <div role="status" className="notice">
              {message}
              <button onClick={() => setMessage("")}>×</button>
            </div>
          )}
          {tab === 0 && (
            <>
              <section className="hero">
                <div>
                  <span className="badge light">นครโกสัมพีเกมส์ 2569</span>
                  <h2>
                    ทุกการแข่งขัน
                    <br />
                    เริ่มต้นด้วยทีมที่พร้อม
                  </h2>
                  <p>จัดการนักกีฬา ตารางแข่งขัน และผลการแข่งขันในที่เดียว</p>
                  <button onClick={() => setTab(1)}>ลงทะเบียนนักกีฬา →</button>
                </div>
                <div className="trophy" aria-hidden>
                  ♕<small>TOGETHER WE PLAY</small>
                </div>
              </section>
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
                ].map(([l, n, u]) => (
                  <article key={l}>
                    <p>{l}</p>
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
                        setTab(s === "กรีฑา" ? 4 : 2);
                      }}
                    >
                      <span>
                        {["⚽", "◉", "◎", "●", "✺", "⚑", "◌", "◒"][i]}
                      </span>
                      <b>{s}</b>
                      <small>ดูรายการแข่งขัน →</small>
                    </button>
                  ))}
                </div>
              </section>
              <div className="notice">
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
              {filter}
              <section className="panel">
                <h2>ลงทะเบียนนักกีฬา</h2>
                {register ? (
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
                                String(f.get("bib") || "").trim() || undefined,
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
                        onClick={() => downloadCsv("schools.csv", data.schools)}
                      >
                        ดาวน์โหลดรหัสโรงเรียน
                      </button>
                    </div>
                  </>
                ) : (
                  <p>บัญชีนี้ไม่มีสิทธิ์ลงทะเบียน</p>
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
    </div>
  );
}
function Empty() {
  return (
    <p className="empty">
      ยังไม่มีข้อมูลในรายการนี้ เริ่มเพิ่มข้อมูลเพื่อจัดการแข่งขัน
    </p>
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
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
