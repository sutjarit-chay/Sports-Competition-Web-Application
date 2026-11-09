"use client";
import { useState, type FormEvent } from "react";
import { CalendarDays, Trophy, Save, FileUp } from "lucide-react";
import { RULES, compatibleRules } from "../lib/registration";
import {
  parseCompetitionCsv,
  parseFixtureCsv,
  parseTeamCsv,
  type CompetitionCsvRow,
} from "../lib/admin-competitions";
import type { ProductionManagedCompetition } from "../lib/production-competitions";
type School = { id: string; name: string };
type Props = {
  schools: School[];
  competitions: ProductionManagedCompetition[];
  busy?: boolean;
  onMutation: (action: Record<string, unknown>) => Promise<void>;
};
const initial = {
  ruleId: RULES[0].id,
  name: "",
  sport: RULES[0].sport,
  ageGroup: RULES[0].levels[0] || "ประถมศึกษา",
  gender: RULES[0].genders[0] || "ชาย",
  format: "knockout",
  teamLimit: 16,
  details: "",
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
};
export function AdminCompetitionManager({
  schools,
  competitions,
  busy = false,
  onMutation,
}: Props) {
  const [panel, setPanel] = useState("competitions"),
    [form, setForm] = useState(initial),
    [selectedId, setSelectedId] = useState(""),
    [teams, setTeams] = useState<string[]>(["", ""]),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false),
    [csvKind, setCsvKind] = useState("competitions"),
    [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const selected = competitions.find((c) => c.id === selectedId);
  const disabled = busy || working;
  const schoolName = (id: string) =>
    schools.find((s) => s.id === id)?.name || id;
  async function mutate(action: Record<string, unknown>) {
    setWorking(true);
    setNotice("");
    try {
      await onMutation(action);
      setNotice("บันทึกข้อมูลแล้ว");
      return true;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่",
      );
      return false;
    } finally {
      setWorking(false);
    }
  }
  function choose(id: string) {
    setSelectedId(id);
    const c = competitions.find((c) => c.id === id);
    setTeams(c?.teams.length ? [...c.teams] : ["", ""]);
    setNotice("");
  }
  function selectRule(id: string) {
    const rule = RULES.find((r) => r.id === id)!;
    setForm({
      ...form,
      ruleId: id,
      sport: rule.sport,
      gender: rule.genders[0] || "ชาย",
      ageGroup: rule.levels[0] || "ประถมศึกษา",
    });
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (await mutate({ action: "create", competition: form }))
      setForm({ ...initial });
  }
  async function inspect(file?: File) {
    setPreview(null);
    setNotice("");
    if (!file) return;
    try {
      if (file.size > 1000000) throw Error("ไฟล์ CSV ต้องไม่เกิน 1 MB");
      const csv = await file.text();
      let actions: Record<string, unknown>[];
      if (csvKind === "competitions")
        actions = parseCompetitionCsv(csv).map((row: CompetitionCsvRow) => {
          const rules = compatibleRules(row.sport, row.gender, row.ageGroup);
          if (rules.length !== 1)
            throw Error(
              `รายการ ${row.name}: กรุณาระบุประเภทที่ตรงกับระเบียบผ่านแบบฟอร์ม`,
            );
          return {
            action: "create",
            competition: { ...row, ruleId: rules[0].id },
          };
        });
      else if (csvKind === "teams") {
        const rows = parseTeamCsv(csv, competitions, schools);
        const ids = [...new Set(rows.map((r) => r.competition))];
        actions = ids.map((id) => {
          const competition = competitions.find((c) => c.id === id)!;
          if (competition.fixtures.length)
            throw Error("รายการที่มีโปรแกรมแล้วไม่สามารถจัดสายใหม่");
          return {
            action: "draw",
            id,
            revision: competition.managementRevision,
            teams: [
              ...competition.teams,
              ...rows.filter((r) => r.competition === id).map((r) => r.school),
            ],
          };
        });
      } else
        actions = parseFixtureCsv(csv, competitions, schools).map((row) => {
          const competition = competitions.find(
            (c) => c.id === row.competition,
          )!;
          const fixture = competition.fixtures.find(
            (f) =>
              f.round === row.round &&
              f.home === row.home &&
              f.away === row.away,
          );
          if (!fixture) throw Error("กรุณาสร้างสายแข่งขันก่อนนำเข้าตาราง");
          return {
            action: "schedule",
            id: competition.id,
            fixtureId: fixture.id,
            startsAt: row.startsAt,
            venue: row.venue,
          };
        });
      setPreview(actions);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "อ่าน CSV ไม่สำเร็จ");
    }
  }
  async function confirmImport() {
    if (!preview) return;
    setWorking(true);
    setNotice("");
    let saved = 0;
    try {
      for (const action of preview) {
        await onMutation(action);
        saved++;
      }
      setPreview(null);
      setNotice(`บันทึกแล้ว ${saved} รายการ`);
    } catch (error) {
      setPreview(null);
      setNotice(
        `บันทึกแล้ว ${saved} รายการ กรุณาโหลดข้อมูลก่อนนำเข้าส่วนที่เหลือ: ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}`,
      );
    } finally {
      setWorking(false);
    }
  }
  function template() {
    const headers =
      csvKind === "competitions"
        ? "name,sport,age_group,gender,details,starters,reserves,team_limit,format,win_points,draw_points,loss_points"
        : csvKind === "teams"
          ? "competition_name,school_name"
          : "competition_name,round,home_school,away_school,starts_at,venue";
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + headers + "\n"], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = csvKind + ".csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="admin-competition-manager">
      <div className="admin-manager-tabs">
        {[
          ["competitions", "รายการแข่งขัน"],
          ["bracket", "จัดสายแข่งขัน"],
          ["csv", "นำเข้าข้อมูล CSV"],
        ].map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={panel === key ? "active" : ""}
            onClick={() => setPanel(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {panel === "competitions" && (
        <div className="admin-competition-layout">
          <section className="panel">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">COMPETITIONS</p>
                <h2>รายการแข่งขัน</h2>
              </div>
              <Trophy />
            </div>
            {competitions.length === 0 && (
              <p className="muted">ยังไม่มีรายการแข่งขัน</p>
            )}
            {competitions.map((c) => (
              <article className="admin-competition-card" key={c.id}>
                <h3>{c.name}</h3>
                <p>
                  {c.sport} · {c.ageGroup} · {c.gender}
                </p>
                <p className="muted">{c.details || "ยังไม่ระบุรายละเอียด"}</p>
                {c.editable !== false && (
                  <details>
                    <summary>แก้ไขรายละเอียดรายการ</summary>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        void mutate({
                          action: "update",
                          id: c.id,
                          revision: c.managementRevision,
                          competition: {
                            name: data.get("name"),
                            details: data.get("details"),
                            teamLimit: Number(data.get("teamLimit")),
                            format: data.get("format"),
                            winPoints: Number(data.get("winPoints")),
                            drawPoints: Number(data.get("drawPoints")),
                            lossPoints: Number(data.get("lossPoints")),
                          },
                        });
                      }}
                    >
                      <label>
                        ชื่อรายการ
                        <input
                          name="name"
                          required
                          defaultValue={c.name}
                          maxLength={200}
                        />
                      </label>
                      <label>
                        รายละเอียด
                        <textarea
                          name="details"
                          defaultValue={c.details}
                          maxLength={2000}
                        />
                      </label>
                      <label>
                        จำนวนทีมสูงสุด
                        <input
                          name="teamLimit"
                          type="number"
                          min={Math.max(2, c.teams.length)}
                          max={100}
                          defaultValue={c.teamLimit}
                        />
                      </label>
                      <label>
                        รูปแบบ
                        <select
                          name="format"
                          defaultValue={c.format}
                          disabled={c.fixtures.length > 0}
                        >
                          <option value="knockout">คัดออก</option>
                          <option value="round_robin">พบกันหมด</option>
                        </select>
                      </label>
                      {(
                        [
                          ["winPoints", "คะแนนชนะ", c.winPoints],
                          ["drawPoints", "คะแนนเสมอ", c.drawPoints],
                          ["lossPoints", "คะแนนแพ้", c.lossPoints],
                        ] as const
                      ).map(([name, label, value]) => (
                        <label key={name}>
                          {label}
                          <input
                            name={name}
                            type="number"
                            min={0}
                            max={1000}
                            defaultValue={value}
                          />
                        </label>
                      ))}
                      <button
                        type="submit"
                        className="primary"
                        disabled={disabled}
                      >
                        บันทึกการแก้ไข
                      </button>
                    </form>
                  </details>
                )}
                {c.editable === false ? (
                  <p className="notice">
                    รายการเดิม: อ่านข้อมูลได้
                    กรุณาตรวจสอบระเบียบกับผู้จัดก่อนแก้ไข
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      choose(c.id);
                      setPanel("bracket");
                    }}
                  >
                    จัดสายและโปรแกรม
                  </button>
                )}
              </article>
            ))}
          </section>
          <section className="panel">
            <h2>เพิ่มรายการแข่งขัน</h2>
            <form onSubmit={create}>
              <label>
                ประเภทตามระเบียบ
                <select
                  value={form.ruleId}
                  onChange={(e) => selectRule(e.target.value)}
                >
                  {RULES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ชื่อรายการ
                <input
                  required
                  value={form.name}
                  maxLength={200}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <div className="form-grid">
                <label>
                  ระดับ
                  <select
                    value={form.ageGroup}
                    onChange={(e) =>
                      setForm({ ...form, ageGroup: e.target.value })
                    }
                  >
                    {(RULES.find((r) => r.id === form.ruleId)!.levels.length
                      ? RULES.find((r) => r.id === form.ruleId)!.levels
                      : ["อนุบาล", "ประถมศึกษา", "มัธยมศึกษา"]
                    ).map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label>
                  เพศ
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm({ ...form, gender: e.target.value })
                    }
                  >
                    {(RULES.find((r) => r.id === form.ruleId)!.genders.length
                      ? RULES.find((r) => r.id === form.ruleId)!.genders
                      : ["ชาย", "หญิง", "ผสม"]
                    ).map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  รูปแบบ
                  <select
                    value={form.format}
                    onChange={(e) =>
                      setForm({ ...form, format: e.target.value })
                    }
                  >
                    <option value="knockout">คัดออก</option>
                    <option value="round_robin">พบกันหมด</option>
                  </select>
                </label>
                <label>
                  จำนวนทีมสูงสุด
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={form.teamLimit}
                    onChange={(e) =>
                      setForm({ ...form, teamLimit: Number(e.target.value) })
                    }
                  />
                </label>
                {(["winPoints", "drawPoints", "lossPoints"] as const).map(
                  (key, i) => (
                    <label key={key}>
                      {["คะแนนชนะ", "คะแนนเสมอ", "คะแนนแพ้"][i]}
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        value={form[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: Number(e.target.value) })
                        }
                      />
                    </label>
                  ),
                )}
              </div>
              <label>
                รายละเอียด
                <textarea
                  maxLength={2000}
                  value={form.details}
                  onChange={(e) =>
                    setForm({ ...form, details: e.target.value })
                  }
                />
              </label>
              <button className="primary" disabled={disabled}>
                <Save /> บันทึกรายการ
              </button>
            </form>
          </section>
        </div>
      )}
      {panel === "bracket" && (
        <section className="panel admin-bracket-panel">
          <div className="admin-panel-heading">
            <h2>จัดสายแข่งขัน</h2>
            <CalendarDays />
          </div>
          <label>
            เลือกรายการแข่งขัน
            <select value={selectedId} onChange={(e) => choose(e.target.value)}>
              <option value="">เลือกรายการ</option>
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {selected &&
            (selected.editable === false ? (
              <p className="notice">
                รายการเดิมไม่ตรงกับระเบียบที่รองรับ
                แสดงข้อมูลได้โดยไม่แก้ไขข้อมูลเดิม
              </p>
            ) : selected.sport === "กรีฑา" ? (
              <p className="notice">
                กรีฑาให้จัดรายการวิ่งและบันทึกผลในหน้ากรีฑา
              </p>
            ) : (
              <>
                <h3>{selected.name}</h3>
                <p>
                  {selected.format === "knockout" ? "คัดออก" : "พบกันหมด"} ·
                  รับสูงสุด {selected.teamLimit} ทีม
                </p>
                {selected.groups?.map((group) => (
                  <p key={group.name}>
                    สาย {group.name}: {group.teams.map(schoolName).join(", ")}
                  </p>
                ))}
                {!selected.fixtures.length && (
                  <>
                    <label>
                      จำนวนทีมที่จะจัดสาย
                      <input
                        type="number"
                        min={2}
                        max={Math.min(selected.teamLimit, schools.length)}
                        value={teams.length}
                        onChange={(e) =>
                          setTeams(
                            Array.from(
                              {
                                length: Math.max(
                                  2,
                                  Math.min(
                                    selected.teamLimit,
                                    Number(e.target.value),
                                  ),
                                ),
                              },
                              (_, i) => teams[i] || "",
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="admin-team-slots">
                      {teams.map((id, i) => (
                        <label className="admin-team-slot" key={i}>
                          ทีม {i + 1}
                          <select
                            aria-label={`ทีม ${i + 1}`}
                            value={id}
                            onChange={(e) =>
                              setTeams(
                                teams.map((v, j) =>
                                  j === i ? e.target.value : v,
                                ),
                              )
                            }
                          >
                            <option value="">เลือกโรงเรียน</option>
                            {schools
                              .filter(
                                (s) => !teams.includes(s.id) || id === s.id,
                              )
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <button
                      className="primary"
                      type="button"
                      disabled={disabled || teams.some((t) => !t)}
                      onClick={() =>
                        mutate({
                          action: "draw",
                          id: selected.id,
                          revision: selected.managementRevision,
                          teams,
                        })
                      }
                    >
                      สร้างสายและบันทึกโปรแกรม
                    </button>
                  </>
                )}
                {selected.fixtures.length > 0 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      mutate({
                        action: "draw",
                        id: selected.id,
                        revision: selected.managementRevision,
                        teams: selected.teams,
                      })
                    }
                  >
                    ตรวจสอบและบันทึกคู่ที่พร้อมแข่งขัน
                  </button>
                )}
                <div className="admin-fixture-list">
                  {selected.fixtures.map((f) => (
                    <form
                      className="admin-fixture-row"
                      key={
                        f.id +
                        f.startsAt +
                        f.venue +
                        f.resolvedHome +
                        f.resolvedAway
                      }
                      onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        void mutate({
                          action: "schedule",
                          id: selected.id,
                          revision: selected.managementRevision,
                          fixtureId: f.id,
                          startsAt: data.get("startsAt"),
                          venue: data.get("venue"),
                          ...(data.has("resolvedHome")
                            ? { resolvedHome: data.get("resolvedHome") }
                            : {}),
                          ...(data.has("resolvedAway")
                            ? { resolvedAway: data.get("resolvedAway") }
                            : {}),
                        });
                      }}
                    >
                      <strong>
                        {f.sourceNumber ? `คู่ ${f.sourceNumber} · ` : ""}
                        {f.round}
                      </strong>
                      <span>
                        {schoolName(f.home)} พบ {schoolName(f.away)}
                      </span>
                      {(["home", "away"] as const).map((side) => {
                        const label = f[side];
                        if (
                          !/^ที่ [12] สาย [A-Za-z]+$/.test(label) &&
                          label !== "ที่ 2 ดีที่สุด"
                        )
                          return null;
                        const field =
                          side === "home" ? "resolvedHome" : "resolvedAway";
                        const groupName = /^ที่ [12] สาย (.+)$/.exec(
                          label,
                        )?.[1];
                        const group = selected.groups?.find(
                          (g) => g.name === groupName,
                        );
                        return (
                          <label key={side}>
                            {label}
                            <select name={field} defaultValue={f[field] || ""}>
                              <option value="">
                                รอยืนยันโรงเรียนที่ผ่านเข้ารอบ
                              </option>
                              {schools
                                .filter((s) =>
                                  (group?.teams || selected.teams).includes(
                                    s.id,
                                  ),
                                )
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        );
                      })}
                      <label>
                        วันเวลา
                        <input
                          type="datetime-local"
                          name="startsAt"
                          defaultValue={f.startsAt}
                        />
                      </label>
                      <label>
                        สนาม
                        <input
                          name="venue"
                          defaultValue={f.venue}
                          maxLength={200}
                        />
                      </label>
                      <button disabled={disabled} type="submit">
                        บันทึกโปรแกรม
                      </button>
                    </form>
                  ))}
                </div>
              </>
            ))}
        </section>
      )}
      {panel === "csv" && (
        <section className="panel admin-csv-panel">
          <div className="admin-panel-heading">
            <h2>นำเข้าข้อมูล CSV</h2>
            <FileUp />
          </div>
          <p className="muted">
            ตรวจสอบข้อมูลก่อนยืนยัน
            รายชื่อทีมจะสร้างสายและโปรแกรมให้รายการที่ยังไม่มีโปรแกรม
            ตารางแข่งขันใช้แก้วันเวลาและสนามของคู่ที่จัดไว้แล้ว
          </p>
          <label>
            ประเภทข้อมูล
            <select
              value={csvKind}
              onChange={(e) => {
                setCsvKind(e.target.value);
                setPreview(null);
              }}
            >
              <option value="competitions">รายการแข่งขัน</option>
              <option value="teams">รายชื่อทีม</option>
              <option value="fixtures">ตารางแข่งขัน</option>
            </select>
          </label>
          <button type="button" onClick={template}>
            ดาวน์โหลดแม่แบบ CSV
          </button>
          <label>
            เลือกไฟล์ CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => inspect(e.target.files?.[0])}
            />
          </label>
          {preview && (
            <div className="admin-csv-preview">
              <h3>ตรวจสอบก่อนนำเข้า · {preview.length} รายการ</h3>
              <ol>
                {preview.map((action, index) => {
                  const competition = competitions.find(
                    (c) => c.id === action.id,
                  );
                  const created = action.competition as
                    CompetitionCsvRow | undefined;
                  return (
                    <li key={index}>
                      {created
                        ? `${created.name} · ${created.sport} · ${created.ageGroup} · ${created.gender}`
                        : action.action === "draw"
                          ? `${competition?.name} · ${(action.teams as string[]).map(schoolName).join(", ")}`
                          : `${competition?.name} · ${action.startsAt || "ยังไม่กำหนดเวลา"} · ${action.venue || "ยังไม่กำหนดสนาม"}`}
                    </li>
                  );
                })}
              </ol>
              <p>
                ข้อมูลจะบันทึกลงระบบจริงทีละรายการ หากพบข้อผิดพลาด
                รายการที่สำเร็จแล้วจะยังคงอยู่
              </p>
              <button
                type="button"
                onClick={() => setPreview(null)}
                disabled={disabled}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="primary"
                onClick={confirmImport}
                disabled={disabled}
              >
                ยืนยันนำเข้า
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
export default AdminCompetitionManager;
