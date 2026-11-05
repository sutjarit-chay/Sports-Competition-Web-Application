"use client";

import { useEffect, useState, type FormEvent } from "react";
import Papa from "papaparse";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Download,
  FileUp,
  GripVertical,
  Plus,
  Save,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import {
  parseCompetitionCsv,
  parseFixtureCsv,
  parseTeamCsv,
  generateFixtures,
  fixturesConflict,
  isManagedCompetition,
  type CompetitionCsvRow,
  type CompetitionFormat,
  type FixtureCsvRow,
  type ManagedCompetition,
  type ManagedFixture,
  type TeamCsvRow,
} from "@/lib/admin-competitions";
import { SPORTS } from "@/lib/domain";

const STORAGE_KEY = "kosamphi-admin-competitions-v1";
type Panel = "competitions" | "bracket" | "csv";
type CsvPreview =
  | { kind: "competitions"; rows: CompetitionCsvRow[] }
  | { kind: "teams"; rows: TeamCsvRow[] }
  | { kind: "fixtures"; rows: FixtureCsvRow[] };
type School = { id: string; name: string; short_name?: string };

function blankCompetition(): Omit<
  ManagedCompetition,
  "id" | "teams" | "fixtures"
> {
  return {
    name: "",
    sport: SPORTS[0],
    ageGroup: "ประถม",
    gender: "ชาย",
    details: "",
    starters: 7,
    reserves: 3,
    teamLimit: 10,
    format: "knockout",
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
  };
}

function schoolLabel(id: string, schools: School[]) {
  const school = schools.find((item) => item.id === id);
  return school?.short_name || school?.name || id;
}

function csvDownload(filename: string, rows: Record<string, string>[]) {
  const blob = new Blob(["\uFEFF" + Papa.unparse(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function AdminCompetitionManager({
  schools,
  hasFinishedResults,
  onChange,
}: {
  schools: School[];
  hasFinishedResults: (competitionId: string) => boolean;
  onChange: (competitions: ManagedCompetition[]) => void;
}) {
  const [competitions, setCompetitions] = useState<ManagedCompetition[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(blankCompetition);
  const [panel, setPanel] = useState<Panel>("competitions");
  const [slots, setSlots] = useState<string[]>(["", ""]);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [csvKind, setCsvKind] = useState<CsvPreview["kind"]>("competitions");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [loaded, setLoaded] = useState(false);
  const [storageValid, setStorageValid] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed) || !parsed.every(isManagedCompetition))
          throw Error("รูปแบบข้อมูลรายการแข่งขันในเบราว์เซอร์ไม่ถูกต้อง");
        setCompetitions(parsed);
      }
    } catch (error) {
      setStorageValid(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "อ่านข้อมูลรายการแข่งขันในเบราว์เซอร์ไม่สำเร็จ",
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded && storageValid) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(competitions));
        onChange(competitions);
      } catch {
        setStorageValid(false);
        setMessage("บันทึกข้อมูลในเบราว์เซอร์ไม่สำเร็จ พื้นที่จัดเก็บอาจเต็ม");
      }
    }
  }, [competitions, loaded, storageValid, onChange]);

  const selected = competitions.find(
    (competition) => competition.id === selectedId,
  );
  const assignedSlots = slots;

  function announce(text: string, kind: "error" | "success" = "error") {
    setMessage(text);
    setMessageKind(kind);
  }

  function editCompetition(competition: ManagedCompetition) {
    setSelectedId(competition.id);
    setDraft({
      name: competition.name,
      sport: competition.sport,
      ageGroup: competition.ageGroup,
      gender: competition.gender,
      details: competition.details,
      starters: competition.starters,
      reserves: competition.reserves,
      teamLimit: competition.teamLimit,
      format: competition.format,
      winPoints: competition.winPoints,
      drawPoints: competition.drawPoints,
      lossPoints: competition.lossPoints,
    });
    setSlots(
      Array.from(
        { length: Math.max(2, competition.teams.length) },
        (_, index) => competition.teams[index] || "",
      ),
    );
    setPanel("competitions");
  }

  function saveCompetition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const existing = competitions.find((item) => item.id === selectedId);
    if (
      existing &&
      hasFinishedResults(existing.id) &&
      (existing.sport !== draft.sport ||
        existing.ageGroup !== draft.ageGroup ||
        existing.gender !== draft.gender)
    ) {
      announce("รายการนี้มีผลยืนยันแล้ว จึงเปลี่ยนกีฬา รุ่น หรือเพศไม่ได้");
      return;
    }
    if (
      competitions.some(
        (item) =>
          item.id !== selectedId &&
          item.name === draft.name.trim() &&
          item.sport === draft.sport &&
          item.ageGroup === draft.ageGroup &&
          item.gender === draft.gender,
      )
    ) {
      announce("มีรายการชื่อและประเภทเดียวกันอยู่แล้ว");
      return;
    }
    if (
      existing &&
      existing.fixtures.length > 0 &&
      (existing.format !== draft.format ||
        existing.teamLimit !== draft.teamLimit ||
        existing.starters !== draft.starters ||
        existing.reserves !== draft.reserves) &&
      hasFinishedResults(existing.id)
    ) {
      announce("รายการนี้มีผลยืนยันแล้ว จึงห้ามเปลี่ยนรูปแบบหรือโควตา");
      return;
    }
    if (existing && existing.teams.length > draft.teamLimit) {
      announce(
        `มีทีมอยู่แล้ว ${existing.teams.length} ทีม ลดโควตาต่ำกว่านี้ไม่ได้`,
      );
      return;
    }
    if (
      existing &&
      existing.fixtures.length > 0 &&
      existing.format !== draft.format &&
      !window.confirm(
        "เปลี่ยนรูปแบบแล้วจะต้องจัดตารางใหม่ ต้องการดำเนินการต่อหรือไม่?",
      )
    )
      return;
    const next: ManagedCompetition = {
      ...draft,
      name: draft.name.trim(),
      details: draft.details.trim(),
      id: existing?.id || crypto.randomUUID(),
      teams: existing?.teams || [],
      fixtures:
        existing && existing.format === draft.format ? existing.fixtures : [],
    };
    setCompetitions((items) =>
      existing
        ? items.map((item) => (item.id === existing.id ? next : item))
        : [...items, next],
    );
    setSelectedId(next.id);
    announce("รายการแข่งขันบันทึกในเบราว์เซอร์แล้ว", "success");
  }

  function startNewCompetition() {
    setSelectedId("");
    setDraft(blankCompetition());
    setSlots(["", ""]);
    setPanel("competitions");
    setMessage("");
  }

  function clearCompetitionData() {
    if (competitions.length === 0) return;
    if (competitions.some((c) => hasFinishedResults(c.id))) {
      announce("มีรายการที่ยืนยันผลแล้ว จึงไม่สามารถล้างโปรแกรมทั้งหมดได้");
      return;
    }
    const confirmed = window.confirm(
      "ล้างรายการแข่งขัน ทีม และตารางทั้งหมดในต้นแบบนี้หรือไม่? ข้อมูลสาธิตส่วนอื่นและ Supabase จะไม่ถูกลบ",
    );
    if (!confirmed) return;
    try {
      localStorage.setItem(STORAGE_KEY, "[]");
      setCompetitions([]);
      setSelectedId("");
      setDraft(blankCompetition());
      setSlots(["", ""]);
      setPreview(null);
      announce("ล้างรายการแข่งขัน ทีม และตารางในต้นแบบนี้แล้ว", "success");
    } catch {
      announce("ล้างข้อมูลไม่สำเร็จ ไม่ได้เปลี่ยนข้อมูลในหน้าจอ");
    }
  }

  function chooseCompetition(id: string) {
    const competition = competitions.find((item) => item.id === id);
    if (!competition) return;
    setSelectedId(id);
    setSlots(
      Array.from(
        { length: Math.max(2, competition.teams.length) },
        (_, index) => competition.teams[index] || "",
      ),
    );
  }

  function updateSlot(index: number, schoolId: string) {
    setSlots((current) =>
      current.map((slot, i) => (i === index ? schoolId : slot)),
    );
  }

  function moveSlot(from: number, to: number) {
    setSlots((current) => {
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  function createFixtures() {
    if (!selected) {
      announce("เลือกรายการแข่งขันก่อนจัดสาย");
      return;
    }
    const teamIds = assignedSlots.filter(Boolean);
    if (teamIds.length < 2) {
      announce("เลือกอย่างน้อย 2 โรงเรียนเพื่อจัดสาย");
      return;
    }
    if (new Set(teamIds).size !== teamIds.length) {
      announce("ไม่สามารถเลือกโรงเรียนซ้ำในรายการเดียวกัน");
      return;
    }
    if (teamIds.length > selected.teamLimit) {
      announce(`รายการนี้รับได้สูงสุด ${selected.teamLimit} ทีม`);
      return;
    }
    if (hasFinishedResults(selected.id)) {
      announce("รายการนี้มีผลยืนยันแล้ว จึงไม่สามารถสร้างตารางทับได้");
      return;
    }
    if (
      selected.fixtures.length &&
      !window.confirm(
        "การสร้างใหม่จะแทนที่ตารางตัวอย่างเดิมของรายการนี้ ดำเนินการต่อหรือไม่?",
      )
    )
      return;
    const fixtures = generateFixtures(selected.format, teamIds);
    setCompetitions((items) =>
      items.map((item) =>
        item.id === selected.id ? { ...item, teams: teamIds, fixtures } : item,
      ),
    );
    announce("จัดสายและสร้างโปรแกรมตัวอย่างแล้ว", "success");
  }

  function updateFixture(
    competitionId: string,
    fixtureId: string,
    field: "startsAt" | "venue",
    value: string,
  ) {
    const competition = competitions.find((item) => item.id === competitionId);
    const fixture = competition?.fixtures.find((item) => item.id === fixtureId);
    if (!competition || !fixture) return;
    const updated = { ...fixture, [field]: value };
    if (
      competitions
        .flatMap((c) => c.fixtures)
        .some(
          (other) => other.id !== fixtureId && fixturesConflict(updated, other),
        )
    ) {
      announce("เวลานี้มีทีมแข่งซ้อนหรือสนามถูกใช้งานแล้ว");
      return;
    }
    setCompetitions((items) =>
      items.map((competition) =>
        competition.id === competitionId
          ? {
              ...competition,
              fixtures: competition.fixtures.map((fixture) =>
                fixture.id === fixtureId
                  ? { ...fixture, [field]: value }
                  : fixture,
              ),
            }
          : competition,
      ),
    );
  }

  async function inspectCsv(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      announce("ไฟล์ CSV ต้องมีขนาดไม่เกิน 2 MB");
      return;
    }
    try {
      const csv = await file.text();
      const nextPreview: CsvPreview =
        csvKind === "competitions"
          ? { kind: "competitions", rows: parseCompetitionCsv(csv) }
          : csvKind === "teams"
            ? {
                kind: "teams",
                rows: parseTeamCsv(csv, competitions, schools),
              }
            : {
                kind: "fixtures",
                rows: parseFixtureCsv(csv, competitions, schools),
              };
      setPreview(nextPreview);
      announce(
        `ตรวจพบข้อมูล ${nextPreview.rows.length} แถว ตรวจตัวอย่างก่อนยืนยัน`,
        "success",
      );
    } catch (error) {
      setPreview(null);
      announce(
        error instanceof Error ? error.message : "อ่านไฟล์ CSV ไม่สำเร็จ",
      );
    }
  }

  function confirmImport() {
    if (!preview) return;
    if (preview.kind === "competitions") {
      const duplicates = preview.rows.find((row) =>
        competitions.some(
          (existing) =>
            existing.name === row.name &&
            existing.sport === row.sport &&
            existing.ageGroup === row.ageGroup &&
            existing.gender === row.gender,
        ),
      );
      if (duplicates) {
        announce(
          `รายการ "${duplicates.name}" มีอยู่แล้ว ยกเลิกการนำเข้าทั้งชุด`,
        );
        return;
      }
      setCompetitions((current) => [
        ...current,
        ...preview.rows.map((row) => ({
          ...row,
          id: crypto.randomUUID(),
          teams: [],
          fixtures: [],
        })),
      ]);
    } else if (preview.kind === "teams") {
      const grouped = new Map<string, string[]>();
      for (const row of preview.rows) {
        const list = grouped.get(row.competition) || [];
        list.push(row.school);
        grouped.set(row.competition, list);
      }
      const overflow = [...grouped].find(([id, ids]) => {
        const competition = competitions.find((item) => item.id === id)!;
        return competition.teams.length + ids.length > competition.teamLimit;
      });
      if (overflow) {
        announce(
          `รายการ "${competitions.find((item) => item.id === overflow[0])?.name}" มีทีมเกินโควตา ยกเลิกทั้งชุด`,
        );
        return;
      }
      setCompetitions((items) =>
        items.map((competition) => ({
          ...competition,
          teams: [...competition.teams, ...(grouped.get(competition.id) || [])],
        })),
      );
    } else {
      const conflict = preview.rows.find((row) => {
        const competition = competitions.find(
          (item) => item.id === row.competition,
        );
        return (
          competitions
            .flatMap((c) => c.fixtures)
            .some((fixture) => fixturesConflict(row, fixture)) ||
          hasFinishedResults(row.competition)
        );
      });
      if (conflict) {
        announce(
          `รายการ "${competitions.find((item) => item.id === conflict.competition)?.name}" มีคู่ซ้ำหรือมีผลยืนยันแล้ว ยกเลิกการนำเข้าทั้งชุด`,
        );
        return;
      }
      const grouped = new Map<string, ManagedFixture[]>();
      for (const row of preview.rows) {
        const list = grouped.get(row.competition) || [];
        const fixture = {
          id: crypto.randomUUID(),
          round: row.round,
          home: row.home,
          away: row.away,
          startsAt: row.startsAt,
          venue: row.venue,
        };
        if (
          [...grouped.values()]
            .flat()
            .some((item) => fixturesConflict(fixture, item))
        ) {
          announce(
            "ไฟล์มีทีมแข่งซ้อนหรือใช้สนามเดียวกันในเวลาเดียวกัน ยกเลิกทั้งชุด",
          );
          return;
        }
        list.push(fixture);
        grouped.set(row.competition, list);
      }
      setCompetitions((items) =>
        items.map((competition) => {
          const fixtures = grouped.get(competition.id);
          return fixtures
            ? {
                ...competition,
                fixtures: [...competition.fixtures, ...fixtures],
              }
            : competition;
        }),
      );
    }
    setPreview(null);
    announce("นำเข้าข้อมูลตัวอย่างในเบราว์เซอร์แล้ว", "success");
  }

  function downloadTemplate(kind: CsvPreview["kind"]) {
    if (kind === "competitions") {
      csvDownload("competitions-template.csv", [
        {
          name: "ฟุตบอล 7 คน ตัวอย่าง",
          sport: "ฟุตบอล",
          age_group: "ประถม",
          gender: "ชาย",
          details: "ตัวอย่างกติกาและรายละเอียดการแข่งขัน",
          starters: "7",
          reserves: "3",
          team_limit: "10",
          format: "knockout",
          win_points: "3",
          draw_points: "1",
          loss_points: "0",
        },
      ]);
    } else if (kind === "teams") {
      const competition = competitions.find((item) =>
        schools.some((school) => !item.teams.includes(school.id)),
      );
      const school = competition
        ? schools.find((item) => !competition.teams.includes(item.id))
        : undefined;
      csvDownload(
        "competition-teams-template.csv",
        competition && school
          ? [
              {
                competition_name: competition.name,
                school_name: school.name,
              },
            ]
          : [{ competition_name: "", school_name: "" }],
      );
    } else {
      const competition = competitions.find((item) => item.teams.length > 1);
      const home = competition
        ? schools.find((school) => school.id === competition.teams[0])
        : undefined;
      const away = competition
        ? schools.find((school) => school.id === competition.teams[1])
        : undefined;
      csvDownload(
        "competition-fixtures-template.csv",
        competition && home && away
          ? [
              {
                competition_name: competition.name,
                round: "รอบ 1",
                home_school: home.name,
                away_school: away.name,
                starts_at: "2026-11-20T09:00",
                venue: "สนาม 1",
              },
            ]
          : [
              {
                competition_name: "",
                round: "",
                home_school: "",
                away_school: "",
                starts_at: "",
                venue: "",
              },
            ],
      );
    }
  }

  function previewRows() {
    if (!preview) return [];
    if (preview.kind === "competitions")
      return preview.rows.map((row) => [
        row.name,
        row.sport,
        `${row.ageGroup} / ${row.gender}`,
        `${row.starters} ตัวจริง + ${row.reserves} สำรอง`,
        row.format === "knockout" ? "คัดออก" : "พบกันหมด",
      ]);
    if (preview.kind === "teams")
      return preview.rows.map((row) => [
        competitions.find((item) => item.id === row.competition)?.name || "",
        schoolLabel(row.school, schools),
      ]);
    return preview.rows.map((row) => [
      competitions.find((item) => item.id === row.competition)?.name || "",
      row.round,
      schoolLabel(row.home, schools),
      schoolLabel(row.away, schools),
      row.startsAt || "ไม่ระบุ",
      row.venue || "ไม่ระบุ",
    ]);
  }

  return (
    <div className="admin-manager">
      <div className="admin-preview-notice" role="note">
        หน้าต้นแบบสำหรับตรวจโครงสร้าง ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น
        ยังไม่เชื่อม Supabase และไม่แก้ไขผลการแข่งขันจริง
      </div>
      <div
        className="admin-manager-tabs"
        role="tablist"
        aria-label="จัดการรายการแข่งขัน"
      >
        {[
          ["competitions", "รายการแข่งขัน"],
          ["bracket", "จัดสายแข่งขัน"],
          ["csv", "นำเข้า CSV"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={panel === value}
            className={panel === value ? "active" : ""}
            onClick={() => setPanel(value as Panel)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p className={`admin-manager-message ${messageKind}`} role="status">
          {message}
        </p>
      )}

      {panel === "competitions" && (
        <div className="admin-manager-grid">
          <section className="panel">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">COMPETITION CATALOG</p>
                <h2>รายการแข่งขัน</h2>
              </div>
              <div className="admin-competition-actions">
                <button
                  type="button"
                  className="admin-clear-button"
                  onClick={clearCompetitionData}
                  disabled={competitions.length === 0}
                >
                  <Trash2 aria-hidden="true" /> ล้างข้อมูล
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={startNewCompetition}
                >
                  <Plus aria-hidden="true" /> เพิ่มรายการ
                </button>
              </div>
            </div>
            <div className="admin-competition-list">
              {competitions.map((competition) => (
                <article
                  className="admin-competition-card"
                  key={competition.id}
                >
                  <div>
                    <strong>{competition.name}</strong>
                    <small>
                      {competition.sport} · {competition.ageGroup} ·{" "}
                      {competition.gender}
                    </small>
                    <small>
                      {competition.teams.length}/{competition.teamLimit} ทีม ·{" "}
                      {competition.format === "knockout"
                        ? "คัดออก"
                        : "พบกันหมด"}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="ui-button-outline"
                    onClick={() => editCompetition(competition)}
                  >
                    แก้ไข
                  </button>
                </article>
              ))}
              {competitions.length === 0 && (
                <p className="muted">
                  ยังไม่มีรายการ เพิ่มรายการใหม่หรือนำเข้า CSV
                </p>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">
                  {selectedId ? "EDIT DETAILS" : "NEW COMPETITION"}
                </p>
                <h2>{selectedId ? "แก้ไขรายการ" : "สร้างรายการแข่งขัน"}</h2>
              </div>
            </div>
            <form className="admin-competition-form" onSubmit={saveCompetition}>
              <label>
                ชื่อการแข่งขัน
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <div className="admin-form-row">
                <label>
                  ชนิดกีฬา
                  <select
                    value={draft.sport}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sport: event.target.value,
                      }))
                    }
                  >
                    {SPORTS.map((sport) => (
                      <option key={sport}>{sport}</option>
                    ))}
                  </select>
                </label>
                <label>
                  ระดับ
                  <select
                    value={draft.ageGroup}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ageGroup: event.target.value,
                      }))
                    }
                  >
                    {["ประถม", "ขยายโอกาส", "อนุบาล"].map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </label>
                <label>
                  เพศ
                  <select
                    value={draft.gender}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        gender: event.target.value,
                      }))
                    }
                  >
                    {["ชาย", "หญิง", "ผสม"].map((gender) => (
                      <option key={gender}>{gender}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                รายละเอียด / กติกา
                <textarea
                  rows={3}
                  value={draft.details}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      details: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="admin-form-row admin-quota-row">
                <label>
                  ตัวจริง
                  <input
                    type="number"
                    min="1"
                    value={draft.starters}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        starters: Number(event.target.value),
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  สำรอง
                  <input
                    type="number"
                    min="0"
                    value={draft.reserves}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        reserves: Number(event.target.value),
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  ทีมสูงสุด
                  <input
                    type="number"
                    min="2"
                    value={draft.teamLimit}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        teamLimit: Number(event.target.value),
                      }))
                    }
                    required
                  />
                </label>
              </div>
              <fieldset className="admin-format-fieldset">
                <legend>รูปแบบการแข่งขัน</legend>
                <label className="admin-radio-card">
                  <input
                    type="radio"
                    name="competition-format"
                    checked={draft.format === "knockout"}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        format: "knockout",
                      }))
                    }
                  />
                  <Trophy aria-hidden="true" />
                  <span>
                    <strong>คัดออก</strong>
                    <small>แพ้แล้วออก จัดสายไปจนถึงรอบชิง</small>
                  </span>
                </label>
                <label className="admin-radio-card">
                  <input
                    type="radio"
                    name="competition-format"
                    checked={draft.format === "round_robin"}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        format: "round_robin",
                      }))
                    }
                  />
                  <Users aria-hidden="true" />
                  <span>
                    <strong>พบกันหมด</strong>
                    <small>ทุกทีมพบกัน พร้อมเกณฑ์คะแนนชนะ/เสมอ/แพ้</small>
                  </span>
                </label>
              </fieldset>
              <div className="admin-form-row admin-points-row">
                {(
                  [
                    ["winPoints", "คะแนนชนะ"],
                    ["drawPoints", "คะแนนเสมอ"],
                    ["lossPoints", "คะแนนแพ้"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      value={draft[field]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [field]: Number(event.target.value),
                        }))
                      }
                      required
                    />
                  </label>
                ))}
              </div>
              <button className="primary" type="submit">
                <Save aria-hidden="true" /> บันทึกรายการ
              </button>
            </form>
          </section>
        </div>
      )}

      {panel === "bracket" && (
        <section className="panel admin-bracket-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">DRAW & SCHEDULE</p>
              <h2>จัดสายแข่งขัน</h2>
              <p className="muted">
                จัดทีมด้วยการลากวางหรือเลือกโรงเรียนในแต่ละช่อง
                จากนั้นตรวจโปรแกรมก่อนบันทึก
              </p>
            </div>
            <CalendarDays aria-hidden="true" />
          </div>
          <label className="admin-select-competition">
            เลือกรายการแข่งขัน
            <select
              value={selectedId}
              onChange={(event) => chooseCompetition(event.target.value)}
            >
              <option value="">เลือกรายการ</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <>
              <div className="admin-draw-info">
                <strong>{selected.name}</strong>
                <span>
                  {selected.format === "knockout" ? "คัดออก" : "พบกันหมด"} ·{" "}
                  รับสูงสุด {selected.teamLimit} ทีม
                </span>
              </div>
              {schools.length === 0 ? (
                <p className="notice">
                  ยังไม่มีโรงเรียนในข้อมูลสาธิต
                  เพิ่ม/นำเข้าโรงเรียนก่อนจึงจะจัดทีมได้
                </p>
              ) : (
                <>
                  <label className="admin-slot-count">
                    จำนวนทีมที่จะจัดสาย
                    <input
                      type="number"
                      min="2"
                      max={Math.min(selected.teamLimit, schools.length)}
                      value={slots.length}
                      onChange={(event) => {
                        const length = Math.max(2, Number(event.target.value));
                        setSlots((current) =>
                          Array.from(
                            { length },
                            (_, index) => current[index] || "",
                          ),
                        );
                      }}
                    />
                  </label>
                  <div className="admin-available-schools">
                    <strong>ลากโรงเรียนมาวางในช่องทีม</strong>
                    <div>
                      {schools
                        .filter((school) => !assignedSlots.includes(school.id))
                        .map((school) => (
                          <button
                            key={school.id}
                            type="button"
                            draggable
                            onDragStart={(event) =>
                              event.dataTransfer.setData(
                                "application/x-school-id",
                                school.id,
                              )
                            }
                          >
                            <GripVertical aria-hidden="true" />
                            {schoolLabel(school.id, schools)}
                          </button>
                        ))}
                    </div>
                  </div>
                  <div className="admin-team-slots">
                    {assignedSlots.map((schoolId, index) => (
                      <div
                        key={index}
                        className="admin-team-slot"
                        draggable={!!schoolId}
                        onDragStart={(event) =>
                          event.dataTransfer.setData(
                            "text/plain",
                            String(index),
                          )
                        }
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const schoolId = event.dataTransfer.getData(
                            "application/x-school-id",
                          );
                          if (schoolId) {
                            updateSlot(index, schoolId);
                            return;
                          }
                          const from = Number(
                            event.dataTransfer.getData("text/plain"),
                          );
                          if (Number.isInteger(from)) moveSlot(from, index);
                        }}
                      >
                        <GripVertical aria-hidden="true" />
                        <span>ทีม {index + 1}</span>
                        <select
                          aria-label={`ทีม ${index + 1}`}
                          value={schoolId}
                          onChange={(event) =>
                            updateSlot(index, event.target.value)
                          }
                        >
                          <option value="">เลือกโรงเรียน</option>
                          {schools
                            .filter(
                              (school) =>
                                !assignedSlots.includes(school.id) ||
                                school.id === schoolId,
                            )
                            .map((school) => (
                              <option key={school.id} value={school.id}>
                                {schoolLabel(school.id, schools)}
                              </option>
                            ))}
                        </select>
                        <div className="admin-slot-move">
                          <button
                            type="button"
                            aria-label={`เลื่อนทีม ${index + 1} ขึ้น`}
                            disabled={index === 0}
                            onClick={() => moveSlot(index, index - 1)}
                          >
                            <ArrowUp aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={`เลื่อนทีม ${index + 1} ลง`}
                            disabled={index === assignedSlots.length - 1}
                            onClick={() => moveSlot(index, index + 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="primary"
                    onClick={createFixtures}
                  >
                    <Trophy aria-hidden="true" /> สร้างตัวอย่างสายและโปรแกรม
                  </button>
                </>
              )}
              {selected.fixtures.length > 0 && (
                <div className="admin-fixture-list">
                  <h3>ตัวอย่างโปรแกรมแข่งขัน</h3>
                  {selected.fixtures.map((fixture) => (
                    <div className="admin-fixture-row" key={fixture.id}>
                      <strong>{fixture.round}</strong>
                      <span>
                        {schoolLabel(fixture.home, schools)} <b>พบ</b>{" "}
                        {schoolLabel(fixture.away, schools)}
                      </span>
                      <label>
                        วันเวลา
                        <input
                          type="datetime-local"
                          value={fixture.startsAt}
                          onChange={(event) =>
                            updateFixture(
                              selected.id,
                              fixture.id,
                              "startsAt",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label>
                        สนาม
                        <input
                          value={fixture.venue}
                          onChange={(event) =>
                            updateFixture(
                              selected.id,
                              fixture.id,
                              "venue",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted">สร้างหรือเลือกการแข่งขันก่อนจัดสาย</p>
          )}
        </section>
      )}

      {panel === "csv" && (
        <section className="panel admin-csv-panel">
          <div className="admin-panel-heading">
            <div>
              <p className="eyebrow">BULK DATA TOOLS</p>
              <h2>นำเข้าข้อมูล CSV</h2>
              <p className="muted">
                ดาวน์โหลดไฟล์ตัวอย่าง แก้ไข
                แล้วนำเข้าเพื่อดูตัวอย่างและตรวจข้อผิดพลาดก่อนยืนยัน
              </p>
              <p className="muted">
                CSV รายการแข่งขันมีแถวตัวอย่าง
                โปรดแก้ไขหรือลบแถวนี้ก่อนนำเข้าจริง
              </p>
            </div>
            <FileUp aria-hidden="true" />
          </div>
          <div className="admin-csv-actions">
            {(
              [
                ["competitions", "รายการแข่งขัน"],
                ["teams", "รายชื่อทีม"],
                ["fixtures", "ตารางแข่งขัน"],
              ] as const
            ).map(([kind, label]) => (
              <div className="admin-csv-action" key={kind}>
                <strong>{label}</strong>
                <button type="button" onClick={() => downloadTemplate(kind)}>
                  <Download aria-hidden="true" /> ดาวน์โหลดตัวอย่าง CSV
                </button>
              </div>
            ))}
          </div>
          <div className="admin-import-control">
            <label>
              ประเภทข้อมูล
              <select
                value={csvKind}
                onChange={(event) => {
                  setCsvKind(event.target.value as CsvPreview["kind"]);
                  setPreview(null);
                }}
              >
                <option value="competitions">รายการแข่งขัน</option>
                <option value="teams">รายชื่อทีม</option>
                <option value="fixtures">ตารางแข่งขัน</option>
              </select>
            </label>
            <label>
              เลือกไฟล์ CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => inspectCsv(event.target.files?.[0])}
              />
            </label>
          </div>
          {preview && (
            <div className="admin-csv-preview">
              <h3>ตรวจสอบก่อนนำเข้า · {preview.rows.length} แถว</h3>
              <div className="admin-csv-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {(preview.kind === "competitions"
                        ? ["ชื่อ", "กีฬา", "รุ่น / เพศ", "โควตา", "รูปแบบ"]
                        : preview.kind === "teams"
                          ? ["รายการ", "โรงเรียน"]
                          : [
                              "รายการ",
                              "รอบ",
                              "ทีม A",
                              "ทีม B",
                              "วันเวลา",
                              "สนาม",
                            ]
                      ).map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows().map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-import-confirm">
                <p>
                  ข้อมูลที่ยืนยันจะบันทึกในเบราว์เซอร์นี้เท่านั้น
                  และจะไม่เขียนทับผลการแข่งขันเดิม
                </p>
                <button type="button" onClick={() => setPreview(null)}>
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={confirmImport}
                >
                  ยืนยันนำเข้า
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
