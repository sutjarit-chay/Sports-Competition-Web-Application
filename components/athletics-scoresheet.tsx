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
  rank?: string; // "1", "2", "3", "4", "5", "6", "DQ"
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
  directFinal?: boolean; // แข่งรอบชิงชนะเลิศทันที (ไม่มีรอบคัดเลือก รอบ ๑ และ รอบ ๒)
  r1: string[]; // 5 lanes (ชื่อโรงเรียน)
  r2: string[]; // 5 lanes (ชื่อโรงเรียน)
  r3: string[]; // 6 lanes (finals) (ชื่อโรงเรียน)
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

// ข้อมูล ๒๐ รายการกรีฑาตามสูจิบัตร นครโกสัมพีเกมส์ ๒๕๖๙
export const INITIAL_ATHLETICS_DATA: AthleticsRow[] = [
  { id: 1, no: "๑", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "ชาย", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 2, no: "๒", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "ประถม", type: "หญิง", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 3, no: "๓", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "ชาย", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 4, no: "๔", sourceNumber: 101, name: "วิ่ง มินิมาราธอน", grade: "มัธยม", type: "หญิง", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 5, no: "๕", sourceNumber: 106, name: "วิ่ง ๕๐ เมตร", grade: "อนุบาล", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 6, no: "๖", sourceNumber: 107, name: "วิ่ง ๕๐ เมตร", grade: "อนุบาล", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 7, no: "๗", sourceNumber: 112, name: "วิ่ง ๘๐ เมตร", grade: "อนุบาล", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 8, no: "๘", sourceNumber: 113, name: "วิ่ง ๘๐ เมตร", grade: "อนุบาล", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 9, no: "๙", sourceNumber: 118, name: "วิ่ง ๖๐ เมตร", grade: "ป.๑-๓", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 10, no: "๑๐", sourceNumber: 119, name: "วิ่ง ๖๐ เมตร", grade: "ป.๑-๓", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 11, no: "๑๑", sourceNumber: 124, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๑-๓", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 12, no: "๑๒", sourceNumber: 125, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๑-๓", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 13, no: "๑๓", sourceNumber: 130, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๔-๖", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 14, no: "๑๔", sourceNumber: 131, name: "วิ่ง ๑๐๐ เมตร", grade: "ป.๔-๖", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 15, no: "๑๕", sourceNumber: 132, name: "วิ่ง ๑๐๐ เมตร", grade: "ม.๑-๓", type: "หญิง", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 16, no: "๑๖", sourceNumber: 133, name: "วิ่ง ๑๐๐ เมตร", grade: "ม.๑-๓", type: "ชาย", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 17, no: "๑๗", sourceNumber: 138, name: "วิ่ง ๒๐๐ เมตร", grade: "ป.๔-๖", type: "หญิง", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 18, no: "๑๘", sourceNumber: 139, name: "วิ่ง ๒๐๐ เมตร", grade: "ป.๔-๖", type: "ชาย", directFinal: false, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 19, no: "๑๙", sourceNumber: 140, name: "วิ่ง ๒๐๐ เมตร", grade: "ม.๑-๓", type: "หญิง", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
  { id: 20, no: "๒๐", sourceNumber: 141, name: "วิ่ง ๒๐๐ เมตร", grade: "ม.๑-๓", type: "ชาย", directFinal: true, r1: ["", "", "", "", ""], r2: ["", "", "", "", ""], r3: ["", "", "", "", "", ""], r1Lanes: defaultLanes(5), r2Lanes: defaultLanes(5), r3Lanes: defaultLanes(6) },
];

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
    // ล้างอันดับซ้ำจากลู่อื่น (ยกเว้น "" หรือ "DQ")
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
 * คำนวณผู้ชนะเหรียญรางวัล (อันดับ ๑, ๒, ๓) จากข้อมูลลู่วิ่งในรอบชิงชนะเลิศ (`r3Lanes`)
 * จะคืนค่าเฉพาะลู่ที่ไม่ฟาล์ว มีชื่อโรงเรียน และระบุ rank เป็น "1", "2", "3" เท่านั้น
 * ไม่ดึงลู่ ๑-๓ ที่ยังไม่ได้แข่งมาเป็นเหรียญรางวัลล่วงหน้า
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
 * ส่งผู้เข้ารอบ ๑, ๒, ๓ จากรอบ ๑ และ รอบ ๒ ไปจัดลู่รอบชิงชนะเลิศ (เรียงลู่ 3, 2, 1, 1, 2, 3)
 * และหากอันดับใดถูกยกเลิกหรือปรับฟาล์ว จะล้างช่องลู่ในรอบชิงที่ผูกกับโควตานั้นให้ถูกต้องเสมอ
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
        // ถ้านักกีฬาในลู่รอบชิงเปลี่ยนคน ให้รีเซ็ตผลรอบชิงของลู่นั้น
        isFoul: changed ? false : prevLane.isFoul,
        foulReason: changed ? "" : prevLane.foulReason,
        rank: changed ? "" : prevLane.rank || "",
        time: changed ? "" : prevLane.time || "",
      };
      nextR3Cells[targetLaneIdx] = qualifier.schoolName;
    } else {
      // หากโควตานี้ในรอบคัดเลือกถูกยกเลิกหรือฟาล์ว ให้ล้างชื่อออกจากลู่รอบชิง
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

  // กำหนดลำดับที่ (รองรับอันดับร่วมกรณีคะแนนและเหรียญทุกชนิดเท่ากันทั้งหมด)
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

const THAI_DIGITS = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
function toThaiNumber(num: number): string {
  return String(num)
    .split("")
    .map((ch) => THAI_DIGITS[Number(ch)] ?? ch)
    .join("");
}

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

  // Modal สำหรับบันทึกผลทั้งฮีต/รอบ (หรือเฉพาะลู่ที่คลิก)
  const [roundModal, setRoundModal] = useState<RoundModalData | null>(null);

  // Available school list (database prop or fallback)
  const schoolOptions =
    schools && schools.length > 0
      ? schools.map((s) => s.name)
      : DEFAULT_SCHOOLS;

  // Load from localStorage preview & normalize to 20 canonical events
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
          const r3Lanes = found.r3Lanes || defaultLanes(6);
          return {
            ...canonical,
            ...found,
            directFinal: canonical.directFinal,
            r1Lanes: found.r1Lanes || defaultLanes(5),
            r2Lanes: found.r2Lanes || defaultLanes(5),
            r3Lanes,
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

  // Active event object
  const activeEvent = rows.find((r) => r.id === activeEventId) || rows[0];

  // หากเลือกรายการที่เป็น directFinal ให้บังคับอยู่รอบชิงชนะเลิศ (r3) เสมอ
  useEffect(() => {
    if (activeEvent?.directFinal && activeRound !== "r3") {
      setActiveRound("r3");
    }
  }, [activeEvent?.id, activeEvent?.directFinal, activeRound]);

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

    // Sync school name to the main display cell array
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

  // Open Modal from cell click in the scoresheet (loads all lanes of that round with focus on clicked lane)
  function openCellModal(rowId: number, roundKey: "r1" | "r2" | "r3", subIndex: number) {
    const targetRow = rows.find((r) => r.id === rowId);
    if (!targetRow) return;
    if (targetRow.directFinal && roundKey !== "r3") {
      return;
    }
    const lanesKey =
      roundKey === "r1" ? "r1Lanes" : roundKey === "r2" ? "r2Lanes" : "r3Lanes";
    const count = roundKey === "r3" ? 6 : 5;
    const sourceLanes = targetRow[lanesKey] || defaultLanes(count);

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

  // Update a lane inside the modal (with automatic duplicate rank prevention)
  function updateModalLane(
    laneIdx: number,
    patch: Partial<LaneEntry>,
  ) {
    if (!roundModal) return;
    let nextLanes = roundModal.lanes.map((l, idx) =>
      idx === laneIdx ? { ...l, ...patch } : l,
    );

    // If rank was updated, ensure uniqueness across the heat/final
    if (patch.rank !== undefined) {
      nextLanes = assignUniqueRankInLanes(nextLanes, laneIdx, patch.rank);
    }

    // If marked as foul, set rank to "DQ"
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
          "บันทึกผลและส่งผู้เข้ารอบ ๑–๓ เข้าสู่รอบชิงชนะเลิศ (เรียงลู่ 3-2-1-1-2-3) เรียบร้อย";
      }
    } else if (roundKey === "r3") {
      updatedRow = {
        ...updatedRow,
        winners: computeFinalsWinners(normalizedLanes),
      };
    }

    const roundLabel =
      roundKey === "r1" ? "รอบ ๑" : roundKey === "r2" ? "รอบ ๒" : "รอบชิงชนะเลิศ";
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
      roundKey === "r1" ? "รอบ ๑" : roundKey === "r2" ? "รอบ ๒" : "รอบชิงชนะเลิศ";
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

  const activeLanes =
    activeRound === "r1"
      ? activeEvent.r1Lanes
      : activeRound === "r2"
        ? activeEvent.r2Lanes
        : activeEvent.r3Lanes;

  // Duplicate school warning in current registration round
  const assignedSchoolsInActiveRound = activeLanes
    .map((l) => l.schoolName)
    .filter(Boolean);
  const duplicateSchoolsInActiveRound = Array.from(
    new Set(
      assignedSchoolsInActiveRound.filter(
        (name, idx) => assignedSchoolsInActiveRound.indexOf(name) !== idx,
      ),
    ),
  );

  return (
    <div className="athletics-container" style={{ marginTop: "1rem" }}>
      {/* Print Stylesheet for both Scoresheet (Landscape) and Summary Report (Portrait) */}
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
            <UserPlus size={16} /> ๑. ลงทะเบียนและจัดลู่วิ่ง
          </button>
          <button
            type="button"
            className={subTab === "sheet" ? "primary" : "ui-button-outline"}
            onClick={() => setSubTab("sheet")}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <ClipboardList size={16} /> ๒. ใบบันทึกผลการแข่งขัน (ตาราง ๒๐ รายการ)
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
          {(subTab === "sheet" || subTab === "summary") && (
            <button
              type="button"
              className="ui-button-outline ui-button-sm"
              onClick={() => window.print()}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <Printer size={15} />{" "}
              {subTab === "sheet"
                ? "พิมพ์ตารางใบบันทึกผล (A4)"
                : "พิมพ์รายงานสรุปผล (A4 / PDF)"}
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
                      {r.directFinal ? " (ชิงชนะเลิศทันที)" : ""}
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
                {activeEvent.directFinal && (
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
                )}
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
              {activeEvent.directFinal ? (
                <>
                  🏆 <strong>รายการนี้แข่งขันรอบชิงชนะเลิศทันที:</strong> ลงทะเบียนชื่อโรงเรียนและนักกีฬาในรอบชิงชนะเลิศ (ลู่ ๑–๖) ได้โดยตรง
                </>
              ) : activeRound === "r3" ? (
                <>
                  🏆 <strong>รอบชิงชนะเลิศ (๖ ลู่):</strong> ระบบจะดึงผู้ที่ได้อันดับ ๑–๓ จากรอบ ๑ และ รอบ ๒ มาจัดลู่ 3-2-1-1-2-3 ให้อัตโนมัติเมื่อบันทึกผลในใบบันทึกผล (หรือกำหนดเองได้ที่นี่)
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
                <ClipboardList size={15} /> ดูในใบบันทึกผล ๒๐ รายการ →
              </button>
            </div>
          </div>

          {/* Quick Grid of all 20 Events */}
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px", color: "#334155" }}>
              ภาพรวมและเลือกรายการแข่งขัน (๒๐ รายการตามสูจิบัตร):
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
                      {r.directFinal ? (
                        <span style={{ color: "#b45309", fontWeight: 600 }}>
                          ชิงทันที ({r3Count}/๖)
                        </span>
                      ) : (
                        <>
                          <span style={{ color: r1Count > 0 ? "#0f766e" : "#94a3b8" }}>
                            รอบ ๑ ({r1Count}/๕)
                          </span>
                          <span style={{ color: r2Count > 0 ? "#0f766e" : "#94a3b8" }}>
                            รอบ ๒ ({r2Count}/๕)
                          </span>
                          <span style={{ color: r3Count > 0 ? "#b45309" : "#94a3b8" }}>
                            ชิง ({r3Count}/๖)
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
      {/* ==================== TAB 2: SCORESHEET (20 ROWS) ======================= */}
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
                ใบบันทึกผลการแข่งขันกรีฑา (รอบ ๑, รอบ ๒, รอบชิงชนะเลิศ)
              </h2>
              <p className="muted no-print" style={{ margin: "4px 0 0", fontSize: "13px" }}>
                💡 <strong>คำแนะนำ:</strong> คลิกที่ <strong>ช่องชื่อโรงเรียน</strong> ในรอบใดก็ได้ เพื่อเปิดหน้าต่างบันทึก{" "}
                <strong>อันดับ และ สถานะฟาล์ว ของทั้งฮีตในครั้งเดียว</strong> เมื่อได้ผล ๑–๓ จากรอบ ๑ และ รอบ ๒ ระบบจะส่งไปรอบชิงชนะเลิศอัตโนมัติ (เรียงลู่ 3-2-1-1-2-3)
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
                    className="no-print"
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

                    {/* กรณีรายการที่แข่งรอบชิงทันที (ไม่มีรอบคัดเลือก รอบ ๑ และ รอบ ๒) */}
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
                        — แข่งขันรอบชิงชนะเลิศทันที (ไม่มีรอบคัดเลือก ๑ และ ๒) —
                      </td>
                    ) : (
                      <>
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
                                <span className="no-print" style={{ color: "#94a3b8", fontSize: "11px" }}>+ จัดลู่</span>
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
                                <span className="no-print" style={{ color: "#94a3b8", fontSize: "11px" }}>+ จัดลู่</span>
                              )}
                            </td>
                          );
                        })}
                      </>
                    )}

                    {/* รอบชิงชนะเลิศ: ลู่ 1-6 (คลิกเพื่อเปิด Modal กรอกอันดับ/ฟาล์ว/เหรียญ) */}
                    {item.r3.map((schoolName, idx) => {
                      const lane = item.r3Lanes?.[idx];
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
                        </td>
                      );
                    })}

                    {/* Actions: Switch to Registration Tab */}
                    <td className="no-print" style={{ padding: "6px" }}>
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
                          setActiveRound(item.directFinal ? "r3" : "r1");
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
        <div className="printable-report printable-area" style={{ background: "#fff", padding: "16px" }}>
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
            {rows.map((r) => {
              // แสดงเฉพาะผู้ที่ได้อันดับ 1, 2, 3 ในรอบชิงชนะเลิศจริงๆ เท่านั้น
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
                              {medalIcon} {rank === 1 ? "๑" : rank === 2 ? "๒" : "๓"}
                            </td>
                            <td style={{ padding: "5px 4px", textAlign: "left" }}>
                              {w?.athleteName || "-"}
                            </td>
                            <td style={{ padding: "5px 4px", textAlign: "left", fontWeight: 500 }}>
                              {w?.schoolName ? getDisplaySchoolName(w.schoolName) : "-"}
                            </td>
                            <td style={{ padding: "5px 4px", fontWeight: 700 }}>
                              {w?.schoolName ? (rank === 1 ? "๓" : rank === 2 ? "๒" : "๑") : "-"}
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
                        ยังไม่มีผลการแข่งขันกรีฑา (คะแนนจะสรุปจากอันดับ ๑=๓ แต้ม, ๒=๒ แต้ม, ๓=๑ แต้ม ในรอบชิงชนะเลิศ)
                      </td>
                    </tr>
                  ) : (
                    rankedSchools.map((s) => (
                      <tr key={s.schoolName} style={{ borderBottom: "1px solid #fbcfe8" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>
                          {s.place === 1
                            ? "🥇 ๑"
                            : s.place === 2
                              ? "🥈 ๒"
                              : s.place === 3
                                ? "🥉 ๓"
                                : toThaiNumber(s.place)}
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
      {/* ========= MODAL: บันทึกผล อันดับ และ ฟาล์ว (ครบทั้งฮีตในหน้าต่างเดียว) ========= */}
      {/* ========================================================================= */}
      {roundModal && (() => {
        const modalRow = rows.find((r) => r.id === roundModal.rowId);
        if (!modalRow) return null;
        const roundTitle =
          roundModal.roundKey === "r1"
            ? "รอบ ๑ (๕ ลู่)"
            : roundModal.roundKey === "r2"
              ? "รอบ ๒ (๕ ลู่)"
              : "รอบชิงชนะเลิศ (๖ ลู่)";

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
                maxWidth: "880px",
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
                  }}
                >
                  {roundModal.roundKey === "r3" ? (
                    <>
                      🏆 <strong>รอบชิงชนะเลิศ (๖ ลู่):</strong> เลือกอันดับ <strong>ที่ ๑ (ทอง ๓ แต้ม), ที่ ๒ (เงิน ๒ แต้ม), ที่ ๓ (ทองแดง ๑ แต้ม)</strong> หรือระบุสถานะฟาล์วได้ครบทุกลู่ในหน้าต่างเดียว ระบบป้องกันอันดับซ้ำให้อัตโนมัติ
                    </>
                  ) : (
                    <>
                      🏃 <strong>{roundTitle}:</strong> บันทึกอันดับเข้าเส้นชัย <strong>ที่ ๑, ที่ ๒, ที่ ๓</strong> หรือติ๊ก <strong>ฟาล์ว (DQ)</strong> ของแต่ละลู่ได้พร้อมกัน เมื่อกดบันทึก ระบบจะส่งอันดับ ๑–๓ ไปจัดลู่รอบชิงชนะเลิศ (เรียงลู่ <strong>3-2-1-1-2-3</strong>) ให้อัตโนมัติ
                    </>
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
                        <th style={{ padding: "8px", minWidth: "210px", textAlign: "left" }}>โรงเรียน</th>
                        <th style={{ padding: "8px", minWidth: "150px", textAlign: "left" }}>ชื่อ-สกุล นักกีฬา</th>
                        <th style={{ padding: "8px", width: "165px", textAlign: "center" }}>อันดับเข้าเส้นชัย</th>
                        <th style={{ padding: "8px", width: "175px", textAlign: "left" }}>สถานะฟาล์ว (DQ)</th>
                        <th style={{ padding: "8px", width: "95px", textAlign: "center" }}>เวลา/สถิติ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundModal.lanes.map((lane, idx) => {
                        const isFocused = idx === roundModal.focusedLaneIdx;
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
                            {/* Lane Number */}
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

                            {/* School Select */}
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

                            {/* Athlete Name */}
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

                            {/* Rank Select */}
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
                                    <option value="1">🥇 ที่ ๑ (ทอง · ๓ แต้ม)</option>
                                    <option value="2">🥈 ที่ ๒ (เงิน · ๒ แต้ม)</option>
                                    <option value="3">🥉 ที่ ๓ (ทองแดง · ๑ แต้ม)</option>
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
                                {lane.isFoul && <option value="DQ">ฟาล์ว (DQ)</option>}
                              </select>
                            </td>

                            {/* Foul Checkbox & Reason */}
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

                            {/* Time / Stat */}
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
