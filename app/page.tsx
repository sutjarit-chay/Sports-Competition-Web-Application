"use client";
import { useEffect, useState } from "react";
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
  async function refresh() {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    const p = auth.user
      ? await supabase
          .from("profiles")
          .select("*")
          .eq("id", auth.user.id)
          .single()
      : null;
    setRole(p?.data?.role || "viewer");
    setSchool(p?.data?.school_id || "1");
    const next = initialState();
    for (const table of [
      "schools",
      "athletes",
      "matches",
      "races",
      "awards",
    ] as const) {
      const res = await supabase.from(table).select("*");
      if (res.error) throw Error(res.error.message);
      (next[table] as unknown[]) = res.data;
    }
    setData(next);
  }
  async function run(action: () => Promise<void> | void) {
    setBusy(true);
    try {
      await action();
      setMessage("บันทึกเรียบร้อย");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }
  async function save<K extends keyof State>(table: K, rows: State[K]) {
    if (table === "athletes") {
      const existing = data.athletes.filter(
        (a) => !rows.some((r) => r.id === a.id),
      );
      const seen = new Set(
        existing.map((a) =>
          [a.name, a.school_id, a.sport, a.gender, a.division].join("|"),
        ),
      );
      for (const a of rows as Athlete[]) {
        if (!a.name.trim() || !a.division.trim())
          throw Error("กรอกชื่อและรุ่นให้ครบ");
        const key = [a.name, a.school_id, a.sport, a.gender, a.division].join(
          "|",
        );
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
    const { error } = await supabase
      .from(table)
      .upsert(rows as unknown as Record<string, unknown>[]);
    if (error) throw Error(error.message);
    await refresh();
  }
  const admin = role === "admin",
    edit = admin || role === "recorder",
    register = admin || role === "school";
  const selected = data.matches.filter(
    (m) => m.sport === sport && m.division === division && m.gender === gender,
  );
  const schoolName = (id: string) =>
    data.schools.find((s) => s.id === id)?.name || id;
  const athletes = data.athletes.filter(
    (a) => a.sport === sport && a.division === division && a.gender === gender,
  );
  const fields = (f: FormData) => ({
    division: String(f.get("division") || division),
    gender: String(f.get("gender") || gender),
  });
  const filter = (
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
              disabled={!ready}
              className={tab === i ? "active" : ""}
              onClick={() => setTab(i)}
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
                    school: "โรงเรียน",
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
                · ชื่อโรงเรียนเริ่มต้นเป็นชื่อชั่วคราว
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
                                const rows = parseAthletes(await file.text());
                                if (
                                  !admin &&
                                  rows.some((r) => r.school_id !== school)
                                )
                                  throw Error("นำเข้าได้เฉพาะโรงเรียนตนเอง");
                                const seen = new Set(
                                  data.athletes.map((a) =>
                                    [
                                      a.name,
                                      a.school_id,
                                      a.sport,
                                      a.gender,
                                      a.division,
                                    ].join("|"),
                                  ),
                                );
                                if (
                                  rows.some((a) =>
                                    seen.has(
                                      [
                                        a.name,
                                        a.school_id,
                                        a.sport,
                                        a.gender,
                                        a.division,
                                      ].join("|"),
                                    ),
                                  )
                                )
                                  throw Error("พบข้อมูลนักกีฬาซ้ำ");
                                await save("athletes", rows);
                              });
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <a href="/athletes-template.csv" download>
                        ดาวน์โหลดแบบฟอร์ม CSV
                      </a>
                    </div>
                  </>
                ) : (
                  <p>บัญชีนี้ไม่มีสิทธิ์ลงทะเบียน</p>
                )}
                <Table
                  heads={["ชื่อ–นามสกุล", "โรงเรียน", "กีฬา", "รุ่น / เพศ"]}
                  rows={athletes.map((a) => [
                    a.name,
                    schoolName(a.school_id),
                    a.sport,
                    `${a.division} / ${a.gender}`,
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
                        วันเวลา
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
                  คะแนนลีก: ชนะ 3 · เสมอ 1 · แพ้ 0 |
                  เหรียญรางวัลบันทึกแยกหลังยืนยันรอบชิง
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
                <div className="filters">
                  <label>
                    รายการ
                    <input
                      value={event}
                      onChange={(e) => setEvent(e.target.value)}
                    />
                  </label>
                  <label>
                    รอบ
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
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
                      onChange={(e) =>
                        setHeat(Math.max(1, Number(e.target.value)))
                      }
                    />
                  </label>
                </div>
                <p className="muted">
                  รายการวิ่ง ใช้เวลาเป็นวินาที ค่าน้อยอันดับดีกว่า ·
                  ผู้ได้เวลาเท่ากันได้อันดับร่วม
                </p>
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
                            r.athlete_id === aid,
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
                          .filter(
                            (a) =>
                              a.sport === "กรีฑา" &&
                              a.division === division &&
                              a.gender === gender,
                          )
                          .map((a) => (
                            <option value={a.id} key={a.id}>
                              {a.name} · {schoolName(a.school_id)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      เวลา (วินาที)
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
                  heads={["อันดับ", "นักกีฬา", "เวลา", "สถานะ", "เข้ารอบ"]}
                  rows={rankRace(
                    data.races.filter(
                      (r) =>
                        r.event === event &&
                        r.division === division &&
                        r.gender === gender &&
                        r.stage === stage &&
                        r.heat === heat,
                    ),
                  ).map((r) => [
                    r.rank ?? "—",
                    data.athletes.find((a) => a.id === r.athlete_id)?.name ||
                      r.athlete_id,
                    r.value ?? "—",
                    r.status,
                    edit && stage === "heat" && r.rank !== null ? (
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
                                  x.gender === gender,
                              )
                            )
                              throw Error("เข้ารอบชิงแล้ว");
                            await save("races", [
                              {
                                event: r.event,
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
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                      >
                        {["admin", "recorder", "school", "viewer"].map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <button
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
                    <button
                      onClick={() =>
                        run(async () => {
                          await supabase!.auth.signOut();
                          await refresh();
                        })
                      }
                    >
                      ออกจากระบบ
                    </button>
                    <button
                      onClick={() => {
                        setDemo(true);
                        const saved = localStorage.getItem("kosamphi-demo-v1");
                        setData(saved ? JSON.parse(saved) : initialState());
                        setRole("admin");
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
