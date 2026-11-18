"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  UserPlus,
  Trophy,
  RotateCcw,
  Search,
  Check,
  ArrowRight,
  Medal,
} from "lucide-react";

export type LaneEntry = {
  lane: number;
  bib: string;
  athleteName: string;
  schoolName: string;
  rank?: string; // "1", "2", "3", etc.
};

export type AthleticsRow = {
  id: number;
  no: string;
  sourceNumber?: number;
  name: string;
  grade: string;
  type: string;
  r1: string[]; // 5 lanes (display text)
  r2: string[]; // 5 lanes
  r3: string[]; // 6 lanes (finals)
  r1Lanes: LaneEntry[];
  r2Lanes: LaneEntry[];
  r3Lanes: LaneEntry[];
  winners?: {
    rank: number;
    athleteName: string;
    schoolName: string;
    score: number;
    note: string;
  }[];
};

function defaultLanes(count: number): LaneEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    lane: i + 1,
    bib: "",
    athleteName: "",
    schoolName: "",
    rank: "",
  }));
}

export const INITIAL_ATHLETICS_DATA: AthleticsRow[] = [
  { id: 1, no: "๑", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 2, no: "๒", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 3, no: "๓", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 4, no: "๔", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 5, no: "๕", sourceNumber: 106, name: "วิ่ง ๕๐ เมตร", grade: "อนุบาล", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 6, no: "๖", sourceNumber: 107, name: "วิ่ง ๕๐ เมตร", grade: "อนุบาล", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 7, no: "๗", sourceNumber: 112, name: "วิ่ง ๘๐ เมตร", grade: "อนุบาล", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 8, no: "๘", sourceNumber: 113, name: "วิ่ง ๘๐ เมตร", grade: "อนุบาล", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 9, no: "๙", sourceNumber: 118, name: "วิ่ง ๖๐ เมตร", grade: "ป.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 10, no: "๑๐", sourceNumber: 119, name: "วิ่ง ๖๐ เมตร", grade: "ป.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 11, no: "๑๑", sourceNumber: 124, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 12, no: "๑๒", sourceNumber: 125, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 13, no: "๑๓", sourceNumber: 130, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๔-๖", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 14, no: "๑๔", sourceNumber: 131, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๔-๖", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 15, no: "๑๕", sourceNumber: 132, name: "วิ่ง ๑๐๐ เมตร", grade: "ม.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 16, no: "๑๖", sourceNumber: 133, name: "วิ่ง ๑๐๐ เมตร", grade: "ม.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 17, no: "๑๗", sourceNumber: 138, name: "วิ่ง ๒๐๐ เมตร", grade: "ป.๔-๖", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 18, no: "๑๘", sourceNumber: 139, name: "วิ่ง ๒๐๐ เมตร", grade: "ป.๔-๖", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 19, no: "๑๙", sourceNumber: 140, name: "วิ่ง ๒๐๐ เมตร", grade: "ม.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 20, no: "๒๐", sourceNumber: 141, name: "วิ่ง ๒๐๐ เมตร", grade: "ม.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
];

export function AthleticsScoresheet({
  schools = [],
}: {
  schools?: { id: string; name: string }[];
}) {
  const [subTab, setSubTab] = useState<"sheet" | "summary">("sheet");
  const [rows, setRows] = useState<AthleticsRow[]>(INITIAL_ATHLETICS_DATA);
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<AthleticsRow | null>(null);
  const [modalRound, setModalRound] = useState<"r1" | "r2" | "r3">("r1");
  const [toast, setToast] = useState<string | null>(null);

  // Load from local storage preview
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nkg2569_athletics_preview");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure lane structures exist
        const updated = parsed.map((item: AthleticsRow) => ({
          ...item,
          r1Lanes: item.r1Lanes || defaultLanes(5),
          r2Lanes: item.r2Lanes || defaultLanes(5),
          r3Lanes: item.r3Lanes || defaultLanes(6),
        }));
        setRows(updated);
      }
    } catch {}
  }, []);

  function saveRows(next: AthleticsRow[], msg?: string) {
    setRows(next);
    try {
      localStorage.setItem("nkg2569_athletics_preview", JSON.stringify(next));
    } catch {}
    if (msg) {
      setToast(msg);
      setTimeout(() => setToast(null), 2500);
    }
  }

  // Handle direct inline cell edit on the main sheet
  function handleCellChange(
    rowId: number,
    roundKey: "r1" | "r2" | "r3",
    subIndex: number,
    value: string,
  ) {
    const next = rows.map((r) => {
      if (r.id !== rowId) return r;
      const round = [...r[roundKey]];
      round[subIndex] = value;
      // Also update the bib in the lane entry
      const lanesKey =
        roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
      const updatedLanes = [...r[lanesKey]];
      if (updatedLanes[subIndex]) {
        updatedLanes[subIndex] = { ...updatedLanes[subIndex], bib: value };
      }
      return { ...r, [roundKey]: round, [lanesKey]: updatedLanes };
    });
    saveRows(next);
  }

  function handleReset() {
    if (confirm("ต้องการคืนค่าเริ่มต้นของตารางกรีฑาใช่หรือไม่?")) {
      saveRows(INITIAL_ATHLETICS_DATA, "คืนค่าข้อมูลเริ่มต้นเรียบร้อย");
    }
  }

  // Filter rows
  const filteredRows = rows.filter(
    (r) =>
      r.name.includes(search) ||
      r.grade.includes(search) ||
      r.type.includes(search) ||
      r.no.includes(search) ||
      (r.sourceNumber && String(r.sourceNumber).includes(search)),
  );

  // Aggregate school scores for summary report
  const schoolScoreMap: Record<string, number> = {};
  rows.forEach((r) => {
    (r.winners || []).forEach((w) => {
      if (w.schoolName) {
        schoolScoreMap[w.schoolName] =
          (schoolScoreMap[w.schoolName] || 0) + (w.score || 0);
      }
    });
  });

  const rankedSchools = Object.entries(schoolScoreMap)
    .map(([schoolName, totalScore]) => ({
      schoolName,
      totalScore,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  // Helper inside modal to update lane data
  function updateModalLane(
    roundKey: "r1" | "r2" | "r3",
    index: number,
    field: keyof LaneEntry,
    val: string,
  ) {
    if (!selectedRow) return;
    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const lanes = [...selectedRow[lanesKey]];
    lanes[index] = { ...lanes[index], [field]: val };

    // Sync BIB to main display cell
    const roundCells = [...selectedRow[roundKey]];
    if (field === "bib") {
      roundCells[index] = val;
    }

    // If in finals (r3) and rank is assigned (1, 2, or 3), update winners automatically
    let winners = selectedRow.winners ? [...selectedRow.winners] : [];
    if (roundKey === "r3") {
      winners = [1, 2, 3].map((rankNum) => {
        const matchingLane = lanes.find(
          (l) => l.rank === String(rankNum) || l.rank === `ที่ ${rankNum}`,
        );
        return {
          rank: rankNum,
          athleteName: matchingLane?.athleteName || "",
          schoolName: matchingLane?.schoolName || "",
          score: rankNum === 1 ? 3 : rankNum === 2 ? 2 : 1,
          note: matchingLane?.bib ? `BIB ${matchingLane.bib}` : "",
        };
      });
    }

    setSelectedRow({
      ...selectedRow,
      [lanesKey]: lanes,
      [roundKey]: roundCells,
      winners: roundKey === "r3" ? winners : selectedRow.winners,
    });
  }

  // Advance qualifiers from current round to next round
  function advanceQualifiers(sourceRound: "r1" | "r2", targetRound: "r2" | "r3") {
    if (!selectedRow) return;
    const sourceLanes =
      sourceRound === "r1" ? selectedRow.r1Lanes : selectedRow.r2Lanes;
    const targetLanesKey = targetRound === "r2" ? "r2Lanes" : "r3Lanes";
    const targetCells = [...selectedRow[targetRound]];
    const nextTargetLanes = [...selectedRow[targetLanesKey]];

    // Find top 3 (ranks "1", "2", "3")
    const qualifiers = sourceLanes
      .filter((l) => ["1", "2", "3", "ที่ 1", "ที่ 2", "ที่ 3"].includes(l.rank || ""))
      .sort((a, b) => (parseInt(a.rank || "99") || 99) - (parseInt(b.rank || "99") || 99));

    if (qualifiers.length === 0) {
      alert("กรุณาระบุอันดับที่เข้าเส้นชัย (1, 2, 3) ในลู่วิ่งก่อนส่งไปรอบถัดไป");
      return;
    }

    qualifiers.forEach((q, idx) => {
      if (idx < nextTargetLanes.length) {
        nextTargetLanes[idx] = {
          ...nextTargetLanes[idx],
          bib: q.bib,
          athleteName: q.athleteName,
          schoolName: q.schoolName,
          rank: "",
        };
        targetCells[idx] = q.bib || q.athleteName || q.schoolName;
      }
    });

    setSelectedRow({
      ...selectedRow,
      [targetLanesKey]: nextTargetLanes,
      [targetRound]: targetCells,
    });
    setModalRound(targetRound);
    setToast(`ส่งผู้เข้ารอบเข้าสู่${targetRound === "r2" ? "รอบ ๒" : "รอบชิงชนะเลิศ"}เรียบร้อย`);
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="athletics-container" style={{ marginTop: "1rem" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#1e293b",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 9999,
            fontSize: "14px",
          }}
        >
          {toast}
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div
        className="athletics-subtabs"
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          borderBottom: "2px solid #e2e8f0",
          paddingBottom: "8px",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={subTab === "sheet" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("sheet")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            📋 ใบบันทึกผลการแข่งขันกรีฑา
          </button>
          <button
            type="button"
            className={subTab === "summary" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("summary")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Trophy size={16} /> สรุปผลและคะแนนกรีฑา
          </button>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {subTab === "summary" && (
            <button
              type="button"
              className="ui-button-outline ui-button-sm"
              onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Printer size={15} /> พิมพ์รายงาน (A4 / PDF)
            </button>
          )}
          <button
            type="button"
            className="ui-button-outline ui-button-sm"
            onClick={handleReset}
            title="คืนค่าข้อมูลตัวอย่าง"
          >
            <RotateCcw size={14} /> คืนค่าเริ่มต้น
          </button>
        </div>
      </div>

      {/* ======================= TAB 1: SCORESHEET ======================= */}
      {subTab === "sheet" && (
        <section className="panel" aria-label="ตารางบันทึกการแข่งขันกรีฑา">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                ตารางบันทึกการแข่งขันกรีฑา (รอบ ๑, รอบ ๒, รอบชิงชนะเลิศ)
              </h2>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                คลิกปุ่ม <strong>"ลงทะเบียน/จัดลู่"</strong> เพื่อระบุรายชื่อนักกีฬา โรงเรียน และลู่วิ่ง
                หรือพิมพ์หมายเลขประจำตัวนักกีฬา (BIB) ลงในช่องได้ทันที
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Search
                  size={15}
                  style={{
                    position: "absolute",
                    left: "10px",
                    color: "#94a3b8",
                  }}
                />
                <input
                  type="text"
                  placeholder="ค้นหารายการ, ชั้น, เพศ..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    paddingLeft: "32px",
                    paddingTop: "6px",
                    paddingBottom: "6px",
                    fontSize: "13px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            className="table-scroll"
            style={{
              overflowX: "auto",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "center",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ background: "#1e293b", color: "#fff" }}>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px 6px",
                      border: "1px solid #334155",
                      width: "60px",
                    }}
                  >
                    รายการที่
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px",
                      border: "1px solid #334155",
                      textAlign: "left",
                      minWidth: "160px",
                    }}
                  >
                    รายการแข่งขัน
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px",
                      border: "1px solid #334155",
                      width: "70px",
                    }}
                  >
                    ชั้น
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px",
                      border: "1px solid #334155",
                      width: "60px",
                    }}
                  >
                    ประเภท
                  </th>
                  <th
                    colSpan={5}
                    style={{
                      padding: "6px",
                      border: "1px solid #334155",
                      background: "#334155",
                    }}
                  >
                    รอบ ๑ (๕ ลู่)
                  </th>
                  <th
                    colSpan={5}
                    style={{
                      padding: "6px",
                      border: "1px solid #334155",
                      background: "#334155",
                    }}
                  >
                    รอบ ๒ (๕ ลู่)
                  </th>
                  <th
                    colSpan={6}
                    style={{
                      padding: "6px",
                      border: "1px solid #334155",
                      background: "#0f766e",
                      color: "#fef08a",
                    }}
                  >
                    รอบชิงชนะเลิศ (๖ ลู่)
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px",
                      border: "1px solid #334155",
                      width: "130px",
                    }}
                  >
                    ลงทะเบียน/จัดลู่
                  </th>
                </tr>
                <tr style={{ background: "#475569", color: "#fff", fontSize: "12px" }}>
                  {/* รอบ 1 */}
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๑</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๒</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๓</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๔</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๕</th>
                  {/* รอบ 2 */}
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๑</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๒</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๓</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๔</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", width: "32px" }}>๕</th>
                  {/* รอบชิง */}
                  <th style={{ padding: "4px", border: "1px solid #0f766e", width: "32px" }}>๑</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", width: "32px" }}>๒</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", width: "32px" }}>๓</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", width: "32px" }}>๔</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", width: "32px" }}>๕</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", width: "32px" }}>๖</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: item.id % 2 === 0 ? "#f8fafc" : "#fff",
                    }}
                  >
                    <td
                      style={{
                        padding: "6px",
                        fontWeight: 600,
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {item.no}
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "left",
                        fontWeight: 500,
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {item.name}
                    </td>
                    <td
                      style={{
                        padding: "6px",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {item.grade}
                    </td>
                    <td
                      style={{
                        padding: "6px",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {item.type || "-"}
                    </td>

                    {/* รอบ 1 */}
                    {item.r1.map((val, idx) => (
                      <td
                        key={`r1-${idx}`}
                        style={{
                          padding: "2px",
                          borderRight: "1px solid #e2e8f0",
                          background: val ? "#eff6ff" : "transparent",
                        }}
                      >
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            handleCellChange(item.id, "r1", idx, e.target.value)
                          }
                          style={{
                            width: "28px",
                            height: "28px",
                            textAlign: "center",
                            border: "none",
                            background: "transparent",
                            fontSize: "12px",
                            fontWeight: val ? 600 : 400,
                            color: "#1e3a8a",
                            outline: "none",
                          }}
                        />
                      </td>
                    ))}

                    {/* รอบ 2 */}
                    {item.r2.map((val, idx) => (
                      <td
                        key={`r2-${idx}`}
                        style={{
                          padding: "2px",
                          borderRight: "1px solid #e2e8f0",
                          background: val ? "#eff6ff" : "transparent",
                        }}
                      >
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            handleCellChange(item.id, "r2", idx, e.target.value)
                          }
                          style={{
                            width: "28px",
                            height: "28px",
                            textAlign: "center",
                            border: "none",
                            background: "transparent",
                            fontSize: "12px",
                            fontWeight: val ? 600 : 400,
                            color: "#1e3a8a",
                            outline: "none",
                          }}
                        />
                      </td>
                    ))}

                    {/* รอบชิงชนะเลิศ */}
                    {item.r3.map((val, idx) => (
                      <td
                        key={`r3-${idx}`}
                        style={{
                          padding: "2px",
                          borderRight: "1px solid #e2e8f0",
                          background:
                            idx < 3 && val
                              ? "#fef9c3"
                              : val
                                ? "#f0fdf4"
                                : "transparent",
                        }}
                      >
                        <input
                          type="text"
                          value={val}
                          onChange={(e) =>
                            handleCellChange(item.id, "r3", idx, e.target.value)
                          }
                          placeholder={idx < 3 ? `🥇🥈🥉`[idx * 2] : ""}
                          style={{
                            width: "28px",
                            height: "28px",
                            textAlign: "center",
                            border: "none",
                            background: "transparent",
                            fontSize: "12px",
                            fontWeight: val ? 700 : 400,
                            color: idx < 3 ? "#854d0e" : "#14532d",
                            outline: "none",
                          }}
                        />
                      </td>
                    ))}

                    {/* Actions */}
                    <td style={{ padding: "4px" }}>
                      <button
                        type="button"
                        className="ui-button-outline ui-button-sm"
                        style={{
                          fontSize: "12px",
                          padding: "4px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        onClick={() => {
                          setSelectedRow(item);
                          setModalRound("r1");
                        }}
                      >
                        <UserPlus size={13} /> จัดลู่/นักกีฬา
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ======================= TAB 2: SUMMARY & REPORT ======================= */}
      {subTab === "summary" && (
        <div className="printable-report" style={{ background: "#fff", padding: "16px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 6px" }}>
              ตารางสรุปผลการแข่งขันกรีฑา
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              การแข่งขันกีฬา - กรีฑานักเรียน กลุ่มโรงเรียนโกสัมพีนคร
              "นครโกสัมพีเกมส์" ประจำปีการศึกษา ๒๕๖๙
            </p>
          </div>

          {/* 20 Events Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "16px",
              marginBottom: "30px",
            }}
          >
            {rows.slice(0, 20).map((r) => {
              const winners = r.winners || [
                { rank: 1, athleteName: r.r3Lanes?.[0]?.athleteName || "", schoolName: r.r3Lanes?.[0]?.schoolName || "", score: 3, note: "" },
                { rank: 2, athleteName: r.r3Lanes?.[1]?.athleteName || "", schoolName: r.r3Lanes?.[1]?.schoolName || "", score: 2, note: "" },
                { rank: 3, athleteName: r.r3Lanes?.[2]?.athleteName || "", schoolName: r.r3Lanes?.[2]?.schoolName || "", score: 1, note: "" },
              ];

              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid #f472b6",
                    borderRadius: "6px",
                    overflow: "hidden",
                    fontSize: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "#f472b6",
                      color: "#fff",
                      fontWeight: 700,
                      padding: "6px 10px",
                      textAlign: "center",
                    }}
                  >
                    รายการที่ {r.sourceNumber || r.no} {r.name} {r.grade}{" "}
                    {r.type}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                    <thead>
                      <tr style={{ background: "#fdf2f8", borderBottom: "1px solid #fbcfe8" }}>
                        <th style={{ padding: "4px", width: "45px" }}>ลำดับที่</th>
                        <th style={{ padding: "4px", textAlign: "left" }}>ชื่อ - นามสกุล</th>
                        <th style={{ padding: "4px", textAlign: "left" }}>โรงเรียน</th>
                        <th style={{ padding: "4px", width: "40px" }}>คะแนน</th>
                        <th style={{ padding: "4px", width: "50px" }}>หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map((rank, i) => {
                        const w = winners[i];
                        const medalIcon = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
                        return (
                          <tr key={rank} style={{ borderBottom: "1px solid #fdf2f8" }}>
                            <td style={{ padding: "5px 4px", fontWeight: 600 }}>
                              {medalIcon} {rank === 1 ? "๑" : rank === 2 ? "๒" : "๓"}
                            </td>
                            <td style={{ padding: "5px 4px", textAlign: "left" }}>
                              {w?.athleteName || "-"}
                            </td>
                            <td style={{ padding: "5px 4px", textAlign: "left" }}>
                              {w?.schoolName || "-"}
                            </td>
                            <td style={{ padding: "5px 4px", fontWeight: 700 }}>
                              {rank === 1 ? "๓" : rank === 2 ? "๒" : "๑"}
                            </td>
                            <td style={{ padding: "5px 4px", color: "#64748b" }}>
                              {w?.note || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* Page 34: Summary Score Table */}
          <div
            style={{
              pageBreakBefore: "always",
              marginTop: "40px",
              paddingTop: "20px",
              borderTop: "2px dashed #cbd5e1",
            }}
          >
            <h3 style={{ textAlign: "center", fontSize: "1.2rem", fontWeight: 700, margin: "0 0 16px" }}>
              สรุปผลรวมการแข่งขันกรีฑานักเรียน
            </h3>

            <div style={{ maxWidth: "680px", margin: "0 auto 30px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "center",
                  border: "1px solid #f472b6",
                }}
              >
                <thead>
                  <tr style={{ background: "#f472b6", color: "#fff", fontWeight: 700 }}>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", width: "60px" }}>
                      ลำดับที่
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", textAlign: "left" }}>
                      โรงเรียน
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", width: "90px" }}>
                      คะแนนรวม
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", width: "120px" }}>
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankedSchools.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "16px", color: "#94a3b8" }}>
                        ยังไม่มีผลการแข่งขันกรีฑา (คะแนนจะสรุปจากอันดับ ๑=๓ แต้ม, ๒=๒ แต้ม, ๓=๑ แต้ม ในรอบชิง)
                      </td>
                    </tr>
                  ) : (
                    rankedSchools.map((s, idx) => (
                      <tr key={s.schoolName} style={{ borderBottom: "1px solid #fbcfe8" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>
                          {idx === 0 ? "🥇 ๑" : idx === 1 ? "🥈 ๒" : idx === 2 ? "🥉 ๓" : idx + 1}
                        </td>
                        <td style={{ padding: "8px", textAlign: "left", fontWeight: 500 }}>
                          {s.schoolName}
                        </td>
                        <td style={{ padding: "8px", fontWeight: 700, color: "#be185d" }}>
                          {s.totalScore}
                        </td>
                        <td style={{ padding: "8px", color: "#64748b" }}>
                          {idx === 0 ? "ชนะเลิศคะแนนรวม" : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
                maxWidth: "680px",
                margin: "40px auto 0",
                fontSize: "13px",
              }}
            >
              <div style={{ textAlign: "center", lineHeight: "1.8" }}>
                <p>ลงชื่อ......................................................คณะกรรมการ</p>
                <p>(...............................................................)</p>
                <div style={{ height: "16px" }} />
                <p>ลงชื่อ......................................................คณะกรรมการ</p>
                <p>(...............................................................)</p>
              </div>

              <div style={{ textAlign: "center", lineHeight: "1.8", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <p>ลงชื่อ......................................................ประธานฝ่ายจัดการแข่งขัน</p>
                <p>(...............................................................)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL: จัดลู่วิ่ง & กำหนดนักกีฬา ======================= */}
      {selectedRow && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              border: "1px solid #cbd5e1",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "14px 18px",
                background: "#1e293b",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: "12px 12px 0 0",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px" }}>
                  ลงทะเบียนนักกีฬาและจัดลู่วิ่ง · รายการที่ {selectedRow.no}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                  {selectedRow.name} · {selectedRow.grade} · {selectedRow.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "18px" }}>
              {/* Round Selector Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "16px",
                  borderBottom: "1px solid #cbd5e1",
                  paddingBottom: "8px",
                }}
              >
                <button
                  type="button"
                  className={modalRound === "r1" ? "primary" : "ui-button-outline ui-button-sm"}
                  onClick={() => setModalRound("r1")}
                >
                  🏃 รอบ ๑ (๕ ลู่)
                </button>
                <button
                  type="button"
                  className={modalRound === "r2" ? "primary" : "ui-button-outline ui-button-sm"}
                  onClick={() => setModalRound("r2")}
                >
                  🏃 รอบ ๒ (๕ ลู่)
                </button>
                <button
                  type="button"
                  className={modalRound === "r3" ? "primary" : "ui-button-outline ui-button-sm"}
                  onClick={() => setModalRound("r3")}
                >
                  🏆 รอบชิงชนะเลิศ (๖ ลู่)
                </button>
              </div>

              {/* Instructions */}
              <div
                style={{
                  background: modalRound === "r3" ? "#fefce8" : "#f0fdf4",
                  border: `1px solid ${modalRound === "r3" ? "#fef08a" : "#bbf7d0"}`,
                  padding: "10px 14px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  color: modalRound === "r3" ? "#854d0e" : "#166534",
                }}
              >
                {modalRound === "r3" ? (
                  <>
                    🏆 <strong>รอบชิงชนะเลิศ:</strong> กรอกข้อมูลนักกีฬาและระบุ{" "}
                    <strong>อันดับ 1, 2, 3</strong> ในช่องผลการแข่งขัน
                    เพื่อสรุปเหรียญทอง เงิน ทองแดง และคะแนน ๓, ๒, ๑ โดยอัตโนมัติ
                  </>
                ) : (
                  <>
                    📋 <strong>{modalRound === "r1" ? "รอบ ๑" : "รอบ ๒"}:</strong>{" "}
                    กรรมการลงทะเบียนนักกีฬา โรงเรียน และหมายเลข BIB ประจำแต่ละลู่
                    เมื่อวิ่งเสร็จ เลือกลำดับ 1, 2, 3 แล้วกดปุ่ม{" "}
                    <strong>"ส่งผู้เข้ารอบเข้าสู่รอบถัดไป"</strong>
                  </>
                )}
              </div>

              {/* Lane Assignment Form Table */}
              <div
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  overflow: "hidden",
                  marginBottom: "16px",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #cbd5e1" }}>
                      <th style={{ padding: "8px", width: "60px", textAlign: "center" }}>ลู่</th>
                      <th style={{ padding: "8px", width: "100px", textAlign: "center" }}>หมายเลข BIB</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>ชื่อ - นามสกุล นักกีฬา</th>
                      <th style={{ padding: "8px", textAlign: "left" }}>โรงเรียน</th>
                      <th style={{ padding: "8px", width: "130px", textAlign: "center" }}>
                        {modalRound === "r3" ? "อันดับเหรียญ" : "อันดับเข้าเส้นชัย"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalRound === "r1"
                      ? selectedRow.r1Lanes
                      : modalRound === "r2"
                        ? selectedRow.r2Lanes
                        : selectedRow.r3Lanes
                    ).map((lane, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          background: lane.rank ? "#fefce8" : "#fff",
                        }}
                      >
                        <td
                          style={{
                            padding: "8px",
                            textAlign: "center",
                            fontWeight: 700,
                            color: "#0f766e",
                          }}
                        >
                          ลู่ {lane.lane}
                        </td>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="text"
                            placeholder="เช่น 101"
                            value={lane.bib}
                            onChange={(e) =>
                              updateModalLane(modalRound, idx, "bib", e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              textAlign: "center",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "13px",
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px" }}>
                          <input
                            type="text"
                            placeholder="ชื่อ-สกุล นักกีฬา"
                            value={lane.athleteName}
                            onChange={(e) =>
                              updateModalLane(
                                modalRound,
                                idx,
                                "athleteName",
                                e.target.value,
                              )
                            }
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "13px",
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px" }}>
                          <select
                            value={lane.schoolName}
                            onChange={(e) =>
                              updateModalLane(
                                modalRound,
                                idx,
                                "schoolName",
                                e.target.value,
                              )
                            }
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "13px",
                            }}
                          >
                            <option value="">-- เลือกโรงเรียน --</option>
                            {schools.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "6px", textAlign: "center" }}>
                          <select
                            value={lane.rank || ""}
                            onChange={(e) =>
                              updateModalLane(modalRound, idx, "rank", e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "13px",
                              fontWeight: lane.rank ? 600 : 400,
                              color:
                                lane.rank === "1"
                                  ? "#ca8a04"
                                  : lane.rank === "2"
                                    ? "#64748b"
                                    : lane.rank === "3"
                                      ? "#b45309"
                                      : "#334155",
                            }}
                          >
                            <option value="">- เข้าเส้นชัย -</option>
                            <option value="1">🥇 ที่ ๑ (ทอง)</option>
                            <option value="2">🥈 ที่ ๒ (เงิน)</option>
                            <option value="3">🥉 ที่ ๓ (ทองแดง)</option>
                            <option value="4">ที่ ๔</option>
                            <option value="5">ที่ ๕</option>
                            {modalRound === "r3" && <option value="6">ที่ ๖</option>}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action: Advance Qualifiers */}
              {modalRound !== "r3" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "#f8fafc",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    เลือกลำดับ 1, 2, 3 ในตารางลู่ แล้วกดปุ่มเพื่อคัดลอกรายชื่อไปรอบถัดไป
                  </span>
                  <button
                    type="button"
                    className="ui-button-outline ui-button-sm"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "#fff",
                      borderColor: "#0f766e",
                      color: "#0f766e",
                      fontWeight: 600,
                    }}
                    onClick={() =>
                      advanceQualifiers(
                        modalRound,
                        modalRound === "r1" ? "r2" : "r3",
                      )
                    }
                  >
                    ส่งอันดับ 1-3 เข้ารอบถัดไป <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "14px",
                }}
              >
                <button
                  type="button"
                  className="ui-button-outline"
                  onClick={() => setSelectedRow(null)}
                >
                  ปิด
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    const next = rows.map((r) =>
                      r.id === selectedRow.id ? selectedRow : r,
                    );
                    saveRows(next, "บันทึกการจัดลู่และผลการแข่งขันเรียบร้อย");
                    setSelectedRow(null);
                  }}
                >
                  <Check size={14} style={{ display: "inline" }} /> บันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
