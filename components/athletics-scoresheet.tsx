"use client";

import React, { useState, useEffect } from "react";
import { Printer, UserPlus, Trophy, RotateCcw, Search, Check, Medal } from "lucide-react";

export type AthleticsRow = {
  id: number;
  no: string;
  sourceNumber?: number;
  name: string;
  grade: string;
  type: string;
  r1: string[]; // 5 lanes
  r2: string[]; // 5 lanes
  r3: string[]; // 6 lanes (finals)
  // Lane assignments: { laneIndex: { schoolName, athleteName, bib } }
  assignments?: Record<
    string,
    { schoolId?: string; schoolName: string; athleteName: string; bib: string }
  >;
  // Final winners: [1st, 2nd, 3rd]
  winners?: {
    rank: number;
    athleteName: string;
    schoolName: string;
    score: number;
    note: string;
  }[];
};

export const INITIAL_ATHLETICS_DATA: AthleticsRow[] = [
  { id: 1, no: "๑", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 2, no: "๒", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 3, no: "๓", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 4, no: "๔", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 5, no: "๕", sourceNumber: 106, name: "วิ่ง ๕๐ เมตร", grade: "อนุบาล", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 6, no: "๖", sourceNumber: 107, name: "วิ่ง ๕๐ เมตร", grade: "อนุบาล", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 7, no: "๗", sourceNumber: 112, name: "วิ่ง ๘๐ เมตร", grade: "อนุบาล", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 8, no: "๘", sourceNumber: 113, name: "วิ่ง ๘๐ เมตร", grade: "อนุบาล", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 9, no: "๙", sourceNumber: 118, name: "วิ่ง ๖๐ เมตร", grade: "ป.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 10, no: "๑๐", sourceNumber: 119, name: "วิ่ง ๖๐ เมตร", grade: "ป.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 11, no: "๑๑", sourceNumber: 124, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 12, no: "๑๒", sourceNumber: 125, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 13, no: "๑๓", sourceNumber: 130, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๔-๖", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 14, no: "๑๔", sourceNumber: 131, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๔-๖", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 15, no: "๑๕", sourceNumber: 132, name: "วิ่ง ๑๐๐ เมตร", grade: "ม.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 16, no: "๑๖", sourceNumber: 133, name: "วิ่ง ๑๐๐ เมตร", grade: "ม.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 17, no: "๑๗", sourceNumber: 138, name: "วิ่ง ๒๐๐ เมตร", grade: "ป.๔-๖", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 18, no: "๑๘", sourceNumber: 139, name: "วิ่ง ๒๐๐ เมตร", grade: "ป.๔-๖", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 19, no: "๑๙", sourceNumber: 140, name: "วิ่ง ๒๐๐ เมตร", grade: "ม.๑-๓", type: "หญิง", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
  { id: 20, no: "๒๐", sourceNumber: 141, name: "วิ่ง ๒๐๐ เมตร", grade: "ม.๑-๓", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""] },
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
  const [toast, setToast] = useState<string | null>(null);

  // Load from local storage preview
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nkg2569_athletics_preview");
      if (saved) {
        setRows(JSON.parse(saved));
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
      return { ...r, [roundKey]: round };
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

  // Aggregate school scores for page 34
  const schoolScoreMap: Record<string, number> = {};
  const schoolGradeMap: Record<string, Record<string, number>> = {};

  rows.forEach((r) => {
    (r.winners || []).forEach((w) => {
      if (w.schoolName) {
        schoolScoreMap[w.schoolName] =
          (schoolScoreMap[w.schoolName] || 0) + (w.score || 0);
        if (!schoolGradeMap[w.schoolName]) schoolGradeMap[w.schoolName] = {};
        schoolGradeMap[w.schoolName][r.grade] =
          (schoolGradeMap[w.schoolName][r.grade] || 0) + (w.score || 0);
      }
    });
  });

  const rankedSchools = Object.entries(schoolScoreMap)
    .map(([schoolName, totalScore]) => ({
      schoolName,
      totalScore,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

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
            📋 ใบบันทึกผลการแข่งขันกรีฑา (หน้า ๒๙–๓๐)
          </button>
          <button
            type="button"
            className={subTab === "summary" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("summary")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Trophy size={16} /> สรุปผลและคะแนนกรีฑา (หน้า ๓๑–๓๔)
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

      {/* ======================= TAB 1: SCORESHEET (หน้า 29-30) ======================= */}
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
                อ้างอิงสูจิบัตรหน้า ๒๙–๓๐ ·
                พิมพ์หมายเลขลู่หรือหมายเลขประจำตัวนักกีฬา (BIB) ลงในแต่ละช่องได้ทันที
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
                      width: "90px",
                    }}
                  >
                    จัดลู่/ผล
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
                        style={{ fontSize: "11px", padding: "4px 8px" }}
                        onClick={() => setSelectedRow(item)}
                      >
                        <UserPlus size={12} style={{ display: "inline" }} /> จัดลู่/สรุป
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ======================= TAB 2: SUMMARY & REPORT (หน้า 31-34) ======================= */}
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

          {/* 20 Events Grid (หน้า 31-33) */}
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
                { rank: 1, athleteName: r.assignments?.["r3-0"]?.athleteName || "", schoolName: r.assignments?.["r3-0"]?.schoolName || "", score: 3, note: "" },
                { rank: 2, athleteName: r.assignments?.["r3-1"]?.athleteName || "", schoolName: r.assignments?.["r3-1"]?.schoolName || "", score: 2, note: "" },
                { rank: 3, athleteName: r.assignments?.["r3-2"]?.athleteName || "", schoolName: r.assignments?.["r3-2"]?.schoolName || "", score: 1, note: "" },
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
                    รายการที่ {r.sourceNumber || r.no} {r.name} {r.grade}
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
              สรุปผลรวมการแข่งขันกรีฑานักเรียน (หน้า ๓๔)
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

            {/* Signature Area (หน้า 34) */}
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
              maxWidth: "620px",
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
                  จัดลู่วิ่งและผลการแข่งขัน · รายการที่ {selectedRow.no}
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
              <h4 style={{ margin: "0 0 10px", fontSize: "14px", color: "#0f766e" }}>
                🏆 กำหนดผู้ชนะรอบชิงชนะเลิศ (ส่งไปหน้าสรุปคะแนน ๓, ๒, ๑)
              </h4>

              <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
                {[1, 2, 3].map((rank, i) => {
                  const currentWinner = selectedRow.winners?.[i] || {
                    rank,
                    athleteName: "",
                    schoolName: "",
                    score: rank === 1 ? 3 : rank === 2 ? 2 : 1,
                    note: "",
                  };
                  return (
                    <div
                      key={rank}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "70px 1fr 1fr",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>
                        {rank === 1 ? "🥇 ที่ ๑" : rank === 2 ? "🥈 ที่ ๒" : "🥉 ที่ ๓"}
                      </span>
                      <input
                        type="text"
                        placeholder="ชื่อ-สกุล นักกีฬา"
                        value={currentWinner.athleteName}
                        onChange={(e) => {
                          const winners = [...(selectedRow.winners || [
                            { rank: 1, athleteName: "", schoolName: "", score: 3, note: "" },
                            { rank: 2, athleteName: "", schoolName: "", score: 2, note: "" },
                            { rank: 3, athleteName: "", schoolName: "", score: 1, note: "" },
                          ])];
                          winners[i] = { ...winners[i], athleteName: e.target.value };
                          setSelectedRow({ ...selectedRow, winners });
                        }}
                        style={{ padding: "6px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <select
                        value={currentWinner.schoolName}
                        onChange={(e) => {
                          const winners = [...(selectedRow.winners || [
                            { rank: 1, athleteName: "", schoolName: "", score: 3, note: "" },
                            { rank: 2, athleteName: "", schoolName: "", score: 2, note: "" },
                            { rank: 3, athleteName: "", schoolName: "", score: 1, note: "" },
                          ])];
                          winners[i] = { ...winners[i], schoolName: e.target.value };
                          setSelectedRow({ ...selectedRow, winners });
                        }}
                        style={{ padding: "6px 10px", fontSize: "13px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      >
                        <option value="">-- เลือกโรงเรียน --</option>
                        {schools.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

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
                    saveRows(next, "บันทึกผลการแข่งขันเรียบร้อย");
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
