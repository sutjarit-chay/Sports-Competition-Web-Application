"use client";

import React, { useState, useEffect } from "react";
import {
  Printer,
  UserPlus,
  Trophy,
  RotateCcw,
  Search,
  Check,
  Save,
  ArrowRight,
  ArrowLeft,
  Medal,
  ClipboardList,
  Edit3,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react";

export type LaneEntry = {
  lane: number;
  schoolName: string; // ชื่อโรงเรียน เช่น โรงเรียนบ้านหนองแดน
  athleteName: string; // ชื่อ-สกุล นักกีฬา
  time?: string; // สถิติเวลา/ผล (ถ้ามี)
  rank?: string; // "1", "2", "3", "4", "5", "6", "DQ", "DNF", "DNS"
  isFoul?: boolean; // ฟาล์วหรือไม่
  foulReason?: string; // รายละเอียดฟาล์ว (ถ้ามี)
};

export type AthleticsRow = {
  id: number;
  no: string;
  sourceNumber?: number;
  name: string;
  grade: string;
  type: string;
  r1: string[]; // 5 lanes (ชื่อโรงเรียน)
  r2: string[]; // 5 lanes (ชื่อโรงเรียน)
  r3: string[]; // 6 lanes (finals) (ชื่อโรงเรียน)
  r1Lanes: LaneEntry[];
  r2Lanes: LaneEntry[];
  r3Lanes: LaneEntry[];
  winners?: {
    rank: number;
    athleteName: string;
    schoolName: string;
    score: number;
    time?: string;
  }[];
};

export const DEFAULT_SCHOOLS = [
  "โรงเรียนบ้านหนองแดน",
  "โรงเรียนบ้านโนนสมบูรณ์",
  "โรงเรียนบ้านคลองเมือง",
  "โรงเรียนบ้านมะเดื่อชุมพร",
  "โรงเรียนอนุบาลโกสัมพีนคร (บ้านท่าคูณ)",
  "โรงเรียนบ้านดงซ่อม",
  "โรงเรียนบ้านหนองวัวดำ",
  "โรงเรียนบ้านไร่ลำปาง",
  "โรงเรียนบ้านโกสัมพี (วิเศษน้อมมิตรอนุกูล)",
  "โรงเรียนบ้านหนองแดน สาขาบ้านโละโคะ",
  "โรงเรียนโกสัมพีวิทยา",
];

export function getDisplaySchoolName(fullName: string): string {
  if (!fullName) return "";
  return fullName.replace(/^โรงเรียน/, "").trim();
}

function defaultLanes(count: number): LaneEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    lane: i + 1,
    schoolName: "",
    athleteName: "",
    time: "",
    rank: "",
    isFoul: false,
    foulReason: "",
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
  { id: 21, no: "๒๑", sourceNumber: 142, name: "วิ่งผลัด ๔x๑๐๐ เมตร", grade: "ป.๔-๖", type: "ชาย", r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
];

// Helper to seed qualifiers from Round 1 and Round 2 into Finals (3, 2, 1, 1, 2, 3)
export function syncQualifiersToFinals(row: AthleticsRow): { row: AthleticsRow; newlyAdvanced: boolean } {
  const nextR3Lanes = [...row.r3Lanes];
  const nextR3Cells = [...row.r3];

  const findQualifier = (lanes: LaneEntry[], targetRank: string) => {
    return lanes.find(
      (l) => !l.isFoul && (l.rank === targetRank || l.rank === `ที่ ${targetRank}`),
    );
  };

  const r1First = findQualifier(row.r1Lanes, "1");
  const r1Second = findQualifier(row.r1Lanes, "2");
  const r1Third = findQualifier(row.r1Lanes, "3");

  const r2First = findQualifier(row.r2Lanes, "1");
  const r2Second = findQualifier(row.r2Lanes, "2");
  const r2Third = findQualifier(row.r2Lanes, "3");

  // Seeding order across lanes 1-6: 3, 2, 1, 1, 2, 3
  // ลู่ ๑ (idx 0) = R1 #3
  // ลู่ ๒ (idx 1) = R1 #2
  // ลู่ ๓ (idx 2) = R1 #1
  // ลู่ ๔ (idx 3) = R2 #1
  // ลู่ ๕ (idx 4) = R2 #2
  // ลู่ ๖ (idx 5) = R2 #3
  const mapping: [number, LaneEntry | undefined][] = [
    [0, r1Third],  // ลู่ ๑: อันดับ ๓ รอบ ๑
    [1, r1Second], // ลู่ ๒: อันดับ ๒ รอบ ๑
    [2, r1First],  // ลู่ ๓: อันดับ ๑ รอบ ๑
    [3, r2First],  // ลู่ ๔: อันดับ ๑ รอบ ๒
    [4, r2Second], // ลู่ ๕: อันดับ ๒ รอบ ๒
    [5, r2Third],  // ลู่ ๖: อันดับ ๓ รอบ ๒
  ];

  let newlyAdvanced = false;
  mapping.forEach(([targetLaneIdx, qualifier]) => {
    if (qualifier && qualifier.schoolName) {
      if (
        nextR3Lanes[targetLaneIdx].schoolName !== qualifier.schoolName ||
        nextR3Lanes[targetLaneIdx].athleteName !== qualifier.athleteName
      ) {
        newlyAdvanced = true;
      }
      nextR3Lanes[targetLaneIdx] = {
        ...nextR3Lanes[targetLaneIdx],
        schoolName: qualifier.schoolName,
        athleteName: qualifier.athleteName || "",
        isFoul: false,
        rank: nextR3Lanes[targetLaneIdx].rank || "",
        time: "",
      };
      nextR3Cells[targetLaneIdx] = qualifier.schoolName;
    }
  });

  return {
    row: {
      ...row,
      r3Lanes: nextR3Lanes,
      r3: nextR3Cells,
    },
    newlyAdvanced,
  };
}

type CellModalData = {
  rowId: number;
  roundKey: "r1" | "r2" | "r3";
  subIndex: number;
  schoolName: string;
  athleteName: string;
  rank: string;
  isFoul: boolean;
  foulReason: string;
  time: string;
};

export function AthleticsScoresheet({
  schools = [],
}: {
  schools?: { id: string; name: string }[];
}) {
  const [subTab, setSubTab] = useState<"register" | "sheet" | "summary">("register");
  const [rows, setRows] = useState<AthleticsRow[]>(INITIAL_ATHLETICS_DATA);
  const [search, setSearch] = useState("");
  const [activeEventId, setActiveEventId] = useState<number>(1);
  const [activeRound, setActiveRound] = useState<"r1" | "r2" | "r3">("r1");
  const [toast, setToast] = useState<string | null>(null);

  // Cell modal for scoresheet inline click
  const [cellModal, setCellModal] = useState<CellModalData | null>(null);

  // Available school list (database prop or fallback)
  const schoolOptions =
    schools && schools.length > 0
      ? schools.map((s) => s.name)
      : DEFAULT_SCHOOLS;

  // Load from localStorage preview
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nkg2569_athletics_preview");
      if (saved) {
        const parsed = JSON.parse(saved);
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

  function handleManualSave() {
    saveRows(rows, "บันทึกข้อมูลการจัดลู่วิ่งเรียบร้อยแล้ว");
  }

  // Active event object
  const activeEvent = rows.find((r) => r.id === activeEventId) || rows[0];

  // Update a single lane in the active event
  function updateLane(
    roundKey: "r1" | "r2" | "r3",
    index: number,
    field: keyof LaneEntry,
    val: string,
  ) {
    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const currentLanes = [...activeEvent[lanesKey]];
    const updatedLane = { ...currentLanes[index], [field]: val };
    currentLanes[index] = updatedLane;

    // Sync school name to the main display cell array
    const roundCells = [...activeEvent[roundKey]];
    if (field === "schoolName") {
      roundCells[index] = val;
    }

    const updatedEvent: AthleticsRow = {
      ...activeEvent,
      [lanesKey]: currentLanes,
      [roundKey]: roundCells,
    };

    const nextRows = rows.map((r) => (r.id === activeEvent.id ? updatedEvent : r));
    saveRows(nextRows);
  }

  // Open modal from cell click in the scoresheet
  function openCellModal(rowId: number, roundKey: "r1" | "r2" | "r3", subIndex: number) {
    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;
    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const lane = targetRow[lanesKey]?.[subIndex] || {
      lane: subIndex + 1,
      schoolName: targetRow[roundKey]?.[subIndex] || "",
      athleteName: "",
      rank: "",
      isFoul: false,
      foulReason: "",
      time: "",
    };

    setCellModal({
      rowId,
      roundKey,
      subIndex,
      schoolName: lane.schoolName || targetRow[roundKey]?.[subIndex] || "",
      athleteName: lane.athleteName || "",
      rank: lane.rank || "",
      isFoul: !!lane.isFoul,
      foulReason: lane.foulReason || "",
      time: lane.time || "",
    });
  }

  // Save modal results and automatically seed to finals (3-2-1-1-2-3)
  function handleSaveCellModal() {
    if (!cellModal) return;
    const { rowId, roundKey, subIndex, schoolName, athleteName, rank, isFoul, foulReason, time } = cellModal;

    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;

    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const updatedLanes = [...targetRow[lanesKey]];
    const updatedRoundCells = [...targetRow[roundKey]];

    const finalRank = isFoul ? "DQ" : rank;

    updatedLanes[subIndex] = {
      ...updatedLanes[subIndex],
      schoolName,
      athleteName,
      rank: finalRank,
      isFoul,
      foulReason: isFoul ? foulReason || "ฟาล์ว/ผิดกติกา" : "",
      time,
    };
    updatedRoundCells[subIndex] = schoolName;

    let updatedRow: AthleticsRow = {
      ...targetRow,
      [lanesKey]: updatedLanes,
      [roundKey]: updatedRoundCells,
    };

    // Auto-advance qualifiers (1, 2, 3) from Round 1 and Round 2 into Finals using 3-2-1-1-2-3
    let autoAdvancedMsg: string | undefined = undefined;
    if (roundKey === "r1" || roundKey === "r2") {
      const synced = syncQualifiersToFinals(updatedRow);
      updatedRow = synced.row;
      if (synced.newlyAdvanced) {
        autoAdvancedMsg = "ส่งผู้เข้ารอบเข้าสู่รอบชิงชนะเลิศ (ลำดับลู่ 3-2-1-1-2-3) เรียบร้อย";
      }
    }

    // If this edit was in Round 3 (Finals), calculate medal winners automatically
    if (roundKey === "r3") {
      const winners = [1, 2, 3].map((rankNum) => {
        const matchingLane = updatedLanes.find(
          (l) => !l.isFoul && (l.rank === String(rankNum) || l.rank === `ที่ ${rankNum}`),
        );
        return {
          rank: rankNum,
          athleteName: matchingLane?.athleteName || "",
          schoolName: matchingLane?.schoolName || "",
          score: rankNum === 1 ? 3 : rankNum === 2 ? 2 : 1,
          time: matchingLane?.time || "",
        };
      });
      updatedRow = {
        ...updatedRow,
        winners,
      };
    }

    const nextRows = rows.map((r) => (r.id === rowId ? updatedRow : r));
    saveRows(
      nextRows,
      autoAdvancedMsg || (isFoul ? `บันทึกสถานะฟาล์ว: ลู่ ${subIndex + 1}` : `บันทึกอันดับ: ลู่ ${subIndex + 1}`),
    );
    setCellModal(null);
  }

  // Update finals medal winner (1st = Gold, 2nd = Silver, 3rd = Bronze)
  function updateWinner(rankNum: 1 | 2 | 3, laneIndex: number | "none") {
    const currentWinners = activeEvent.winners ? [...activeEvent.winners] : [];
    const lane = typeof laneIndex === "number" ? activeEvent.r3Lanes[laneIndex] : null;

    // Filter out existing holder of this rank
    const nextWinners = currentWinners.filter((w) => w.rank !== rankNum);

    if (lane && lane.schoolName) {
      nextWinners.push({
        rank: rankNum,
        athleteName: lane.athleteName || "",
        schoolName: lane.schoolName,
        score: rankNum === 1 ? 3 : rankNum === 2 ? 2 : 1,
        time: lane.time || "",
      });
    }

    // Also update rank tag on r3Lanes for medal highlights
    const updatedR3Lanes = activeEvent.r3Lanes.map((l, idx) => {
      if (laneIndex === idx) {
        return { ...l, rank: String(rankNum), isFoul: false };
      }
      if (l.rank === String(rankNum)) {
        return { ...l, rank: "" };
      }
      return l;
    });

    const updatedEvent: AthleticsRow = {
      ...activeEvent,
      r3Lanes: updatedR3Lanes,
      winners: nextWinners.sort((a, b) => a.rank - b.rank),
    };

    const nextRows = rows.map((r) => (r.id === activeEvent.id ? updatedEvent : r));
    saveRows(
      nextRows,
      lane
        ? `บันทึก${rankNum === 1 ? "เหรียญทอง" : rankNum === 2 ? "เหรียญเงิน" : "เหรียญทองแดง"}: ${lane.schoolName}`
        : undefined,
    );
  }

  // Clear lanes in active round
  function clearRoundLanes(roundKey: "r1" | "r2" | "r3") {
    const label =
      roundKey === "r1" ? "รอบ ๑" : roundKey === "r2" ? "รอบ ๒" : "รอบชิงชนะเลิศ";
    if (!confirm(`ต้องการล้างข้อมูลลู่วิ่งใน ${label} ของรายการนี้หรือไม่?`)) return;

    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const count = roundKey === "r3" ? 6 : 5;
    const clearedLanes = defaultLanes(count);
    const clearedCells = Array(count).fill("");

    const updatedEvent: AthleticsRow = {
      ...activeEvent,
      [lanesKey]: clearedLanes,
      [roundKey]: clearedCells,
      winners: roundKey === "r3" ? [] : activeEvent.winners,
    };

    const nextRows = rows.map((r) => (r.id === activeEvent.id ? updatedEvent : r));
    saveRows(nextRows, `ล้างข้อมูล ${label} เรียบร้อย`);
  }

  function handleReset() {
    if (confirm("ต้องการคืนค่าเริ่มต้นของตารางกรีฑาทั้งหมดใช่หรือไม่?")) {
      saveRows(INITIAL_ATHLETICS_DATA, "คืนค่าข้อมูลเริ่มต้นเรียบร้อย");
    }
  }

  // Filter rows for scoresheet
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

  const activeLanes =
    activeRound === "r1"
      ? activeEvent.r1Lanes
      : activeRound === "r2"
        ? activeEvent.r2Lanes
        : activeEvent.r3Lanes;

  return (
    <div className="athletics-container" style={{ marginTop: "1rem" }}>
      {/* Toast Notification */}
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
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Check size={16} color="#4ade80" /> {toast}
        </div>
      )}

      {/* Main Sub Tabs Navigation */}
      <div
        className="athletics-subtabs"
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "16px",
          borderBottom: "2px solid #e2e8f0",
          paddingBottom: "8px",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className={subTab === "register" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("register")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <UserPlus size={16} /> ๑. ลงทะเบียนและจัดลู่วิ่ง
          </button>
          <button
            type="button"
            className={subTab === "sheet" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("sheet")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ClipboardList size={16} /> ๒. ใบบันทึกผลการแข่งขัน (ตาราง ๒๑ รายการ)
          </button>
          <button
            type="button"
            className={subTab === "summary" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("summary")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Trophy size={16} /> ๓. สรุปผลและคะแนนกรีฑา
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
            title="คืนค่าข้อมูลเริ่มต้น"
          >
            <RotateCcw size={14} /> คืนค่าเริ่มต้น
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ==================== TAB 1: REGISTRATION & LANE ASSIGNMENT ============= */}
      {/* ========================================================================= */}
      {subTab === "register" && (
        <section className="panel" aria-label="หน้าลงทะเบียนและจัดลู่วิ่งกรีฑา">
          {/* Header */}
          <div style={{ marginBottom: "16px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", color: "#0f172a" }}>
              ระบบลงทะเบียนนักกีฬาและจัดลู่วิ่ง (แยกจากใบบันทึกผล)
            </h2>
            <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
              เลือกลงทะเบียนนักกีฬาและจัดลู่วิ่งด้วย <strong>ชื่อโรงเรียน</strong> ในแต่ละรอบ (รอบ ๑, รอบ ๒, รอบชิงชนะเลิศ)
            </p>
          </div>

          {/* Event & Round Selector Bar */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            {/* Event Selector Row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "300px" }}>
                <span style={{ fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap" }}>
                  เลือกรายการแข่งขัน:
                </span>
                <select
                  value={activeEventId}
                  onChange={(e) => setActiveEventId(Number(e.target.value))}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #94a3b8",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#1e3a8a",
                    background: "#fff",
                    flex: 1,
                  }}
                >
                  {rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      รายการที่ {r.no}: {r.name} · {r.grade} · {r.type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prev / Next Event Buttons */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className="ui-button-outline ui-button-sm"
                  disabled={activeEventId <= 1}
                  onClick={() => setActiveEventId((prev) => Math.max(1, prev - 1))}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <ArrowLeft size={14} /> รายการก่อนหน้า
                </button>
                <button
                  type="button"
                  className="ui-button-outline ui-button-sm"
                  disabled={activeEventId >= rows.length}
                  onClick={() => setActiveEventId((prev) => Math.min(rows.length, prev + 1))}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  รายการถัดไป <ArrowRight size={14} />
                </button>
              </div>
            </div>

            {/* Event Info Card */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <span
                  style={{
                    background: "#0f766e",
                    color: "#fff",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 700,
                    marginRight: "8px",
                  }}
                >
                  รายการที่ {activeEvent.no}
                </span>
                <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                  {activeEvent.name}
                </strong>
                <span style={{ color: "#64748b", fontSize: "14px", marginLeft: "8px" }}>
                  (ระดับ {activeEvent.grade} · เพศ{activeEvent.type})
                </span>
              </div>

              {/* Round Selector Pills */}
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className={activeRound === "r1" ? "primary" : "ui-button-outline ui-button-sm"}
                  onClick={() => setActiveRound("r1")}
                  style={{ fontSize: "13px" }}
                >
                  🏃 รอบ ๑ (๕ ลู่)
                </button>
                <button
                  type="button"
                  className={activeRound === "r2" ? "primary" : "ui-button-outline ui-button-sm"}
                  onClick={() => setActiveRound("r2")}
                  style={{ fontSize: "13px" }}
                >
                  🏃 รอบ ๒ (๕ ลู่)
                </button>
                <button
                  type="button"
                  className={activeRound === "r3" ? "primary" : "ui-button-outline ui-button-sm"}
                  onClick={() => setActiveRound("r3")}
                  style={{
                    fontSize: "13px",
                    background: activeRound === "r3" ? "#0f766e" : undefined,
                    borderColor: "#0f766e",
                  }}
                >
                  🏆 รอบชิงชนะเลิศ (๖ ลู่)
                </button>
              </div>
            </div>
          </div>

          {/* Instructions banner */}
          <div
            style={{
              background: activeRound === "r3" ? "#fefce8" : "#f0fdf4",
              border: `1px solid ${activeRound === "r3" ? "#fef08a" : "#bbf7d0"}`,
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "13px",
              color: activeRound === "r3" ? "#854d0e" : "#166534",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              {activeRound === "r3" ? (
                <>
                  🏆 <strong>รอบชิงชนะเลิศ (๖ ลู่):</strong> กำหนดชื่อโรงเรียนและนักกีฬาประจำลู่ ๑–๖
                  (หรือระบบจะดึงผล ๑–๓ จากรอบ ๑ และ รอบ ๒ มาจัดลู่ 3-2-1-1-2-3 ให้อัตโนมัติเมื่อกรอกผลในใบบันทึก)
                </>
              ) : (
                <>
                  📋 <strong>{activeRound === "r1" ? "รอบ ๑ (๕ ลู่)" : "รอบ ๒ (๕ ลู่)"}:</strong>{" "}
                  ลงทะเบียนชื่อโรงเรียนและนักกีฬาประจำลู่ ๑–๕ ในรายการนี้
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="primary ui-button-sm"
                onClick={handleManualSave}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#0f766e",
                  fontSize: "13px",
                  padding: "5px 14px",
                  fontWeight: 600,
                }}
              >
                <Save size={14} /> บันทึก
              </button>
              <button
                type="button"
                className="ui-button-outline ui-button-sm"
                onClick={() => clearRoundLanes(activeRound)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "#b91c1c",
                  borderColor: "#fca5a5",
                  fontSize: "12px",
                }}
              >
                <Trash2 size={13} /> ล้างข้อมูลรอบนี้
              </button>
            </div>
          </div>

          {/* Lane Assignment Form Table (3 Columns: ลู่, ชื่อโรงเรียน, ชื่อนักกีฬา) */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              overflowX: "auto",
              marginBottom: "20px",
              background: "#fff",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#1e293b", color: "#fff" }}>
                  <th style={{ padding: "10px", width: "90px", textAlign: "center" }}>ลู่วิ่ง</th>
                  <th style={{ padding: "10px", minWidth: "280px", textAlign: "left" }}>
                    ชื่อโรงเรียน (เลือกจากรายชื่อ)
                  </th>
                  <th style={{ padding: "10px", minWidth: "240px", textAlign: "left" }}>
                    ชื่อ - นามสกุล นักกีฬา
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeLanes.map((lane, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                    }}
                  >
                    {/* Lane Number */}
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: "15px",
                        color: "#0f766e",
                      }}
                    >
                      ลู่ {lane.lane}
                    </td>

                    {/* School Selection (Full School Name) */}
                    <td style={{ padding: "8px 10px" }}>
                      <select
                        value={lane.schoolName}
                        onChange={(e) =>
                          updateLane(activeRound, idx, "schoolName", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: lane.schoolName
                            ? "1.5px solid #0f766e"
                            : "1px solid #cbd5e1",
                          fontSize: "14px",
                          fontWeight: lane.schoolName ? 600 : 400,
                          color: lane.schoolName ? "#0f172a" : "#64748b",
                          background: "#fff",
                        }}
                      >
                        <option value="">-- เลือกโรงเรียนประจำลู่ --</option>
                        {schoolOptions.map((schoolName) => (
                          <option key={schoolName} value={schoolName}>
                            {schoolName}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Athlete Name */}
                    <td style={{ padding: "8px 10px" }}>
                      <input
                        type="text"
                        placeholder="ชื่อ-สกุล นักกีฬา (ถ้ามี)"
                        value={lane.athleteName}
                        onChange={(e) =>
                          updateLane(activeRound, idx, "athleteName", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              padding: "14px 18px",
              background: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              marginBottom: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="primary"
                onClick={handleManualSave}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  background: "#0f766e",
                  boxShadow: "0 2px 4px rgba(15, 118, 110, 0.2)",
                }}
              >
                <Save size={16} /> บันทึก
              </button>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                *คลิกเพื่อบันทึกข้อมูลการจัดลู่วิ่งในรายการนี้
              </span>
            </div>

            {/* Quick Switch to Scoresheet */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="ui-button-outline"
                onClick={() => setSubTab("sheet")}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <ClipboardList size={15} /> ดูในใบบันทึกผล ๒๑ รายการ →
              </button>
            </div>
          </div>

          {/* Quick Grid of all 21 Events */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px", color: "#334155" }}>
              ภาพรวมและเลือกรายการแข่งขัน (๒๑ รายการ):
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "8px",
              }}
            >
              {rows.map((r) => {
                const isSelected = r.id === activeEventId;
                const r1Count = r.r1Lanes.filter((l) => l.schoolName).length;
                const r2Count = r.r2Lanes.filter((l) => l.schoolName).length;
                const r3Count = r.r3Lanes.filter((l) => l.schoolName).length;
                const hasMedals = (r.winners || []).some((w) => w.schoolName);

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveEventId(r.id)}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: isSelected ? "2px solid #0f766e" : "1px solid #cbd5e1",
                      background: isSelected ? "#f0fdf4" : "#fff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "3px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "12px", color: isSelected ? "#0f766e" : "#1e293b" }}>
                        {r.no}. {r.name}
                      </strong>
                      {hasMedals && <span title="สรุปเหรียญแล้ว">🥇</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      {r.grade} · {r.type}
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "2px", fontSize: "10px" }}>
                      <span style={{ color: r1Count > 0 ? "#0f766e" : "#94a3b8" }}>
                        รอบ ๑ ({r1Count}/๕)
                      </span>
                      <span style={{ color: r2Count > 0 ? "#0f766e" : "#94a3b8" }}>
                        รอบ ๒ ({r2Count}/๕)
                      </span>
                      <span style={{ color: r3Count > 0 ? "#b45309" : "#94a3b8" }}>
                        ชิง ({r3Count}/๖)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ==================== TAB 2: SCORESHEET (21 ROWS) ======================= */}
      {/* ========================================================================= */}
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
                ใบบันทึกผลการแข่งขันกรีฑา (รอบ ๑, รอบ ๒, รอบชิงชนะเลิศ)
              </h2>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
                💡 <strong>คำแนะนำ:</strong> คลิกที่ <strong>ช่องชื่อโรงเรียน</strong> ในแต่ละลู่ เพื่อเปิดหน้าต่างบันทึก{" "}
                <strong>อันดับ และ สถานะฟาล์ว</strong> เมื่อได้ผล ๑–๓ จากรอบ ๑ และ รอบ ๒ ระบบจะส่งไปรอบชิงชนะเลิศอัตโนมัติ (เรียงลู่ 3-2-1-1-2-3)
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
                      width: "55px",
                    }}
                  >
                    รายการ
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px",
                      border: "1px solid #334155",
                      textAlign: "left",
                      minWidth: "150px",
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
                      width: "55px",
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
                    รอบชิงชนะเลิศ (๖ ลู่) · เรียง ๓-๒-๑-๑-๒-๓
                  </th>
                  <th
                    rowSpan={2}
                    style={{
                      padding: "8px",
                      border: "1px solid #334155",
                      width: "110px",
                    }}
                  >
                    จัดการ
                  </th>
                </tr>
                <tr style={{ background: "#475569", color: "#fff", fontSize: "12px" }}>
                  {/* รอบ 1 */}
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๑</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๒</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๓</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๔</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๕</th>
                  {/* รอบ 2 */}
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๑</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๒</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๓</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๔</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ ๕</th>
                  {/* รอบชิง: 3-2-1-1-2-3 */}
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#fef08a" }}>ลู่ ๑ (ที่ ๓-๑)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#fef08a" }}>ลู่ ๒ (ที่ ๒-๑)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#fef08a" }}>ลู่ ๓ (ที่ ๑-๑)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#a7f3d0" }}>ลู่ ๔ (ที่ ๑-๒)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#a7f3d0" }}>ลู่ ๕ (ที่ ๒-๒)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#a7f3d0" }}>ลู่ ๖ (ที่ ๓-๒)</th>
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

                    {/* รอบ 1: ลู่ 1-5 (คลิกเพื่อเปิด Modal กรอกอันดับ/ฟาล์ว) */}
                    {item.r1.map((schoolName, idx) => {
                      const lane = item.r1Lanes?.[idx];
                      const isFoul = lane?.isFoul;
                      const rank = lane?.rank;
                      return (
                        <td
                          key={`r1-${idx}`}
                          onClick={() => openCellModal(item.id, "r1", idx)}
                          title="คลิกเพื่อบันทึกอันดับ หรือแจ้งฟาล์ว"
                          style={{
                            padding: "4px",
                            borderRight: "1px solid #e2e8f0",
                            background: isFoul
                              ? "#fee2e2"
                              : rank === "1"
                                ? "#fef08a"
                                : rank === "2"
                                  ? "#e2e8f0"
                                  : rank === "3"
                                    ? "#ffedd5"
                                    : schoolName
                                      ? "#eff6ff"
                                      : "transparent",
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          {schoolName ? (
                            <div
                              style={{
                                fontWeight: 600,
                                color: isFoul ? "#b91c1c" : "#1e3a8a",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "115px",
                                margin: "0 auto",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "3px",
                              }}
                            >
                              <span>{getDisplaySchoolName(schoolName)}</span>
                              {isFoul ? (
                                <span style={{ background: "#dc2626", color: "#fff", padding: "1px 4px", borderRadius: "3px", fontSize: "10px", fontWeight: 700 }}>
                                  ฟาล์ว
                                </span>
                              ) : rank ? (
                                <span
                                  style={{
                                    background: rank === "1" ? "#ca8a04" : rank === "2" ? "#475569" : "#c2410c",
                                    color: "#fff",
                                    padding: "1px 4px",
                                    borderRadius: "3px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                  }}
                                >
                                  {rank === "1" ? "ที่ ๑" : rank === "2" ? "ที่ ๒" : rank === "3" ? "ที่ ๓" : `ที่ ${rank}`}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>+ จัดลู่</span>
                          )}
                        </td>
                      );
                    })}

                    {/* รอบ 2: ลู่ 1-5 (คลิกเพื่อเปิด Modal กรอกอันดับ/ฟาล์ว) */}
                    {item.r2.map((schoolName, idx) => {
                      const lane = item.r2Lanes?.[idx];
                      const isFoul = lane?.isFoul;
                      const rank = lane?.rank;
                      return (
                        <td
                          key={`r2-${idx}`}
                          onClick={() => openCellModal(item.id, "r2", idx)}
                          title="คลิกเพื่อบันทึกอันดับ หรือแจ้งฟาล์ว"
                          style={{
                            padding: "4px",
                            borderRight: "1px solid #e2e8f0",
                            background: isFoul
                              ? "#fee2e2"
                              : rank === "1"
                                ? "#fef08a"
                                : rank === "2"
                                  ? "#e2e8f0"
                                  : rank === "3"
                                    ? "#ffedd5"
                                    : schoolName
                                      ? "#eff6ff"
                                      : "transparent",
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          {schoolName ? (
                            <div
                              style={{
                                fontWeight: 600,
                                color: isFoul ? "#b91c1c" : "#1e3a8a",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "115px",
                                margin: "0 auto",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "3px",
                              }}
                            >
                              <span>{getDisplaySchoolName(schoolName)}</span>
                              {isFoul ? (
                                <span style={{ background: "#dc2626", color: "#fff", padding: "1px 4px", borderRadius: "3px", fontSize: "10px", fontWeight: 700 }}>
                                  ฟาล์ว
                                </span>
                              ) : rank ? (
                                <span
                                  style={{
                                    background: rank === "1" ? "#ca8a04" : rank === "2" ? "#475569" : "#c2410c",
                                    color: "#fff",
                                    padding: "1px 4px",
                                    borderRadius: "3px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                  }}
                                >
                                  {rank === "1" ? "ที่ ๑" : rank === "2" ? "ที่ ๒" : rank === "3" ? "ที่ ๓" : `ที่ ${rank}`}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>+ จัดลู่</span>
                          )}
                        </td>
                      );
                    })}

                    {/* รอบชิงชนะเลิศ: ลู่ 1-6 (คลิกเพื่อเปิด Modal กรอกอันดับ/ฟาล์ว/เหรียญ) */}
                    {item.r3.map((schoolName, idx) => {
                      const lane = item.r3Lanes?.[idx];
                      const isFoul = lane?.isFoul;
                      const rank = lane?.rank;
                      const isGold = rank === "1";
                      const isSilver = rank === "2";
                      const isBronze = rank === "3";
                      return (
                        <td
                          key={`r3-${idx}`}
                          onClick={() => openCellModal(item.id, "r3", idx)}
                          title="คลิกเพื่อบันทึกอันดับเหรียญรางวัล หรือแจ้งฟาล์ว"
                          style={{
                            padding: "4px",
                            borderRight: "1px solid #e2e8f0",
                            background: isFoul
                              ? "#fee2e2"
                              : isGold
                                ? "#fef08a"
                                : isSilver
                                  ? "#e2e8f0"
                                  : isBronze
                                    ? "#fed7aa"
                                    : schoolName
                                      ? "#f0fdf4"
                                      : "transparent",
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          {schoolName ? (
                            <div
                              style={{
                                fontWeight: 700,
                                color: isFoul
                                  ? "#b91c1c"
                                  : isGold
                                    ? "#854d0e"
                                    : isSilver
                                      ? "#334155"
                                      : isBronze
                                        ? "#9a3412"
                                        : "#14532d",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: "115px",
                                margin: "0 auto",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "3px",
                              }}
                            >
                              <span>{getDisplaySchoolName(schoolName)}</span>
                              {isFoul ? (
                                <span style={{ background: "#dc2626", color: "#fff", padding: "1px 4px", borderRadius: "3px", fontSize: "10px", fontWeight: 700 }}>
                                  ฟาล์ว
                                </span>
                              ) : isGold ? (
                                <span>🥇</span>
                              ) : isSilver ? (
                                <span>🥈</span>
                              ) : isBronze ? (
                                <span>🥉</span>
                              ) : rank ? (
                                <span style={{ fontSize: "10px", color: "#64748b" }}>({rank})</span>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "11px" }}>-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Actions: Switch to Registration Tab */}
                    <td style={{ padding: "6px" }}>
                      <button
                        type="button"
                        className="ui-button-outline ui-button-sm"
                        style={{
                          fontSize: "12px",
                          padding: "4px 8px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "#0f766e",
                          borderColor: "#0f766e",
                        }}
                        onClick={() => {
                          setActiveEventId(item.id);
                          setSubTab("register");
                        }}
                      >
                        <Edit3 size={13} /> จัดลู่
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ==================== TAB 3: SUMMARY & SCORE REPORT ===================== */}
      {/* ========================================================================= */}
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
                { rank: 1, athleteName: r.r3Lanes?.[0]?.athleteName || "", schoolName: r.r3Lanes?.[0]?.schoolName || "", score: 3, time: r.r3Lanes?.[0]?.time || "" },
                { rank: 2, athleteName: r.r3Lanes?.[1]?.athleteName || "", schoolName: r.r3Lanes?.[1]?.schoolName || "", score: 2, time: r.r3Lanes?.[1]?.time || "" },
                { rank: 3, athleteName: r.r3Lanes?.[2]?.athleteName || "", schoolName: r.r3Lanes?.[2]?.schoolName || "", score: 1, time: r.r3Lanes?.[2]?.time || "" },
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
                        <th style={{ padding: "4px", width: "65px" }}>สถิติ/เวลา</th>
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
                            <td style={{ padding: "5px 4px", textAlign: "left", fontWeight: 500 }}>
                              {w?.schoolName ? getDisplaySchoolName(w.schoolName) : "-"}
                            </td>
                            <td style={{ padding: "5px 4px", fontWeight: 700 }}>
                              {rank === 1 ? "๓" : rank === 2 ? "๒" : "๑"}
                            </td>
                            <td style={{ padding: "5px 4px", color: "#64748b" }}>
                              {w?.time || "-"}
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
                        <td style={{ padding: "8px", textAlign: "left", fontWeight: 600 }}>
                          {s.schoolName}
                        </td>
                        <td style={{ padding: "8px", fontWeight: 700, color: "#be185d", fontSize: "15px" }}>
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

      {/* ========================================================================= */}
      {/* ==================== MODAL: บันทึกผล อันดับ และ ฟาล์ว ==================== */}
      {/* ========================================================================= */}
      {cellModal && (() => {
        const modalRow = rows.find((r) => r.id === cellModal.rowId);
        if (!modalRow) return null;
        const roundTitle =
          cellModal.roundKey === "r1"
            ? "รอบ ๑ (๕ ลู่)"
            : cellModal.roundKey === "r2"
              ? "รอบ ๒ (๕ ลู่)"
              : "รอบชิงชนะเลิศ (๖ ลู่)";

        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(4px)",
              zIndex: 10000,
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
                maxWidth: "500px",
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)",
                border: "1px solid #cbd5e1",
                overflow: "hidden",
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
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "6px" }}>
                    บันทึกผลการแข่งขันและสถานะฟาล์ว
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    รายการที่ {modalRow.no}: {modalRow.name} ({modalRow.grade} {modalRow.type})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCellModal(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Round & Lane Banner */}
                <div
                  style={{
                    background: cellModal.roundKey === "r3" ? "#fefce8" : "#f0fdf4",
                    border: `1px solid ${cellModal.roundKey === "r3" ? "#fef08a" : "#bbf7d0"}`,
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: cellModal.roundKey === "r3" ? "#854d0e" : "#166534",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{roundTitle}</span>
                  <span>ลู่ที่ {cellModal.subIndex + 1}</span>
                </div>

                {/* School Selection */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    โรงเรียนประจำลู่:
                  </label>
                  <select
                    value={cellModal.schoolName}
                    onChange={(e) => setCellModal({ ...cellModal, schoolName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                    }}
                  >
                    <option value="">-- เลือกโรงเรียน --</option>
                    {schoolOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Athlete Name */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    ชื่อ - นามสกุล นักกีฬา (ถ้ามี):
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ด.ช.สมชาย มุ่งมั่น"
                    value={cellModal.athleteName}
                    onChange={(e) => setCellModal({ ...cellModal, athleteName: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                    }}
                  />
                </div>

                {/* Foul Status Box */}
                <div
                  style={{
                    background: cellModal.isFoul ? "#fee2e2" : "#f8fafc",
                    border: `1.5px solid ${cellModal.isFoul ? "#ef4444" : "#e2e8f0"}`,
                    padding: "12px",
                    borderRadius: "8px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: cellModal.isFoul ? "#b91c1c" : "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={cellModal.isFoul}
                      onChange={(e) =>
                        setCellModal({
                          ...cellModal,
                          isFoul: e.target.checked,
                          rank: e.target.checked ? "DQ" : "",
                        })
                      }
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <AlertTriangle size={16} color={cellModal.isFoul ? "#dc2626" : "#64748b"} />
                    ฟาล์ว (ผิดกติกา / ปรับแพ้ฟาล์ว DQ)
                  </label>

                  {cellModal.isFoul && (
                    <div style={{ marginTop: "8px" }}>
                      <select
                        value={cellModal.foulReason}
                        onChange={(e) => setCellModal({ ...cellModal, foulReason: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          border: "1px solid #fca5a5",
                          fontSize: "13px",
                          background: "#fff",
                        }}
                      >
                        <option value="เหยียบเส้น/ล้ำลู่">เหยียบเส้น / ล้ำลู่</option>
                        <option value="ออกตัวก่อนปล่อยสัญญาณ (False Start)">ออกตัวก่อนปล่อยสัญญาณ (False Start)</option>
                        <option value="ทำไม้หล่น (วิ่งผลัด)">ทำไม้หล่น (วิ่งผลัด)</option>
                        <option value="วิ่งตัดหน้า/กีดขวางคู่แข่ง">วิ่งตัดหน้า / กีดขวางคู่แข่ง</option>
                        <option value="ผิดกติกาการแข่งขัน">ผิดกติกาการแข่งขันทั่วไป</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Finish Rank (Disabled if foul) */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    อันดับเข้าเส้นชัย:
                  </label>
                  <select
                    disabled={cellModal.isFoul}
                    value={cellModal.isFoul ? "DQ" : cellModal.rank}
                    onChange={(e) => setCellModal({ ...cellModal, rank: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: cellModal.rank ? 700 : 400,
                      background: cellModal.isFoul ? "#f1f5f9" : "#fff",
                      color:
                        cellModal.rank === "1"
                          ? "#ca8a04"
                          : cellModal.rank === "2"
                            ? "#475569"
                            : cellModal.rank === "3"
                              ? "#c2410c"
                              : "#1e293b",
                    }}
                  >
                    <option value="">-- ยังไม่ระบุอันดับ --</option>
                    {cellModal.roundKey === "r3" ? (
                      <>
                        <option value="1">🥇 ที่ ๑ (เหรียญทอง · ๓ แต้ม)</option>
                        <option value="2">🥈 ที่ ๒ (เหรียญเงิน · ๒ แต้ม)</option>
                        <option value="3">🥉 ที่ ๓ (เหรียญทองแดง · ๑ แต้ม)</option>
                        <option value="4">ที่ ๔</option>
                        <option value="5">ที่ ๕</option>
                        <option value="6">ที่ ๖</option>
                      </>
                    ) : (
                      <>
                        <option value="1">ที่ ๑ (เข้ารอบชิง)</option>
                        <option value="2">ที่ ๒ (เข้ารอบชิง)</option>
                        <option value="3">ที่ ๓ (เข้ารอบชิง)</option>
                        <option value="4">ที่ ๔</option>
                        <option value="5">ที่ ๕</option>
                      </>
                    )}
                  </select>
                  {cellModal.roundKey !== "r3" && !cellModal.isFoul && (
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#0f766e" }}>
                      *หากระบุอันดับ ๑, ๒, ๓ ระบบจะจัดลู่รอบชิงชนะเลิศ (3-2-1-1-2-3) ให้อัตโนมัติ
                    </p>
                  )}
                </div>

                {/* Time / Mark (Optional) */}
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    สถิติเวลา/ผล (ถ้ามี):
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น 12.45 วิ"
                    value={cellModal.time}
                    onChange={(e) => setCellModal({ ...cellModal, time: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  padding: "12px 18px",
                  background: "#f8fafc",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  className="ui-button-outline"
                  onClick={() => setCellModal(null)}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSaveCellModal}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#0f766e",
                  }}
                >
                  <Save size={15} /> บันทึกผล
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
