"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ClipboardList,
  Edit3,
  Trash2,
  AlertTriangle,
  Plus,
  Eye,
  X,
} from "lucide-react";

export type LaneEntry = {
  lane: number;
  schoolName: string; // ชื่อโรงเรียน เช่น โรงเรียนบ้านหนองแดน
  athleteName: string; // ชื่อ-สกุล นักกีฬา
  time?: string; // สถิติเวลา/ผล (ถ้ามี)
  rank?: string; // "1", "2", "3", "4", "5", "6", ..., "DQ"
  isFoul?: boolean; // ฟาล์วหรือไม่
  foulReason?: string; // รายละเอียดฟาล์ว (ถ้ามี)
};

export type WinnerEntry = {
  rank: number;
  athleteName: string;
  schoolName: string;
  score: number;
  time?: string;
};

export type AthleticsRow = {
  id: number;
  no: string;
  sourceNumber?: number;
  name: string;
  grade: string;
  type: string;
  directFinal?: boolean; // แข่งรอบชิงชนะเลิศทันที (มินิมาราธอน 1-4)
  expandableLanes?: boolean; // สามารถกดเพิ่มลู่ได้เรื่อยๆ (มินิมาราธอน ที่แต่ละโรงเรียนส่งได้มากกว่า 1 คน)
  r1: string[]; // 5 lanes (ชื่อโรงเรียน)
  r2: string[]; // 5 lanes (ชื่อโรงเรียน)
  r3: string[]; // 6+ lanes (finals) (ชื่อโรงเรียน)
  r1Lanes: LaneEntry[];
  r2Lanes: LaneEntry[];
  r3Lanes: LaneEntry[];
  winners?: WinnerEntry[];
};

export type SchoolAthleticsStanding = {
  schoolName: string;
  gold: number;
  silver: number;
  bronze: number;
  totalScore: number;
  place: number;
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

export const FOUL_REASONS = [
  "เหยียบเส้น / ล้ำลู่",
  "ออกตัวก่อนปล่อยสัญญาณ (False Start)",
  "ทำไม้หล่น / ส่งไม้ผิดกติกา",
  "วิ่งตัดหน้า / กีดขวางคู่แข่ง",
  "ผิดกติกาการแข่งขันทั่วไป",
];

export function getDisplaySchoolName(fullName: string): string {
  if (!fullName) return "";
  return fullName.replace(/^โรงเรียน/, "").trim();
}

export function defaultLanes(count: number): LaneEntry[] {
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

// ข้อมูลรายการกรีฑาตามสูจิบัตร นครโกสัมพีเกมส์ 2569 (ใช้เลขอารบิกทั้งหมด)
export const INITIAL_ATHLETICS_DATA: AthleticsRow[] = [
  { id: 1, no: "1", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "ชาย", directFinal: true, expandableLanes: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 2, no: "2", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "หญิง", directFinal: true, expandableLanes: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 3, no: "3", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "ชาย", directFinal: true, expandableLanes: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 4, no: "4", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "หญิง", directFinal: true, expandableLanes: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 5, no: "5", sourceNumber: 106, name: "วิ่ง 50 เมตร", grade: "อนุบาล", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 6, no: "6", sourceNumber: 107, name: "วิ่ง 50 เมตร", grade: "อนุบาล", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 7, no: "7", sourceNumber: 112, name: "วิ่ง 80 เมตร", grade: "อนุบาล", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 8, no: "8", sourceNumber: 113, name: "วิ่ง 80 เมตร", grade: "อนุบาล", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 9, no: "9", sourceNumber: 118, name: "วิ่ง 60 เมตร", grade: "ป.1-3", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 10, no: "10", sourceNumber: 119, name: "วิ่ง 60 เมตร", grade: "ป.1-3", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 11, no: "11", sourceNumber: 124, name: "วิ่ง 100 เมตร", grade: "ป.1-3", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 12, no: "12", sourceNumber: 125, name: "วิ่ง 100 เมตร", grade: "ป.1-3", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 13, no: "13", sourceNumber: 130, name: "วิ่ง 100 เมตร", grade: "ป.4-6", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 14, no: "14", sourceNumber: 131, name: "วิ่ง 100 เมตร", grade: "ป.4-6", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 15, no: "15", sourceNumber: 132, name: "วิ่ง 100 เมตร", grade: "ม.1-3", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 16, no: "16", sourceNumber: 133, name: "วิ่ง 100 เมตร", grade: "ม.1-3", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 17, no: "17", sourceNumber: 138, name: "วิ่ง 200 เมตร", grade: "ป.4-6", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 18, no: "18", sourceNumber: 139, name: "วิ่ง 200 เมตร", grade: "ป.4-6", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 19, no: "19", sourceNumber: 140, name: "วิ่ง 200 เมตร", grade: "ม.1-3", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 20, no: "20", sourceNumber: 141, name: "วิ่ง 200 เมตร", grade: "ม.1-3", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
];

/**
 * เพิ่มลู่วิ่งใหม่ต่อท้ายในรอบที่กำหนด (สำหรับรายการมินิมาราธอนที่กดเพิ่มลู่ได้เรื่อยๆ)
 */
export function addLaneToEventRound(
  row: AthleticsRow,
  roundKey: "r1" | "r2" | "r3" = "r3",
): AthleticsRow {
  const lanesKey =
    roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
  const currentLanes = [...(row[lanesKey] || [])];
  const nextLaneNumber = currentLanes.length + 1;
  const newLane: LaneEntry = {
    lane: nextLaneNumber,
    schoolName: "",
    athleteName: "",
    time: "",
    rank: "",
    isFoul: false,
    foulReason: "",
  };
  const updatedLanes = [...currentLanes, newLane];
  const updatedCells = [...(row[roundKey] || []), ""];

  return {
    ...row,
    [lanesKey]: updatedLanes,
    [roundKey]: updatedCells,
  };
}

/**
 * ลบลู่วิ่งตามลำดับ index และจัดเรียงเลขลู่ 1..N ใหม่อัตโนมัติ
 */
export function removeLaneFromEventRound(
  row: AthleticsRow,
  roundKey: "r1" | "r2" | "r3",
  laneIndex: number,
): AthleticsRow {
  const lanesKey =
    roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
  const currentLanes = [...(row[lanesKey] || [])];
  if (currentLanes.length <= 1) return row;

  const filteredLanes = currentLanes
    .filter((_, idx) => idx !== laneIndex)
    .map((l, idx) => ({
      ...l,
      lane: idx + 1,
    }));
  const updatedCells = filteredLanes.map((l) => l.schoolName || "");

  const updatedRow: AthleticsRow = {
    ...row,
    [lanesKey]: filteredLanes,
    [roundKey]: updatedCells,
  };

  if (roundKey === "r3") {
    updatedRow.winners = computeFinalsWinners(filteredLanes);
  }

  return updatedRow;
}

/**
 * ป้องกันอันดับซ้ำในรอบเดียวกัน:
 * หากตั้งอันดับ (เช่น "1", "2", "3", "4", "5", "6") ให้กับ targetLaneIdx
 * ลู่อื่นในรอบเดียวกันที่เคยถือครองอันดับนั้นจะถูกล้าง rank เป็น "" อัตโนมัติ
 */
export function assignUniqueRankInLanes(
  lanes: LaneEntry[],
  targetLaneIdx: number,
  newRank: string,
): LaneEntry[] {
  const cleanRank = newRank.trim();
  return lanes.map((lane, idx) => {
    if (idx === targetLaneIdx) {
      const isFoul = cleanRank === "DQ" ? true : lane.isFoul;
      return {
        ...lane,
        rank: cleanRank,
        isFoul,
      };
    }
    if (cleanRank && cleanRank !== "DQ" && lane.rank === cleanRank) {
      return {
        ...lane,
        rank: "",
      };
    }
    return lane;
  });
}

/**
 * คำนวณผู้ชนะเหรียญรางวัล (อันดับ 1, 2, 3) จากข้อมูลลู่วิ่งในรอบชิงชนะเลิศ (`r3Lanes`)
 */
export function computeFinalsWinners(r3Lanes: LaneEntry[]): WinnerEntry[] {
  return [1, 2, 3].map((rankNum) => {
    const matchingLane = r3Lanes.find(
      (l) =>
        !l.isFoul &&
        Boolean(l.schoolName) &&
        (l.rank === String(rankNum) || l.rank === `ที่ ${rankNum}`),
    );
    return {
      rank: rankNum,
      athleteName: matchingLane?.athleteName || "",
      schoolName: matchingLane?.schoolName || "",
      score: matchingLane?.schoolName ? (rankNum === 1 ? 3 : rankNum === 2 ? 2 : 1) : 0,
      time: matchingLane?.time || "",
    };
  });
}

/**
 * ส่งผู้เข้ารอบ 1, 2, 3 จากรอบ 1 และ รอบ 2 ไปจัดลู่รอบชิงชนะเลิศ (เรียงลู่ 3, 2, 1, 1, 2, 3)
 */
export function syncQualifiersToFinals(row: AthleticsRow): {
  row: AthleticsRow;
  newlyAdvanced: boolean;
} {
  if (row.directFinal) {
    return { row, newlyAdvanced: false };
  }

  const nextR3Lanes = [...row.r3Lanes];
  const nextR3Cells = [...row.r3];

  const findQualifier = (lanes: LaneEntry[], targetRank: string) => {
    return lanes.find(
      (l) =>
        !l.isFoul &&
        Boolean(l.schoolName) &&
        (l.rank === targetRank || l.rank === `ที่ ${targetRank}`),
    );
  };

  const r1First = findQualifier(row.r1Lanes, "1");
  const r1Second = findQualifier(row.r1Lanes, "2");
  const r1Third = findQualifier(row.r1Lanes, "3");

  const r2First = findQualifier(row.r2Lanes, "1");
  const r2Second = findQualifier(row.r2Lanes, "2");
  const r2Third = findQualifier(row.r2Lanes, "3");

  // Seeding order across lanes 1-6: 3, 2, 1, 1, 2, 3
  const mapping: [number, LaneEntry | undefined][] = [
    [0, r1Third],  // ลู่ 1: อันดับ 3 รอบ 1
    [1, r1Second], // ลู่ 2: อันดับ 2 รอบ 1
    [2, r1First],  // ลู่ 3: อันดับ 1 รอบ 1
    [3, r2First],  // ลู่ 4: อันดับ 1 รอบ 2
    [4, r2Second], // ลู่ 5: อันดับ 2 รอบ 2
    [5, r2Third],  // ลู่ 6: อันดับ 3 รอบ 2
  ];

  let newlyAdvanced = false;
  mapping.forEach(([targetLaneIdx, qualifier]) => {
    const prevLane = nextR3Lanes[targetLaneIdx];
    if (qualifier && qualifier.schoolName) {
      const changed =
        prevLane.schoolName !== qualifier.schoolName ||
        prevLane.athleteName !== (qualifier.athleteName || "");
      if (changed) {
        newlyAdvanced = true;
      }
      nextR3Lanes[targetLaneIdx] = {
        ...prevLane,
        lane: targetLaneIdx + 1,
        schoolName: qualifier.schoolName,
        athleteName: qualifier.athleteName || "",
        isFoul: changed ? false : prevLane.isFoul,
        foulReason: changed ? "" : prevLane.foulReason,
        rank: changed ? "" : prevLane.rank || "",
        time: changed ? "" : prevLane.time || "",
      };
      nextR3Cells[targetLaneIdx] = qualifier.schoolName;
    } else {
      nextR3Lanes[targetLaneIdx] = {
        lane: targetLaneIdx + 1,
        schoolName: "",
        athleteName: "",
        time: "",
        rank: "",
        isFoul: false,
        foulReason: "",
      };
      nextR3Cells[targetLaneIdx] = "";
    }
  });

  const winners = computeFinalsWinners(nextR3Lanes);

  return {
    row: {
      ...row,
      r3Lanes: nextR3Lanes,
      r3: nextR3Cells,
      winners,
    },
    newlyAdvanced,
  };
}

/**
 * คำนวณตารางคะแนนรวมกรีฑาของทุกโรงเรียน พร้อมจำนวนเหรียญ ทอง/เงิน/ทองแดง
 * และจัดอันดับด้วยกฎ Tie-break: คะแนนรวม > เหรียญทอง > เหรียญเงิน > เหรียญทองแดง > ชื่อโรงเรียน
 */
export function calculateSchoolAthleticsStandings(
  rows: AthleticsRow[],
): SchoolAthleticsStanding[] {
  const statsMap: Record<
    string,
    { gold: number; silver: number; bronze: number; totalScore: number }
  > = {};

  rows.forEach((r) => {
    const winners = r.winners || computeFinalsWinners(r.r3Lanes || []);
    winners.forEach((w) => {
      if (!w.schoolName) return;
      if (!statsMap[w.schoolName]) {
        statsMap[w.schoolName] = { gold: 0, silver: 0, bronze: 0, totalScore: 0 };
      }
      const entry = statsMap[w.schoolName];
      if (w.rank === 1) {
        entry.gold += 1;
        entry.totalScore += 3;
      } else if (w.rank === 2) {
        entry.silver += 1;
        entry.totalScore += 2;
      } else if (w.rank === 3) {
        entry.bronze += 1;
        entry.totalScore += 1;
      }
    });
  });

  const sorted = Object.entries(statsMap)
    .map(([schoolName, s]) => ({
      schoolName,
      ...s,
      place: 1,
    }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return a.schoolName.localeCompare(b.schoolName, "th");
    });

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      sorted[i].place = 1;
    } else {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (
        curr.totalScore === prev.totalScore &&
        curr.gold === prev.gold &&
        curr.silver === prev.silver &&
        curr.bronze === prev.bronze
      ) {
        curr.place = prev.place;
      } else {
        curr.place = i + 1;
      }
    }
  }

  return sorted;
}

type RoundModalData = {
  rowId: number;
  roundKey: "r1" | "r2" | "r3";
  focusedLaneIdx: number;
  lanes: LaneEntry[];
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
  const [activeRound, setActiveRound] = useState<"r1" | "r2" | "r3">("r3");
  const [toast, setToast] = useState<string | null>(null);

  // Modal สำหรับบันทึกผลทั้งฮีต/รอบ
  const [roundModal, setRoundModal] = useState<RoundModalData | null>(null);

  // Modal แสดงตัวอย่างก่อนพิมพ์ A4 แนวตั้ง (Print Preview)
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Available school list (database prop or fallback)
  const schoolOptions =
    schools && schools.length > 0
      ? schools.map((s) => s.name)
      : DEFAULT_SCHOOLS;

  // Load from localStorage preview & preserve any extra added lanes in Mini Marathon
  useEffect(() => {
    try {
      const saved = localStorage.getItem("nkg2569_athletics_preview");
      if (saved) {
        const parsed: AthleticsRow[] = JSON.parse(saved);
        const canonicalById = new Map(
          INITIAL_ATHLETICS_DATA.map((item) => [item.id, item]),
        );
        const updated = INITIAL_ATHLETICS_DATA.map((canonical) => {
          const found = parsed.find((p) => p.id === canonical.id);
          if (!found) return canonical;
          const r3Lanes =
            found.r3Lanes && found.r3Lanes.length > 0
              ? found.r3Lanes.map((l, idx) => ({ ...l, lane: idx + 1 }))
              : defaultLanes(6);
          const r3 = r3Lanes.map((l, idx) => l.schoolName || found.r3?.[idx] || "");
          return {
            ...canonical,
            ...found,
            no: canonical.no,
            name: canonical.name,
            grade: canonical.grade,
            type: canonical.type,
            sourceNumber: canonical.sourceNumber,
            directFinal: canonical.directFinal,
            expandableLanes: canonical.expandableLanes,
            r1Lanes: found.r1Lanes || defaultLanes(5),
            r2Lanes: found.r2Lanes || defaultLanes(5),
            r3Lanes,
            r3,
            winners: computeFinalsWinners(r3Lanes),
          };
        }).filter((item) => canonicalById.has(item.id));
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

  // สั่งพิมพ์จากหน้าต่างตัวอย่าง A4 แนวตั้ง ด้วย iframe เฉพาะ ताकिได้กระดาษ A4 แนวตั้งที่สะอาด 100%
  function executeA4PortraitPrint() {
    if (!previewContainerRef.current) {
      window.print();
      return;
    }
    const htmlContent = previewContainerRef.current.innerHTML;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <title>รายงานสรุปผลการแข่งขันกรีฑา - นครโกสัมพีเกมส์ 2569</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: "Sarabun", "TH SarabunPSK", sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .a4-sheet {
      width: 100% !important;
      min-height: auto !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      page-break-after: always;
      break-after: page;
    }
    .a4-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .sheet-badge {
      display: none !important;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }

  // Active event object
  const activeEvent = rows.find((r) => r.id === activeEventId) || rows[0];

  // หากเลือกรายการที่เป็น directFinal ให้บังคับอยู่รอบชิงชนะเลิศ (r3) เสมอ
  useEffect(() => {
    if (activeEvent?.directFinal && activeRound !== "r3") {
      setActiveRound("r3");
    }
  }, [activeEvent?.id, activeEvent?.directFinal, activeRound]);

  // กดเพิ่มลู่ในหน้าลงทะเบียน (สำหรับมินิมาราธอน)
  function handleAddLane(targetRowId: number, roundKey: "r1" | "r2" | "r3" = "r3") {
    const nextRows = rows.map((r) => {
      if (r.id !== targetRowId) return r;
      return addLaneToEventRound(r, roundKey);
    });
    const updatedTarget = nextRows.find((r) => r.id === targetRowId);
    const totalLanes = updatedTarget?.r3Lanes.length || 6;
    saveRows(nextRows, `เพิ่มลู่ที่ ${totalLanes} เรียบร้อยแล้ว`);
  }

  // กดลบลู่ในหน้าลงทะเบียน (สำหรับมินิมาราธอน)
  function handleRemoveLane(
    targetRowId: number,
    roundKey: "r1" | "r2" | "r3",
    laneIndex: number,
  ) {
    const nextRows = rows.map((r) => {
      if (r.id !== targetRowId) return r;
      return removeLaneFromEventRound(r, roundKey, laneIndex);
    });
    saveRows(nextRows, `ลบลู่ที่ ${laneIndex + 1} และจัดลำดับลู่ใหม่เรียบร้อย`);
  }

  // Update a single lane in the active event (Registration Tab)
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

    const roundCells = [...activeEvent[roundKey]];
    if (field === "schoolName") {
      roundCells[index] = val;
    }

    let updatedEvent: AthleticsRow = {
      ...activeEvent,
      [lanesKey]: currentLanes,
      [roundKey]: roundCells,
    };

    if (roundKey === "r3") {
      updatedEvent.winners = computeFinalsWinners(currentLanes);
    } else {
      updatedEvent = syncQualifiersToFinals(updatedEvent).row;
    }

    const nextRows = rows.map((r) => (r.id === activeEvent.id ? updatedEvent : r));
    saveRows(nextRows);
  }

  // Open Modal from cell click in the scoresheet
  function openCellModal(rowId: number, roundKey: "r1" | "r2" | "r3", subIndex: number) {
    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;
    if (targetRow.directFinal && roundKey !== "r3") {
      return;
    }
    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const defaultCount = roundKey === "r3" ? 6 : 5;
    const sourceLanes =
      targetRow[lanesKey] && targetRow[lanesKey].length > 0
        ? targetRow[lanesKey]
        : defaultLanes(defaultCount);
    const count = Math.max(sourceLanes.length, defaultCount);

    const clonedLanes: LaneEntry[] = Array.from({ length: count }, (_, idx) => {
      const existing = sourceLanes[idx];
      return {
        lane: idx + 1,
        schoolName: existing?.schoolName || targetRow[roundKey]?.[idx] || "",
        athleteName: existing?.athleteName || "",
        rank: existing?.rank || "",
        isFoul: !!existing?.isFoul,
        foulReason: existing?.foulReason || FOUL_REASONS[0],
        time: existing?.time || "",
      };
    });

    setRoundModal({
      rowId,
      roundKey,
      focusedLaneIdx: subIndex,
      lanes: clonedLanes,
    });
  }

  // เพิ่มลู่วิ่งจากใน Modal (สำหรับมินิมาราธอน)
  function addModalLane() {
    if (!roundModal) return;
    const nextLaneNum = roundModal.lanes.length + 1;
    const nextLanes: LaneEntry[] = [
      ...roundModal.lanes,
      {
        lane: nextLaneNum,
        schoolName: "",
        athleteName: "",
        rank: "",
        isFoul: false,
        foulReason: FOUL_REASONS[0],
        time: "",
      },
    ];
    setRoundModal({
      ...roundModal,
      focusedLaneIdx: nextLanes.length - 1,
      lanes: nextLanes,
    });
  }

  // ลบลู่วิ่งจากใน Modal (สำหรับมินิมาราธอน)
  function removeModalLane(laneIdx: number) {
    if (!roundModal || roundModal.lanes.length <= 1) return;
    const nextLanes = roundModal.lanes
      .filter((_, idx) => idx !== laneIdx)
      .map((l, idx) => ({ ...l, lane: idx + 1 }));
    setRoundModal({
      ...roundModal,
      focusedLaneIdx: Math.min(roundModal.focusedLaneIdx, nextLanes.length - 1),
      lanes: nextLanes,
    });
  }

  // Update a lane inside the modal (with automatic duplicate rank prevention)
  function updateModalLane(
    laneIdx: number,
    patch: Partial<LaneEntry>,
  ) {
    if (!roundModal) return;
    let nextLanes = roundModal.lanes.map((l, idx) =>
      idx === laneIdx ? { ...l, ...patch } : l,
    );

    if (patch.rank !== undefined) {
      nextLanes = assignUniqueRankInLanes(nextLanes, laneIdx, patch.rank);
    }

    if (patch.isFoul === true) {
      nextLanes[laneIdx] = {
        ...nextLanes[laneIdx],
        isFoul: true,
        rank: "DQ",
        foulReason: nextLanes[laneIdx].foulReason || FOUL_REASONS[0],
      };
    } else if (patch.isFoul === false) {
      nextLanes[laneIdx] = {
        ...nextLanes[laneIdx],
        isFoul: false,
        rank: nextLanes[laneIdx].rank === "DQ" ? "" : nextLanes[laneIdx].rank,
      };
    }

    setRoundModal({
      ...roundModal,
      focusedLaneIdx: laneIdx,
      lanes: nextLanes,
    });
  }

  // Save all lanes in the modal and auto-seed qualifiers to finals (3-2-1-1-2-3)
  function handleSaveRoundModal() {
    if (!roundModal) return;
    const { rowId, roundKey, lanes } = roundModal;

    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;

    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const normalizedLanes = lanes.map((l, idx) => ({
      ...l,
      lane: idx + 1,
      rank: l.isFoul ? "DQ" : l.rank || "",
      foulReason: l.isFoul ? l.foulReason || FOUL_REASONS[0] : "",
    }));
    const updatedRoundCells = normalizedLanes.map((l) => l.schoolName || "");

    let updatedRow: AthleticsRow = {
      ...targetRow,
      [lanesKey]: normalizedLanes,
      [roundKey]: updatedRoundCells,
    };

    let autoAdvancedMsg: string | undefined = undefined;
    if (roundKey === "r1" || roundKey === "r2") {
      const synced = syncQualifiersToFinals(updatedRow);
      updatedRow = synced.row;
      if (synced.newlyAdvanced) {
        autoAdvancedMsg =
          "บันทึกผลและส่งผู้เข้ารอบ 1-3 เข้าสู่รอบชิงชนะเลิศ (เรียงลู่ 3-2-1-1-2-3) เรียบร้อย";
      }
    } else if (roundKey === "r3") {
      updatedRow = {
        ...updatedRow,
        winners: computeFinalsWinners(normalizedLanes),
      };
    }

    const roundLabel =
      roundKey === "r1" ? "รอบ 1" : roundKey === "r2" ? "รอบ 2" : "รอบชิงชนะเลิศ";
    const nextRows = rows.map((r) => (r.id === rowId ? updatedRow : r));
    saveRows(
      nextRows,
      autoAdvancedMsg || `บันทึกผลการแข่งขัน ${roundLabel} (รายการที่ ${targetRow.no}) เรียบร้อย`,
    );
    setRoundModal(null);
  }

  // Clear lanes in active round
  function clearRoundLanes(roundKey: "r1" | "r2" | "r3") {
    const label =
      roundKey === "r1" ? "รอบ 1" : roundKey === "r2" ? "รอบ 2" : "รอบชิงชนะเลิศ";
    if (!confirm(`ต้องการล้างข้อมูลลู่วิ่งใน ${label} ของรายการนี้หรือไม่?`)) return;

    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const count = roundKey === "r3" ? 6 : 5;
    const clearedLanes = defaultLanes(count);
    const clearedCells = Array(count).fill("");

    let updatedEvent: AthleticsRow = {
      ...activeEvent,
      [lanesKey]: clearedLanes,
      [roundKey]: clearedCells,
      winners: roundKey === "r3" ? computeFinalsWinners(clearedLanes) : activeEvent.winners,
    };

    if (roundKey === "r1" || roundKey === "r2") {
      updatedEvent = syncQualifiersToFinals(updatedEvent).row;
    }

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

  // Calculate school standings with medal breakdown and tie-breaker rules
  const rankedSchools = calculateSchoolAthleticsStandings(rows);

  // แบ่งหน้ากระดาษ A4 แนวตั้งสำหรับตัวอย่างก่อนพิมพ์ (หน้าละ 7 รายการ ตามสูจิบัตรหน้า 31-33 และหน้า 4 สรุปผลรวมตามสูจิบัตรหน้า 34)
  const a4EventPages: AthleticsRow[][] = [
    rows.slice(0, 7),
    rows.slice(7, 14),
    rows.slice(14),
  ].filter((page) => page.length > 0);

  const activeLanes =
    activeRound === "r1"
      ? activeEvent.r1Lanes
      : activeRound === "r2"
        ? activeEvent.r2Lanes
        : activeEvent.r3Lanes;

  // Duplicate school warning in current registration round (skip for Mini Marathon)
  const assignedSchoolsInActiveRound = activeLanes
    .map((l) => l.schoolName)
    .filter(Boolean);
  const duplicateSchoolsInActiveRound = activeEvent.expandableLanes
    ? []
    : Array.from(
        new Set(
          assignedSchoolsInActiveRound.filter(
            (name, idx) => assignedSchoolsInActiveRound.indexOf(name) !== idx,
          ),
        ),
      );

  return (
    <div className="athletics-container" style={{ marginTop: "1rem" }}>
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          .no-print, .athletics-subtabs {
            display: none !important;
          }
          .printable-area {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Toast Notification */}
      {toast && (
        <div
          className="no-print"
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
        className="athletics-subtabs no-print"
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
            <UserPlus size={16} /> 1. ลงทะเบียนและจัดลู่วิ่ง
          </button>
          <button
            type="button"
            className={subTab === "sheet" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("sheet")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ClipboardList size={16} /> 2. ใบบันทึกผลการแข่งขัน (ตาราง {rows.length} รายการ)
          </button>
          <button
            type="button"
            className={subTab === "summary" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("summary")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Trophy size={16} /> 3. สรุปผลและคะแนนกรีฑา
          </button>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          {subTab === "sheet" && (
            <button
              type="button"
              className="ui-button-outline ui-button-sm"
              onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Printer size={15} /> พิมพ์ตารางใบบันทึกผล (A4)
            </button>
          )}
          {subTab === "summary" && (
            <button
              type="button"
              className="primary ui-button-sm"
              onClick={() => setShowPrintPreview(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#0f766e",
              }}
            >
              <Eye size={15} /> พิมพ์รายงานสรุปผล (ตัวอย่าง A4 แนวตั้ง)
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
              เลือกลงทะเบียนนักกีฬาและจัดลู่วิ่งด้วย <strong>ชื่อโรงเรียน</strong> ในแต่ละรอบ (รอบ 1, รอบ 2, รอบชิงชนะเลิศ)
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
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    const nextEv = rows.find((r) => r.id === nextId);
                    setActiveEventId(nextId);
                    if (nextEv?.directFinal) {
                      setActiveRound("r3");
                    } else {
                      setActiveRound("r1");
                    }
                  }}
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
                      {r.expandableLanes
                        ? ` (เพิ่มลู่ได้ไม่จำกัด · ปัจจุบัน ${r.r3Lanes.length} ลู่)`
                        : r.directFinal
                          ? " (ชิงชนะเลิศทันที)"
                          : ""}
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
                  onClick={() => {
                    const nextId = Math.max(1, activeEventId - 1);
                    const nextEv = rows.find((r) => r.id === nextId);
                    setActiveEventId(nextId);
                    setActiveRound(nextEv?.directFinal ? "r3" : "r1");
                  }}
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <ArrowLeft size={14} /> รายการก่อนหน้า
                </button>
                <button
                  type="button"
                  className="ui-button-outline ui-button-sm"
                  disabled={activeEventId >= rows.length}
                  onClick={() => {
                    const nextId = Math.min(rows.length, activeEventId + 1);
                    const nextEv = rows.find((r) => r.id === nextId);
                    setActiveEventId(nextId);
                    setActiveRound(nextEv?.directFinal ? "r3" : "r1");
                  }}
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
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <span
                  style={{
                    background: "#0f766e",
                    color: "#fff",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  รายการที่ {activeEvent.no}
                </span>
                <strong style={{ fontSize: "15px", color: "#0f172a" }}>
                  {activeEvent.name}
                </strong>
                <span style={{ color: "#64748b", fontSize: "14px" }}>
                  (ระดับ {activeEvent.grade} · เพศ{activeEvent.type})
                </span>
                {activeEvent.expandableLanes ? (
                  <span
                    style={{
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #93c5fd",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    🏃 มินิมาราธอน: ส่งนักกีฬาได้มากกว่า 1 คน/โรงเรียน · กด "+ เพิ่มลู่" ได้เรื่อยๆ (ปัจจุบัน {activeEvent.r3Lanes.length} ลู่)
                  </span>
                ) : activeEvent.directFinal ? (
                  <span
                    style={{
                      background: "#fef9c3",
                      color: "#854d0e",
                      border: "1px solid #fde047",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    🏆 แข่งขันรอบชิงชนะเลิศทันที (ไม่มีรอบคัดเลือก)
                  </span>
                ) : null}
              </div>

              {/* Round Selector Pills */}
              <div style={{ display: "flex", gap: "6px" }}>
                {!activeEvent.directFinal && (
                  <>
                    <button
                      type="button"
                      className={activeRound === "r1" ? "primary" : "ui-button-outline ui-button-sm"}
                      onClick={() => setActiveRound("r1")}
                      style={{ fontSize: "13px" }}
                    >
                      🏃 รอบ 1 (5 ลู่)
                    </button>
                    <button
                      type="button"
                      className={activeRound === "r2" ? "primary" : "ui-button-outline ui-button-sm"}
                      onClick={() => setActiveRound("r2")}
                      style={{ fontSize: "13px" }}
                    >
                      🏃 รอบ 2 (5 ลู่)
                    </button>
                  </>
                )}
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
                  🏆 รอบชิงชนะเลิศ ({activeEvent.r3Lanes.length} ลู่)
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
              {activeEvent.expandableLanes ? (
                <>
                  🏃 <strong>วิ่งมินิมาราธอน:</strong> แต่ละโรงเรียนสามารถส่งนักกรีฑาได้มากกว่า 1 คน คลิกปุ่ม{" "}
                  <strong>"+ เพิ่มลู่ / นักกีฬา"</strong> เพื่อเพิ่มช่องลู่ได้เรื่อยๆ ไม่จำกัดจำนวน
                </>
              ) : activeEvent.directFinal ? (
                <>
                  🏆 <strong>รายการนี้แข่งขันรอบชิงชนะเลิศทันที:</strong> ลงทะเบียนชื่อโรงเรียนและนักกีฬาในรอบชิงชนะเลิศ (ลู่ 1-6) ได้โดยตรง
                </>
              ) : activeRound === "r3" ? (
                <>
                  🏆 <strong>รอบชิงชนะเลิศ (6 ลู่):</strong> ระบบจะดึงผู้ที่ได้อันดับ 1-3 จากรอบ 1 และ รอบ 2 มาจัดลู่ 3-2-1-1-2-3 ให้อัตโนมัติเมื่อบันทึกผลในใบบันทึกผล (หรือกำหนดเองได้ที่นี่)
                </>
              ) : (
                <>
                  📋 <strong>{activeRound === "r1" ? "รอบ 1 (5 ลู่)" : "รอบ 2 (5 ลู่)"}:</strong>{" "}
                  ลงทะเบียนชื่อโรงเรียนและนักกีฬาประจำลู่ 1-5 ในรายการนี้
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {activeEvent.expandableLanes && (
                <button
                  type="button"
                  className="ui-button-outline ui-button-sm"
                  onClick={() => handleAddLane(activeEvent.id, activeRound)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    borderColor: "#3b82f6",
                    fontSize: "13px",
                    padding: "5px 12px",
                    fontWeight: 700,
                  }}
                >
                  <Plus size={14} /> เพิ่มลู่ / นักกีฬา
                </button>
              )}
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

          {/* Duplicate school notice */}
          {duplicateSchoolsInActiveRound.length > 0 && (
            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #fdba74",
                color: "#9a3412",
                padding: "8px 14px",
                borderRadius: "8px",
                marginBottom: "14px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={16} color="#ea580c" />
              <span>
                <strong>ข้อสังเกต:</strong> มีการเลือกโรงเรียนซ้ำในรอบเดียวกัน ได้แก่{" "}
                <strong>{duplicateSchoolsInActiveRound.join(", ")}</strong>
              </span>
            </div>
          )}

          {/* Lane Assignment Form Table */}
          <div
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              overflowX: "auto",
              marginBottom: "14px",
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
                  {activeEvent.expandableLanes && (
                    <th style={{ padding: "10px", width: "75px", textAlign: "center" }}>
                      ลบลู่
                    </th>
                  )}
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

                    {activeEvent.expandableLanes && (
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        <button
                          type="button"
                          disabled={activeLanes.length <= 1}
                          onClick={() => handleRemoveLane(activeEvent.id, activeRound, idx)}
                          title="ลบลู่นี้"
                          style={{
                            background: "transparent",
                            border: "1px solid #fca5a5",
                            color: activeLanes.length <= 1 ? "#cbd5e1" : "#dc2626",
                            borderRadius: "6px",
                            padding: "4px 8px",
                            cursor: activeLanes.length <= 1 ? "not-allowed" : "pointer",
                            fontSize: "12px",
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Lane Full-Width Button for Mini Marathon */}
          {activeEvent.expandableLanes && (
            <div style={{ marginBottom: "18px" }}>
              <button
                type="button"
                onClick={() => handleAddLane(activeEvent.id, activeRound)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: "8px",
                  border: "2px dashed #3b82f6",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <Plus size={18} /> เพิ่มลู่ / นักกีฬา (ลู่ที่ {activeLanes.length + 1})
              </button>
            </div>
          )}

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
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
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
              {activeEvent.expandableLanes && (
                <button
                  type="button"
                  className="ui-button-outline"
                  onClick={() => handleAddLane(activeEvent.id, activeRound)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    borderColor: "#3b82f6",
                    color: "#1d4ed8",
                    fontWeight: 600,
                  }}
                >
                  <Plus size={16} /> เพิ่มลู่ (ลู่ที่ {activeLanes.length + 1})
                </button>
              )}
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                *คลิกเพื่อบันทึกข้อมูลการจัดลู่วิ่งในรายการนี้
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="ui-button-outline"
                onClick={() => setSubTab("sheet")}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <ClipboardList size={15} /> ดูในใบบันทึกผล →
              </button>
            </div>
          </div>

          {/* Quick Grid of Events */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px", color: "#334155" }}>
              ภาพรวมและเลือกรายการแข่งขัน:
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
                    onClick={() => {
                      setActiveEventId(r.id);
                      setActiveRound(r.directFinal ? "r3" : "r1");
                    }}
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
                      {r.expandableLanes ? (
                        <span style={{ color: "#1d4ed8", fontWeight: 600 }}>
                          ลงทะเบียนแล้ว {r3Count}/{r.r3Lanes.length} ลู่ (เพิ่มลู่ได้)
                        </span>
                      ) : r.directFinal ? (
                        <span style={{ color: "#b45309", fontWeight: 600 }}>
                          ชิงทันที ({r3Count}/{r.r3Lanes.length})
                        </span>
                      ) : (
                        <>
                          <span style={{ color: r1Count > 0 ? "#0f766e" : "#94a3b8" }}>
                            รอบ 1 ({r1Count}/5)
                          </span>
                          <span style={{ color: r2Count > 0 ? "#0f766e" : "#94a3b8" }}>
                            รอบ 2 ({r2Count}/5)
                          </span>
                          <span style={{ color: r3Count > 0 ? "#b45309" : "#94a3b8" }}>
                            ชิง ({r3Count}/6)
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ==================== TAB 2: SCORESHEET ================================= */}
      {/* ========================================================================= */}
      {subTab === "sheet" && (
        <section className="panel printable-area" aria-label="ตารางบันทึกการแข่งขันกรีฑา">
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
                ใบบันทึกผลการแข่งขันกรีฑา (รอบ 1, รอบ 2, รอบชิงชนะเลิศ)
              </h2>
              <p className="muted no-print" style={{ margin: "4px 0 0", fontSize: "13px" }}>
                💡 <strong>คำแนะนำ:</strong> คลิกที่ <strong>ช่องชื่อโรงเรียน</strong> ในรอบใดก็ได้ เพื่อเปิดหน้าต่างบันทึก{" "}
                <strong>อันดับ และ สถานะฟาล์ว ของทั้งฮีตในครั้งเดียว</strong> (รายการมินิมาราธอนสามารถกด <strong>+ เพิ่มลู่</strong> ได้เรื่อยๆ)
              </p>
            </div>
            <div className="no-print" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                    รอบ 1 (5 ลู่)
                  </th>
                  <th
                    colSpan={5}
                    style={{
                      padding: "6px",
                      border: "1px solid #334155",
                      background: "#334155",
                    }}
                  >
                    รอบ 2 (5 ลู่)
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
                    รอบชิงชนะเลิศ (6 ลู่ · มินิมาราธอนเพิ่มลู่ได้ไม่จำกัด) · เรียง 3-2-1-1-2-3
                  </th>
                  <th
                    rowSpan={2}
                    className="no-print"
                    style={{
                      padding: "8px",
                      border: "1px solid #334155",
                      width: "120px",
                    }}
                  >
                    จัดการ
                  </th>
                </tr>
                <tr style={{ background: "#475569", color: "#fff", fontSize: "12px" }}>
                  {/* รอบ 1 */}
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 1</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 2</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 3</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 4</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 5</th>
                  {/* รอบ 2 */}
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 1</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 2</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 3</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 4</th>
                  <th style={{ padding: "4px", border: "1px solid #334155", minWidth: "105px" }}>ลู่ 5</th>
                  {/* รอบชิง: 3-2-1-1-2-3 */}
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#fef08a" }}>ลู่ 1 (ที่ 3-1)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#fef08a" }}>ลู่ 2 (ที่ 2-1)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#fef08a" }}>ลู่ 3 (ที่ 1-1)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#a7f3d0" }}>ลู่ 4 (ที่ 1-2)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#a7f3d0" }}>ลู่ 5 (ที่ 2-2)</th>
                  <th style={{ padding: "4px", border: "1px solid #0f766e", minWidth: "110px", color: "#a7f3d0" }}>ลู่ 6 (ที่ 3-2)</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item) => {
                  const extraLanes = item.expandableLanes && item.r3Lanes.length > 6
                    ? item.r3Lanes.slice(6)
                    : [];

                  return (
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
                        <div>{item.name}</div>
                        {item.expandableLanes && (
                          <div style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: 600 }}>
                            ({item.r3Lanes.length} ลู่)
                          </div>
                        )}
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

                      {/* กรณีมินิมาราธอนที่แข่งรอบชิงทันที */}
                      {item.directFinal ? (
                        <td
                          colSpan={10}
                          style={{
                            padding: "6px",
                            borderRight: "1px solid #e2e8f0",
                            background: "#f1f5f9",
                            color: "#64748b",
                            fontSize: "12px",
                            fontStyle: "italic",
                          }}
                        >
                          {item.expandableLanes ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                              <span>— แข่งขันรอบชิงชนะเลิศทันที (ส่งได้มากกว่า 1 คน/โรงเรียน · ปัจจุบัน {item.r3Lanes.length} ลู่) —</span>
                              <button
                                type="button"
                                className="no-print"
                                onClick={() => handleAddLane(item.id, "r3")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  border: "1px solid #3b82f6",
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  fontStyle: "normal",
                                }}
                              >
                                <Plus size={12} /> เพิ่มลู่ (ลู่ที่ {item.r3Lanes.length + 1})
                              </button>
                            </div>
                          ) : (
                            "— แข่งขันรอบชิงชนะเลิศทันที (ไม่มีรอบคัดเลือก 1 และ 2) —"
                          )}
                        </td>
                      ) : (
                        <>
                          {/* รอบ 1: ลู่ 1-5 */}
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
                                        {`ที่ ${rank}`}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="no-print" style={{ color: "#94a3b8", fontSize: "11px" }}>+ จัดลู่</span>
                                )}
                              </td>
                            );
                          })}

                          {/* รอบ 2: ลู่ 1-5 */}
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
                                        {`ที่ ${rank}`}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="no-print" style={{ color: "#94a3b8", fontSize: "11px" }}>+ จัดลู่</span>
                                )}
                              </td>
                            );
                          })}
                        </>
                      )}

                      {/* รอบชิงชนะเลิศ: ลู่ 1-6 (และแสดงลู่ที่ 7+ สำหรับมินิมาราธอน) */}
                      {item.r3Lanes.slice(0, 6).map((lane, idx) => {
                        const schoolName = lane?.schoolName || item.r3?.[idx] || "";
                        const isFoul = lane?.isFoul;
                        const rank = lane?.rank;
                        const isGold = !isFoul && rank === "1";
                        const isSilver = !isFoul && rank === "2";
                        const isBronze = !isFoul && rank === "3";
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
                              verticalAlign: "top",
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
                              <span className="no-print" style={{ color: "#94a3b8", fontSize: "11px" }}>+ จัดลู่</span>
                            )}

                            {/* แสดงลู่ที่ 7 เป็นต้นไปสำหรับมินิมาราธอนในช่องลู่ 6 */}
                            {idx === 5 && extraLanes.length > 0 && (
                              <div
                                style={{
                                  marginTop: "6px",
                                  paddingTop: "4px",
                                  borderTop: "1px dashed #cbd5e1",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "3px",
                                }}
                              >
                                {extraLanes.map((exLane, exIdx) => {
                                  const realIdx = 6 + exIdx;
                                  const exSchool = exLane.schoolName || "";
                                  const exGold = !exLane.isFoul && exLane.rank === "1";
                                  const exSilver = !exLane.isFoul && exLane.rank === "2";
                                  const exBronze = !exLane.isFoul && exLane.rank === "3";
                                  return (
                                    <div
                                      key={realIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCellModal(item.id, "r3", realIdx);
                                      }}
                                      style={{
                                        padding: "2px 4px",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        background: exLane.isFoul
                                          ? "#fee2e2"
                                          : exGold
                                            ? "#fef08a"
                                            : exSilver
                                              ? "#e2e8f0"
                                              : exBronze
                                                ? "#fed7aa"
                                                : exSchool
                                                  ? "#dcfce7"
                                                  : "#f8fafc",
                                        border: "1px solid #cbd5e1",
                                        color: exLane.isFoul ? "#b91c1c" : "#1e293b",
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      ลู่ {exLane.lane}:{" "}
                                      {exSchool ? getDisplaySchoolName(exSchool) : "+ จัดลู่"}
                                      {exLane.isFoul
                                        ? " [ฟาล์ว]"
                                        : exGold
                                          ? " 🥇"
                                          : exSilver
                                            ? " 🥈"
                                            : exBronze
                                              ? " 🥉"
                                              : exLane.rank
                                                ? ` (${exLane.rank})`
                                                : ""}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Actions */}
                      <td className="no-print" style={{ padding: "6px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
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
                              width: "100%",
                              justifyContent: "center",
                            }}
                            onClick={() => {
                              setActiveEventId(item.id);
                              setActiveRound(item.directFinal ? "r3" : "r1");
                              setSubTab("register");
                            }}
                          >
                            <Edit3 size={13} /> จัดลู่
                          </button>
                          {item.expandableLanes && (
                            <button
                              type="button"
                              className="ui-button-outline ui-button-sm"
                              style={{
                                fontSize: "11px",
                                padding: "2px 6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                color: "#1d4ed8",
                                borderColor: "#3b82f6",
                                background: "#eff6ff",
                                width: "100%",
                                justifyContent: "center",
                                fontWeight: 700,
                              }}
                              onClick={() => handleAddLane(item.id, "r3")}
                            >
                              <Plus size={12} /> เพิ่มลู่ ({item.r3Lanes.length + 1})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* ==================== TAB 3: SUMMARY & SCORE REPORT ===================== */}
      {/* ========================================================================= */}
      {subTab === "summary" && (
        <div className="printable-report printable-area" style={{ background: "#fff", padding: "16px" }}>
          {/* Top Action Bar for Print Preview */}
          <div
            className="no-print"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "20px",
            }}
          >
            <div>
              <strong style={{ color: "#166534", fontSize: "14px" }}>
                📄 รายงานสรุปผลการแข่งขันกรีฑา (รูปแบบมาตรฐาน A4 แนวตั้ง)
              </strong>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#15803d" }}>
                สามารถกดดูตัวอย่างกระดาษ A4 แนวตั้ง (4 หน้า ตามแบบสูจิบัตร) ก่อนสั่งพิมพ์ออกเครื่องพิมพ์หรือบันทึกเป็น PDF
              </p>
            </div>
            <button
              type="button"
              className="primary"
              onClick={() => setShowPrintPreview(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#0f766e",
                padding: "8px 18px",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              <Eye size={16} /> แสดงตัวอย่างก่อนพิมพ์ (A4 แนวตั้ง)
            </button>
          </div>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 6px" }}>
              ตารางสรุปผลการแข่งขันกรีฑา
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              การแข่งขันกีฬา - กรีฑานักเรียน กลุ่มโรงเรียนโกสัมพีนคร
              "นครโกสัมพีเกมส์" ประจำปีการศึกษา 2569
            </p>
          </div>

          {/* Events Grid on Screen */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "16px",
              marginBottom: "30px",
            }}
          >
            {rows.map((r) => {
              const winners = computeFinalsWinners(r.r3Lanes || []);

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
                              {medalIcon} {rank}
                            </td>
                            <td style={{ padding: "5px 4px", textAlign: "left" }}>
                              {w?.athleteName || "-"}
                            </td>
                            <td style={{ padding: "5px 4px", textAlign: "left", fontWeight: 500 }}>
                              {w?.schoolName ? getDisplaySchoolName(w.schoolName) : "-"}
                            </td>
                            <td style={{ padding: "5px 4px", fontWeight: 700 }}>
                              {w?.schoolName ? (rank === 1 ? "3" : rank === 2 ? "2" : "1") : "-"}
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

          {/* Summary Score Table */}
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

            <div style={{ maxWidth: "760px", margin: "0 auto 30px" }}>
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
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", width: "65px" }}>
                      ลำดับที่
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", textAlign: "left" }}>
                      โรงเรียน
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", width: "65px" }}>
                      🥇 ทอง
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", width: "65px" }}>
                      🥈 เงิน
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #fbcfe8", width: "75px" }}>
                      🥉 ทองแดง
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
                      <td colSpan={7} style={{ padding: "16px", color: "#94a3b8" }}>
                        ยังไม่มีผลการแข่งขันกรีฑา (คะแนนจะสรุปจากอันดับ 1=3 แต้ม, 2=2 แต้ม, 3=1 แต้ม ในรอบชิงชนะเลิศ)
                      </td>
                    </tr>
                  ) : (
                    rankedSchools.map((s) => (
                      <tr key={s.schoolName} style={{ borderBottom: "1px solid #fbcfe8" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>
                          {s.place === 1
                            ? "🥇 1"
                            : s.place === 2
                              ? "🥈 2"
                              : s.place === 3
                                ? "🥉 3"
                                : s.place}
                        </td>
                        <td style={{ padding: "8px", textAlign: "left", fontWeight: 600 }}>
                          {s.schoolName}
                        </td>
                        <td style={{ padding: "8px", fontWeight: 600, color: "#854d0e" }}>
                          {s.gold}
                        </td>
                        <td style={{ padding: "8px", fontWeight: 600, color: "#475569" }}>
                          {s.silver}
                        </td>
                        <td style={{ padding: "8px", fontWeight: 600, color: "#9a3412" }}>
                          {s.bronze}
                        </td>
                        <td style={{ padding: "8px", fontWeight: 700, color: "#be185d", fontSize: "15px" }}>
                          {s.totalScore}
                        </td>
                        <td style={{ padding: "8px", color: "#64748b" }}>
                          {s.place === 1 ? "ชนะเลิศคะแนนรวม" : "-"}
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
      {/* ====== MODAL: ตัวอย่างก่อนพิมพ์รายงานสรุปผล (A4 แนวตั้ง 210 x 297 มม.) ====== */}
      {/* ========================================================================= */}
      {showPrintPreview && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.85)",
            zIndex: 11000,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Top Preview Control Bar */}
          <div
            style={{
              background: "#0f172a",
              color: "#fff",
              padding: "12px 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              borderBottom: "1px solid #334155",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  background: "#0f766e",
                  color: "#fff",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                A4 แนวตั้ง (210 × 297 มม.)
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px" }}>
                  ตัวอย่างก่อนพิมพ์: รายงานสรุปผลการแข่งขันกรีฑา (จำนวน {a4EventPages.length + 1} แผ่น)
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                  จัดหน้าตามแบบมาตรฐานสูจิบัตร (แผ่นละ 7 รายการ และแผ่นสรุปคะแนนรวมพร้อมช่องลงลายมือชื่อ)
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                className="primary"
                onClick={executeA4PortraitPrint}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#16a34a",
                  color: "#fff",
                  padding: "9px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(22, 163, 74, 0.4)",
                }}
              >
                <Printer size={17} /> สั่งพิมพ์ / บันทึกเป็น PDF (A4 แนวตั้ง)
              </button>
              <button
                type="button"
                onClick={() => setShowPrintPreview(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#334155",
                  color: "#fff",
                  padding: "9px 16px",
                  fontSize: "14px",
                  borderRadius: "8px",
                  border: "1px solid #475569",
                  cursor: "pointer",
                }}
              >
                <X size={17} /> ปิดหน้าต่างตัวอย่าง
              </button>
            </div>
          </div>

          {/* Scrollable Desk Area holding A4 Portrait Sheets */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "28px 16px 60px",
              background: "#475569",
            }}
          >
            <div ref={previewContainerRef}>
              {/* แผ่นที่ 1 ถึง 3: ตารางสรุปผลการแข่งขันกรีฑารายรายการ (แผ่นละ 7 รายการ แนวตั้ง) */}
              {a4EventPages.map((pageRows, pageIdx) => (
                <div
                  key={`a4-page-${pageIdx}`}
                  className="a4-sheet"
                  style={{
                    width: "210mm",
                    minHeight: "297mm",
                    background: "#ffffff",
                    margin: "0 auto 28px",
                    padding: "12mm 16mm",
                    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
                    position: "relative",
                    boxSizing: "border-box",
                    color: "#0f172a",
                  }}
                >
                  {/* Page indicator badge on screen */}
                  <div
                    className="sheet-badge"
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "12px",
                      background: "#f1f5f9",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      padding: "2px 10px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    แผ่นที่ {pageIdx + 1} / {a4EventPages.length + 1} (A4 แนวตั้ง)
                  </div>

                  {pageIdx === 0 && (
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ fontSize: "15px", fontWeight: 700 }}>
                        ตารางสรุปผลการแข่งขันกรีฑา
                      </div>
                    </div>
                  )}

                  {/* Stacked Single-Column Event Tables matching Handbook pp. 31-33 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {pageRows.map((r) => {
                      const winners = computeFinalsWinners(r.r3Lanes || []);
                      return (
                        <div key={r.id} style={{ width: "100%" }}>
                          <div
                            style={{
                              textAlign: "center",
                              fontWeight: 700,
                              fontSize: "13px",
                              marginBottom: "2px",
                            }}
                          >
                            รายการที่ {r.sourceNumber || r.no} {r.name} {r.grade} {r.type}
                          </div>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "12px",
                              textAlign: "center",
                              border: "1px solid #1e293b",
                            }}
                          >
                            <thead>
                              <tr style={{ background: "#f49ac2", color: "#000", fontWeight: 700 }}>
                                <th style={{ border: "1px solid #1e293b", padding: "3px 4px", width: "11%" }}>
                                  ลำดับที่
                                </th>
                                <th style={{ border: "1px solid #1e293b", padding: "3px 6px", width: "35%" }}>
                                  ชื่อ - นามสกุล
                                </th>
                                <th style={{ border: "1px solid #1e293b", padding: "3px 6px", width: "28%" }}>
                                  โรงเรียน
                                </th>
                                <th style={{ border: "1px solid #1e293b", padding: "3px 4px", width: "11%" }}>
                                  คะแนน
                                </th>
                                <th style={{ border: "1px solid #1e293b", padding: "3px 4px", width: "15%" }}>
                                  หมายเหตุ
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {[1, 2, 3].map((rank, i) => {
                                const w = winners[i];
                                const defaultPts = rank === 1 ? "3" : rank === 2 ? "2" : "1";
                                return (
                                  <tr key={rank}>
                                    <td style={{ border: "1px solid #1e293b", padding: "3px 4px", fontWeight: 600 }}>
                                      {rank}
                                    </td>
                                    <td style={{ border: "1px solid #1e293b", padding: "3px 8px", textAlign: "left" }}>
                                      {w?.athleteName || ""}
                                    </td>
                                    <td style={{ border: "1px solid #1e293b", padding: "3px 8px", textAlign: "left" }}>
                                      {w?.schoolName ? getDisplaySchoolName(w.schoolName) : ""}
                                    </td>
                                    <td style={{ border: "1px solid #1e293b", padding: "3px 4px", fontWeight: 700 }}>
                                      {defaultPts}
                                    </td>
                                    <td style={{ border: "1px solid #1e293b", padding: "3px 4px", color: "#334155" }}>
                                      {w?.time || ""}
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
                </div>
              ))}

              {/* แผ่นที่ 4: สรุปผลรวมการแข่งขันกรีฑานักเรียน & ลายเซ็นคณะกรรมการ (ตามสูจิบัตรหน้า 34) */}
              <div
                className="a4-sheet"
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  background: "#ffffff",
                  margin: "0 auto 28px",
                  padding: "16mm 18mm",
                  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
                  position: "relative",
                  boxSizing: "border-box",
                  color: "#0f172a",
                }}
              >
                <div
                  className="sheet-badge"
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "12px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "1px solid #cbd5e1",
                    padding: "2px 10px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  แผ่นที่ {a4EventPages.length + 1} / {a4EventPages.length + 1} (A4 แนวตั้ง)
                </div>

                {/* ตารางที่ 1: สรุปผลการแข่งขันกรีฑา (3 อันดับแรก) */}
                <h3 style={{ textAlign: "center", fontSize: "16px", fontWeight: 700, margin: "8px 0 12px" }}>
                  สรุปผลการแข่งขันกรีฑา
                </h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                    textAlign: "center",
                    border: "1px solid #1e293b",
                    marginBottom: "32px",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f49ac2", color: "#000", fontWeight: 700 }}>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "12%" }}>ลำดับที่</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "38%" }}>โรงเรียน</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "20%" }}>เหรียญ (ทอง/เงิน/ทองแดง)</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "14%" }}>คะแนนรวม</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "16%" }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2].map((idx) => {
                      const s = rankedSchools[idx];
                      return (
                        <tr key={idx}>
                          <td style={{ border: "1px solid #1e293b", padding: "6px", fontWeight: 700 }}>
                            {idx + 1}
                          </td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>
                            {s ? s.schoolName : ""}
                          </td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}>
                            {s ? `${s.gold} / ${s.silver} / ${s.bronze}` : ""}
                          </td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px", fontWeight: 700 }}>
                            {s ? s.totalScore : ""}
                          </td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}>
                            {s && s.place === 1 ? "ชนะเลิศ" : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ตารางที่ 2: สรุปผลรวมการแข่งขันกรีฑานักเรียน (ทุกโรงเรียนที่มีคะแนน) */}
                <h3 style={{ textAlign: "center", fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>
                  สรุปผลรวมการแข่งขันกรีฑานักเรียน
                </h3>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "13px",
                    textAlign: "center",
                    border: "1px solid #1e293b",
                    marginBottom: "48px",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f49ac2", color: "#000", fontWeight: 700 }}>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "11%" }}>ลำดับที่</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "35%" }}>โรงเรียน</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "9%" }}>ทอง</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "9%" }}>เงิน</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "10%" }}>ทองแดง</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "12%" }}>คะแนน</th>
                      <th style={{ border: "1px solid #1e293b", padding: "6px", width: "14%" }}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedSchools.length === 0 ? (
                      [1, 2, 3].map((num) => (
                        <tr key={num}>
                          <td style={{ border: "1px solid #1e293b", padding: "6px", fontWeight: 600 }}>{num}</td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}></td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}></td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}></td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}></td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}></td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}></td>
                        </tr>
                      ))
                    ) : (
                      rankedSchools.map((s) => (
                        <tr key={s.schoolName}>
                          <td style={{ border: "1px solid #1e293b", padding: "6px", fontWeight: 700 }}>
                            {s.place}
                          </td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px 10px", textAlign: "left", fontWeight: 600 }}>
                            {s.schoolName}
                          </td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}>{s.gold}</td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}>{s.silver}</td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}>{s.bronze}</td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px", fontWeight: 700 }}>
                            {s.totalScore}
                          </td>
                          <td style={{ border: "1px solid #1e293b", padding: "6px" }}>
                            {s.place === 1 ? "ชนะเลิศคะแนนรวม" : ""}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* ช่องลงลายมือชื่อตามแบบหน้า 34 ในสูจิบัตร */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "24px",
                    marginTop: "36px",
                    fontSize: "14px",
                    lineHeight: "1.9",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div>ลงชื่อ......................................................คณะกรรมการ</div>
                    <div>(...............................................................)</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div>ลงชื่อ......................................................คณะกรรมการ</div>
                    <div>(...............................................................)</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div>ลงชื่อ......................................................ประธานฝ่ายจัดการแข่งขัน</div>
                    <div>(...............................................................)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========= MODAL: บันทึกผล อันดับ และ ฟาล์ว (ครบทั้งฮีตในหน้าต่างเดียว) ========= */}
      {/* ========================================================================= */}
      {roundModal && (() => {
        const modalRow = rows.find((r) => r.id === roundModal.rowId);
        if (!modalRow) return null;
        const roundTitle =
          roundModal.roundKey === "r1"
            ? "รอบ 1 (5 ลู่)"
            : roundModal.roundKey === "r2"
              ? "รอบ 2 (5 ลู่)"
              : `รอบชิงชนะเลิศ (${roundModal.lanes.length} ลู่)`;

        return (
          <div
            className="no-print"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.65)",
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
                maxWidth: "920px",
                width: "100%",
                maxHeight: "92vh",
                overflowY: "auto",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.25)",
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
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>บันทึกผลการแข่งขัน อันดับ และสถานะฟาล์ว · {roundTitle}</span>
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: "13px", color: "#cbd5e1" }}>
                    รายการที่ {modalRow.no}: <strong>{modalRow.name}</strong> (ระดับ {modalRow.grade} · เพศ{modalRow.type})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoundModal(null)}
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
              <div style={{ padding: "16px 18px" }}>
                {/* Guide Banner */}
                <div
                  style={{
                    background: roundModal.roundKey === "r3" ? "#fefce8" : "#f0fdf4",
                    border: `1px solid ${roundModal.roundKey === "r3" ? "#fef08a" : "#bbf7d0"}`,
                    padding: "10px 14px",
                    borderRadius: "8px",
                    marginBottom: "14px",
                    fontSize: "13px",
                    color: roundModal.roundKey === "r3" ? "#854d0e" : "#166534",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    {roundModal.roundKey === "r3" ? (
                      <>
                        🏆 <strong>{roundTitle}:</strong> เลือกอันดับ <strong>ที่ 1 (ทอง 3 แต้ม), ที่ 2 (เงิน 2 แต้ม), ที่ 3 (ทองแดง 1 แต้ม)</strong> หรือระบุสถานะฟาล์วได้ครบทุกลู่ในหน้าต่างเดียว
                      </>
                    ) : (
                      <>
                        🏃 <strong>{roundTitle}:</strong> บันทึกอันดับเข้าเส้นชัย <strong>ที่ 1, ที่ 2, ที่ 3</strong> หรือติ๊ก <strong>ฟาล์ว (DQ)</strong> ของแต่ละลู่ได้พร้อมกัน เมื่อกดบันทึก ระบบจะส่งอันดับ 1-3 ไปจัดลู่รอบชิงชนะเลิศ (เรียงลู่ <strong>3-2-1-1-2-3</strong>) ให้อัตโนมัติ
                      </>
                    )}
                  </div>
                  {modalRow.expandableLanes && (
                    <button
                      type="button"
                      onClick={addModalLane}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "5px 12px",
                        borderRadius: "6px",
                        border: "1px solid #3b82f6",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} /> เพิ่มลู่ / นักกีฬา (ลู่ที่ {roundModal.lanes.length + 1})
                    </button>
                  )}
                </div>

                {/* All Lanes Table in Modal */}
                <div
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    overflowX: "auto",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1", color: "#1e293b" }}>
                        <th style={{ padding: "8px", width: "65px", textAlign: "center" }}>ลู่</th>
                        <th style={{ padding: "8px", minWidth: "200px", textAlign: "left" }}>โรงเรียน</th>
                        <th style={{ padding: "8px", minWidth: "150px", textAlign: "left" }}>ชื่อ-สกุล นักกีฬา</th>
                        <th style={{ padding: "8px", width: "165px", textAlign: "center" }}>อันดับเข้าเส้นชัย</th>
                        <th style={{ padding: "8px", width: "175px", textAlign: "left" }}>สถานะฟาล์ว (DQ)</th>
                        <th style={{ padding: "8px", width: "90px", textAlign: "center" }}>เวลา/สถิติ</th>
                        {modalRow.expandableLanes && (
                          <th style={{ padding: "8px", width: "50px", textAlign: "center" }}>ลบ</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {roundModal.lanes.map((lane, idx) => {
                        const isFocused = idx === roundModal.focusedLaneIdx;
                        const maxRankOptions = roundModal.lanes.length;
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              background: lane.isFoul
                                ? "#fef2f2"
                                : lane.rank === "1"
                                  ? "#fef9c3"
                                  : isFocused
                                    ? "#f0fdf4"
                                    : "#fff",
                            }}
                          >
                            <td
                              style={{
                                padding: "8px",
                                textAlign: "center",
                                fontWeight: 700,
                                color: isFocused ? "#0f766e" : "#334155",
                              }}
                            >
                              ลู่ {lane.lane}
                            </td>

                            <td style={{ padding: "6px 8px" }}>
                              <select
                                value={lane.schoolName}
                                onChange={(e) =>
                                  updateModalLane(idx, { schoolName: e.target.value })
                                }
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "13px",
                                  fontWeight: lane.schoolName ? 600 : 400,
                                }}
                              >
                                <option value="">-- เลือกโรงเรียน --</option>
                                {schoolOptions.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                placeholder="ชื่อ-สกุล (ถ้ามี)"
                                value={lane.athleteName}
                                onChange={(e) =>
                                  updateModalLane(idx, { athleteName: e.target.value })
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

                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                              <select
                                disabled={lane.isFoul}
                                value={lane.isFoul ? "DQ" : lane.rank || ""}
                                onChange={(e) =>
                                  updateModalLane(idx, { rank: e.target.value })
                                }
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  border:
                                    lane.rank && !lane.isFoul
                                      ? "1.5px solid #0f766e"
                                      : "1px solid #cbd5e1",
                                  fontSize: "13px",
                                  fontWeight: lane.rank ? 700 : 400,
                                  background: lane.isFoul ? "#fee2e2" : "#fff",
                                  color: lane.isFoul
                                    ? "#b91c1c"
                                    : lane.rank === "1"
                                      ? "#ca8a04"
                                      : lane.rank === "2"
                                        ? "#475569"
                                        : lane.rank === "3"
                                          ? "#c2410c"
                                          : "#1e293b",
                                }}
                              >
                                <option value="">- ไม่ระบุอันดับ -</option>
                                {roundModal.roundKey === "r3" ? (
                                  <>
                                    <option value="1">🥇 ที่ 1 (ทอง · 3 แต้ม)</option>
                                    <option value="2">🥈 ที่ 2 (เงิน · 2 แต้ม)</option>
                                    <option value="3">🥉 ที่ 3 (ทองแดง · 1 แต้ม)</option>
                                    {Array.from(
                                      { length: Math.max(0, maxRankOptions - 3) },
                                      (_, i) => i + 4,
                                    ).map((rankNum) => (
                                      <option key={rankNum} value={String(rankNum)}>
                                        ที่ {rankNum}
                                      </option>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    <option value="1">ที่ 1 (เข้ารอบชิง)</option>
                                    <option value="2">ที่ 2 (เข้ารอบชิง)</option>
                                    <option value="3">ที่ 3 (เข้ารอบชิง)</option>
                                    <option value="4">ที่ 4</option>
                                    <option value="5">ที่ 5</option>
                                  </>
                                )}
                                {lane.isFoul && <option value="DQ">ฟาล์ว (DQ)</option>}
                              </select>
                            </td>

                            <td style={{ padding: "6px 8px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    cursor: "pointer",
                                    fontWeight: lane.isFoul ? 700 : 500,
                                    color: lane.isFoul ? "#b91c1c" : "#475569",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!lane.isFoul}
                                    onChange={(e) =>
                                      updateModalLane(idx, { isFoul: e.target.checked })
                                    }
                                  />
                                  <span>ฟาล์ว (DQ)</span>
                                </label>
                                {lane.isFoul && (
                                  <select
                                    value={lane.foulReason || FOUL_REASONS[0]}
                                    onChange={(e) =>
                                      updateModalLane(idx, { foulReason: e.target.value })
                                    }
                                    style={{
                                      width: "100%",
                                      padding: "4px 6px",
                                      borderRadius: "4px",
                                      border: "1px solid #fca5a5",
                                      fontSize: "11px",
                                      background: "#fff",
                                    }}
                                  >
                                    {FOUL_REASONS.map((reason) => (
                                      <option key={reason} value={reason}>
                                        {reason}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>

                            <td style={{ padding: "6px 8px" }}>
                              <input
                                type="text"
                                placeholder="เช่น 12.4 วิ"
                                value={lane.time || ""}
                                onChange={(e) =>
                                  updateModalLane(idx, { time: e.target.value })
                                }
                                style={{
                                  width: "100%",
                                  padding: "6px 6px",
                                  textAlign: "center",
                                  borderRadius: "6px",
                                  border: "1px solid #cbd5e1",
                                  fontSize: "12px",
                                }}
                              />
                            </td>

                            {modalRow.expandableLanes && (
                              <td style={{ padding: "6px", textAlign: "center" }}>
                                <button
                                  type="button"
                                  disabled={roundModal.lanes.length <= 1}
                                  onClick={() => removeModalLane(idx)}
                                  title="ลบลู่นี้"
                                  style={{
                                    background: "transparent",
                                    border: "1px solid #fca5a5",
                                    color:
                                      roundModal.lanes.length <= 1
                                        ? "#cbd5e1"
                                        : "#dc2626",
                                    borderRadius: "4px",
                                    padding: "3px 6px",
                                    cursor:
                                      roundModal.lanes.length <= 1
                                        ? "not-allowed"
                                        : "pointer",
                                    fontSize: "11px",
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {modalRow.expandableLanes && (
                  <div style={{ marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={addModalLane}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1.5px dashed #3b82f6",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <Plus size={16} /> เพิ่มลู่ / นักกีฬา (ลู่ที่ {roundModal.lanes.length + 1})
                    </button>
                  </div>
                )}
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
                  onClick={() => setRoundModal(null)}
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={handleSaveRoundModal}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#0f766e",
                  }}
                >
                  <Save size={15} /> บันทึกผลทั้งรอบ
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
