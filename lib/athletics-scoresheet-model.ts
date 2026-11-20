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
  "โรงเรียนอนุบาลโกสัมพีนคร(บ้านท่าคูณ)",
  "โรงเรียนบ้านดงซ่อม",
  "โรงเรียนบ้านหนองวัวดำ",
  "โรงเรียนบ้านไร่ลำปาง",
  "โรงเรียนบ้านโกสัมพี(วิเศษน้อมมิตรอนุกูล)",
  "โรงเรียนบ้านหนองแดน สาขาโละโคะ",
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
  {
    id: 1,
    no: "1",
    sourceNumber: 101,
    name: "วิ่ง มินิมาราธอน",
    grade: "ประถม",
    type: "ชาย",
    directFinal: true,
    expandableLanes: true,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 2,
    no: "2",
    sourceNumber: 101,
    name: "วิ่ง มินิมาราธอน",
    grade: "ประถม",
    type: "หญิง",
    directFinal: true,
    expandableLanes: true,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 3,
    no: "3",
    sourceNumber: 101,
    name: "วิ่ง มินิมาราธอน",
    grade: "มัธยม",
    type: "ชาย",
    directFinal: true,
    expandableLanes: true,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 4,
    no: "4",
    sourceNumber: 101,
    name: "วิ่ง มินิมาราธอน",
    grade: "มัธยม",
    type: "หญิง",
    directFinal: true,
    expandableLanes: true,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 5,
    no: "5",
    sourceNumber: 106,
    name: "วิ่ง 50 เมตร",
    grade: "อนุบาล",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 6,
    no: "6",
    sourceNumber: 107,
    name: "วิ่ง 50 เมตร",
    grade: "อนุบาล",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 7,
    no: "7",
    sourceNumber: 112,
    name: "วิ่ง 80 เมตร",
    grade: "อนุบาล",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 8,
    no: "8",
    sourceNumber: 113,
    name: "วิ่ง 80 เมตร",
    grade: "อนุบาล",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 9,
    no: "9",
    sourceNumber: 118,
    name: "วิ่ง 60 เมตร",
    grade: "ป.1-3",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 10,
    no: "10",
    sourceNumber: 119,
    name: "วิ่ง 60 เมตร",
    grade: "ป.1-3",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 11,
    no: "11",
    sourceNumber: 124,
    name: "วิ่ง 100 เมตร",
    grade: "ป.1-3",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 12,
    no: "12",
    sourceNumber: 125,
    name: "วิ่ง 100 เมตร",
    grade: "ป.1-3",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 13,
    no: "13",
    sourceNumber: 130,
    name: "วิ่ง 100 เมตร",
    grade: "ป.4-6",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 14,
    no: "14",
    sourceNumber: 131,
    name: "วิ่ง 100 เมตร",
    grade: "ป.4-6",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 15,
    no: "15",
    sourceNumber: 132,
    name: "วิ่ง 100 เมตร",
    grade: "ม.1-3",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 16,
    no: "16",
    sourceNumber: 133,
    name: "วิ่ง 100 เมตร",
    grade: "ม.1-3",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 17,
    no: "17",
    sourceNumber: 138,
    name: "วิ่ง 200 เมตร",
    grade: "ป.4-6",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 18,
    no: "18",
    sourceNumber: 139,
    name: "วิ่ง 200 เมตร",
    grade: "ป.4-6",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 19,
    no: "19",
    sourceNumber: 140,
    name: "วิ่ง 200 เมตร",
    grade: "ม.1-3",
    type: "หญิง",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
  {
    id: 20,
    no: "20",
    sourceNumber: 141,
    name: "วิ่ง 200 เมตร",
    grade: "ม.1-3",
    type: "ชาย",
    directFinal: false,
    r1: ["", "", "", "", ""],
    r2: ["", "", "", "", ""],
    r3: ["", "", "", "", "", ""],
    r1Lanes: defaultLanes(5),
    r2Lanes: defaultLanes(5),
    r3Lanes: defaultLanes(6),
  },
];

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
    updatedRow.winners = computeFinalsWinners(filteredLanes, row);
  }

  return updatedRow;
}

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

export function isMiniMarathonRow(
  rowOrMeta?:
    | boolean
    | { id?: number; name?: string; expandableLanes?: boolean }
    | null,
): boolean {
  if (typeof rowOrMeta === "boolean") return rowOrMeta;
  if (!rowOrMeta) return false;
  return Boolean(
    (typeof rowOrMeta.id === "number" && rowOrMeta.id >= 1 && rowOrMeta.id <= 4) ||
    rowOrMeta.expandableLanes ||
    (typeof rowOrMeta.name === "string" && rowOrMeta.name.includes("มินิมาราธอน"))
  );
}

export function computeFinalsWinners(
  r3Lanes: LaneEntry[],
  isMiniMarathonOrRow?:
    | boolean
    | { id?: number; name?: string; expandableLanes?: boolean },
): WinnerEntry[] {
  const isMini = isMiniMarathonRow(isMiniMarathonOrRow);
  return [1, 2, 3].map((rankNum) => {
    const matchingLane = r3Lanes.find(
      (l) =>
        !l.isFoul &&
        Boolean(l.schoolName) &&
        (l.rank === String(rankNum) || l.rank === `ที่ ${rankNum}`),
    );
    let score = 0;
    if (matchingLane?.schoolName) {
      if (isMini) {
        score = rankNum === 1 ? 5 : rankNum === 2 ? 3 : 2;
      } else {
        score = rankNum === 1 ? 3 : rankNum === 2 ? 2 : 1;
      }
    }
    return {
      rank: rankNum,
      athleteName: matchingLane?.athleteName || "",
      schoolName: matchingLane?.schoolName || "",
      score,
      time: matchingLane?.time || "",
    };
  });
}

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
    [0, r1Third], // ลู่ 1: อันดับ 3 รอบ 1
    [1, r1Second], // ลู่ 2: อันดับ 2 รอบ 1
    [2, r1First], // ลู่ 3: อันดับ 1 รอบ 1
    [3, r2First], // ลู่ 4: อันดับ 1 รอบ 2
    [4, r2Second], // ลู่ 5: อันดับ 2 รอบ 2
    [5, r2Third], // ลู่ 6: อันดับ 3 รอบ 2
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
        rank: changed ? "" : prevLane.rank,
        isFoul: changed ? false : prevLane.isFoul,
        foulReason: changed ? "" : prevLane.foulReason,
        time: changed ? "" : prevLane.time,
      };
      nextR3Cells[targetLaneIdx] = qualifier.schoolName;
    } else {
      if (prevLane && (prevLane.schoolName || prevLane.athleteName)) {
        nextR3Lanes[targetLaneIdx] = {
          lane: targetLaneIdx + 1,
          schoolName: "",
          athleteName: "",
          rank: "",
          isFoul: false,
          foulReason: "",
          time: "",
        };
        nextR3Cells[targetLaneIdx] = "";
      }
    }
  });

  const nextWinners = computeFinalsWinners(nextR3Lanes, row);

  return {
    row: {
      ...row,
      r3: nextR3Cells,
      r3Lanes: nextR3Lanes,
      winners: nextWinners,
    },
    newlyAdvanced,
  };
}

const MERGED_LANE_FIELDS = [
  "schoolName",
  "athleteName",
  "time",
  "rank",
  "isFoul",
  "foulReason",
] as const satisfies readonly (keyof LaneEntry)[];

function mergeConcurrentValue<T>(base: T, local: T, remote: T): T {
  if (Object.is(local, base)) return remote;
  if (Object.is(remote, base)) return local;
  if (Object.is(local, remote)) return local;
  return remote;
}

function laneEquals(a: LaneEntry | undefined, b: LaneEntry | undefined) {
  if (!a || !b) return a === b;
  return MERGED_LANE_FIELDS.every((field) => Object.is(a[field], b[field]));
}

function mergeConcurrentLane(
  base: LaneEntry | undefined,
  local: LaneEntry | undefined,
  remote: LaneEntry | undefined,
  lane: number,
): LaneEntry | undefined {
  if (!local) {
    if (!base) return remote ? { ...remote, lane } : undefined;
    return laneEquals(remote, base) ? undefined : remote ? { ...remote, lane } : undefined;
  }
  if (!remote) {
    if (!base) return { ...local, lane };
    return undefined;
  }

  const merged: LaneEntry = {
    lane,
    schoolName: "",
    athleteName: "",
  };
  for (const field of MERGED_LANE_FIELDS) {
    const value = mergeConcurrentValue(
      base?.[field],
      local[field],
      remote[field],
    );
    Object.assign(merged, { [field]: value });
  }
  return merged;
}

function mergeConcurrentLanes(
  base: LaneEntry[],
  local: LaneEntry[],
  remote: LaneEntry[],
): LaneEntry[] {
  const length = Math.max(base.length, local.length, remote.length);
  return Array.from({ length }, (_, index) =>
    mergeConcurrentLane(base[index], local[index], remote[index], index + 1),
  )
    .filter((lane): lane is LaneEntry => Boolean(lane))
    .map((lane, index) => ({ ...lane, lane: index + 1 }));
}

export function mergeConcurrentAthleticsRows(
  baseRows: AthleticsRow[],
  localRows: AthleticsRow[],
  remoteRows: AthleticsRow[],
): AthleticsRow[] {
  const baseById = new Map(baseRows.map((row) => [row.id, row]));
  const localById = new Map(localRows.map((row) => [row.id, row]));

  return remoteRows.map((remote) => {
    const base = baseById.get(remote.id) || remote;
    const local = localById.get(remote.id) || base;
    const r1Lanes = mergeConcurrentLanes(
      base.r1Lanes,
      local.r1Lanes,
      remote.r1Lanes,
    );
    const r2Lanes = mergeConcurrentLanes(
      base.r2Lanes,
      local.r2Lanes,
      remote.r2Lanes,
    );
    const r3Lanes = mergeConcurrentLanes(
      base.r3Lanes,
      local.r3Lanes,
      remote.r3Lanes,
    );
    const merged: AthleticsRow = {
      ...remote,
      r1Lanes,
      r2Lanes,
      r3Lanes,
      r1: r1Lanes.map((lane) => lane.schoolName || ""),
      r2: r2Lanes.map((lane) => lane.schoolName || ""),
      r3: r3Lanes.map((lane) => lane.schoolName || ""),
      winners: computeFinalsWinners(r3Lanes, remote),
    };
    const synced = syncQualifiersToFinals(merged).row;
    return {
      ...synced,
      winners: computeFinalsWinners(synced.r3Lanes, synced),
    };
  });
}

export function calculateSchoolAthleticsStandings(
  rows: AthleticsRow[],
): SchoolAthleticsStanding[] {
  const tally: Record<
    string,
    { gold: number; silver: number; bronze: number; totalScore: number }
  > = {};

  rows.forEach((r) => {
    const winners = computeFinalsWinners(r.r3Lanes || [], r);
    winners.forEach((w) => {
      if (w.schoolName && w.score > 0) {
        if (!tally[w.schoolName]) {
          tally[w.schoolName] = {
            gold: 0,
            silver: 0,
            bronze: 0,
            totalScore: 0,
          };
        }
        if (w.rank === 1) tally[w.schoolName].gold += 1;
        else if (w.rank === 2) tally[w.schoolName].silver += 1;
        else if (w.rank === 3) tally[w.schoolName].bronze += 1;
        tally[w.schoolName].totalScore += w.score;
      }
    });
  });

  const sorted = Object.entries(tally)
    .map(([schoolName, stats]) => ({
      schoolName,
      ...stats,
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
import type { Award } from "./domain";
import type { Competition } from "./hosted";

export function normalizeSchoolNameForMatch(name: string): string {
  if (!name) return "";
  const cleaned = name
    .trim()
    .replace(/^โรงเรียน\s*/, "")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  if (/ท่าคูณ/.test(cleaned)) return "บ้านท่าคูณ";
  if (/วิเศษน้อมมิตร|^บ้านโกสัมพี$/.test(cleaned)) return "บ้านโกสัมพี";
  if (/โละโคะ/.test(cleaned)) return "บ้านโละโคะ";
  if (/มะเดื่อชุมพร/.test(cleaned)) return "บ้านมะเดื่อชุมพร";
  if (/ดงซ่อม|คงซ่อม/.test(cleaned)) return "บ้านดงซ่อม";
  return cleaned;
}

export function matchSchoolByName<T extends { id: string; name: string }>(
  schoolName: string,
  schools: readonly T[],
): T | undefined {
  const target = normalizeSchoolNameForMatch(schoolName);
  if (!target) return undefined;
  return schools.find(
    (school) =>
      school.name === schoolName ||
      normalizeSchoolNameForMatch(school.name) === target,
  );
}

function normalizeBand(grade: string): string {
  return grade
    .trim()
    .replace(/–/g, "-")
    .replace(/^ประถม$/, "ประถมศึกษา")
    .replace(/^มัธยม$/, "มัธยมศึกษา");
}

export function matchAthleticsRowToCompetition(
  row: AthleticsRow,
  competitions: readonly Competition[],
): Competition | undefined {
  const athleticsCompetitions = competitions.filter(
    (competition) => competition.sport === "กรีฑา",
  );
  if (!athleticsCompetitions.length) return undefined;

  const rowBand = normalizeBand(row.grade);
  const byProgram = athleticsCompetitions.find((competition) => {
    if (competition.gender !== row.type) return false;
    const policy = (competition.registration_policy || {}) as Record<
      string,
      unknown
    >;
    const management = (policy.management || {}) as Record<string, unknown>;
    const program = (management.athleticsProgram || {}) as Record<
      string,
      unknown
    >;
    const slots = Array.isArray(program.slots)
      ? (program.slots as Record<string, unknown>[])
      : [];
    const hasFinalSlot = slots.some(
      (slot) =>
        slot.stage === "final" &&
        Number(slot.sourceNumber) === Number(row.sourceNumber),
    );
    if (!hasFinalSlot) return false;
    if (Number(row.sourceNumber) === 101) {
      const competitionBand = normalizeBand(
        typeof program.levelBand === "string"
          ? program.levelBand
          : competition.age_group,
      );
      return competitionBand === rowBand;
    }
    return true;
  });
  if (byProgram) return byProgram;

  const cleanEventName = row.name.replace(
    /^วิ่ง\s+มินิมาราธอน$/,
    "มินิมาราธอน",
  );
  return athleticsCompetitions.find((competition) => {
    if (competition.gender !== row.type) return false;
    const normalizedName = competition.name.replace(/–/g, "-");
    return (
      normalizedName.includes(cleanEventName) &&
      (normalizedName.includes(row.grade) ||
        normalizeBand(competition.age_group) === rowBand)
    );
  });
}

export function athleticsScoresheetAwards(
  rows: readonly AthleticsRow[],
  schools: readonly { id: string; name: string }[],
  competitions: readonly Competition[] = [],
): Award[] {
  const awards: Award[] = [];
  for (const row of rows) {
    const winners = computeFinalsWinners(row.r3Lanes, row);
    const competition = matchAthleticsRowToCompetition(row, competitions);
    for (const winner of winners) {
      if (!winner.schoolName) continue;
      const school = matchSchoolByName(winner.schoolName, schools);
      if (!school) continue;
      const medal =
        winner.rank === 1
          ? "gold"
          : winner.rank === 2
            ? "silver"
            : winner.rank === 3
              ? "bronze"
              : "";
      if (!medal) continue;
      awards.push({
        id: `athletics-scoresheet:${row.id}:rank-${winner.rank}:${school.id}`,
        event: `${row.name} (${row.grade} ${row.type})`,
        division: competition?.age_group || row.grade,
        gender: row.type,
        school_id: school.id,
        medal,
        ...(competition ? { competition_id: competition.id } : {}),
      });
    }
  }
  return awards;
}

export function mergeAthleticsScoresheetAwards(
  calculated: readonly Award[],
  scoresheetAwards: readonly Award[],
): Award[] {
  if (!scoresheetAwards.length) return [...calculated];
  const coveredCompetitionIds = new Set(
    scoresheetAwards
      .map((award) => award.competition_id)
      .filter((id): id is string => Boolean(id)),
  );
  const coveredEvents = new Set(scoresheetAwards.map((award) => award.event));
  return [
    ...calculated.filter(
      (award) =>
        !(
          (award.competition_id &&
            coveredCompetitionIds.has(award.competition_id)) ||
          coveredEvents.has(award.event)
        ),
    ),
    ...scoresheetAwards,
  ];
}
