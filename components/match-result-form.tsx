"use client";

import { useState } from "react";
import type { Match } from "@/lib/domain";
import { formatScheduleDate, type ScheduleMatch } from "@/lib/schedule-view";
import { isSetSport, validateSetScores, type SetScore } from "@/lib/set-scores";

type Props = {
  match: ScheduleMatch;
  schoolName: (id: string) => string;
  busy: boolean;
  canEdit: boolean;
  onSubmit: (home: number, away: number, setScores?: SetScore[]) => void;
  onViewResult?: (match: Match) => void;
};
type DraftSet = { home: string; away: string };
const emptySet = (): DraftSet => ({ home: "", away: "" });

export function MatchResultForm(props: Props) {
  return (
    <ResultEntry
      key={`${props.match.id}:${props.match.revision ?? 0}`}
      {...props}
    />
  );
}

function ResultEntry({
  match,
  schoolName,
  busy,
  canEdit,
  onSubmit,
  onViewResult,
}: Props) {
  const setSport = isSetSport(match.sport);
  const [recordSets, setRecordSets] = useState(
    setSport &&
      (Boolean(match.setScores?.length) || match.status !== "finished"),
  );
  const [rows, setRows] = useState<DraftSet[]>(() =>
    match.setScores?.length
      ? match.setScores.map((set) => ({
          home: String(set.home),
          away: String(set.away),
        }))
      : [emptySet(), emptySet()],
  );
  const [home, setHome] = useState(String(match.home_score ?? ""));
  const [away, setAway] = useState(String(match.away_score ?? ""));
  const [error, setError] = useState("");
  const totals = rows.reduce(
    (score, row) => {
      if (row.home !== "" && row.away !== "") {
        if (Number(row.home) > Number(row.away)) score.home++;
        if (Number(row.away) > Number(row.home)) score.away++;
      }
      return score;
    },
    { home: 0, away: 0 },
  );
  const disabled = !canEdit || busy;
  const updateRow = (index: number, side: keyof DraftSet, value: string) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [side]: value } : row)),
    );
    setError("");
  };
  return (
    <form
      className="match-form result-entry"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        const homeScore = recordSets ? totals.home : Number(home);
        const awayScore = recordSets ? totals.away : Number(away);
        let scores: SetScore[] | undefined;
        try {
          if (recordSets) {
            if (rows.some((row) => row.home === "" || row.away === ""))
              throw new Error("กรุณากรอกแต้มทั้งสองทีมให้ครบทุกเซตที่เล่น");
            scores = rows.map((row) => ({
              home: Number(row.home),
              away: Number(row.away),
            }));
            validateSetScores(scores, homeScore, awayScore, match.sport);
          } else if (
            home === "" ||
            away === "" ||
            !Number.isInteger(homeScore) ||
            !Number.isInteger(awayScore) ||
            homeScore < 0 ||
            awayScore < 0
          ) {
            throw new Error(
              "กรุณาระบุคะแนนเป็นจำนวนเต็มตั้งแต่ 0 ของทั้งสองทีม",
            );
          }
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "กรุณาตรวจสอบคะแนนอีกครั้ง",
          );
          return;
        }
        const detail = scores
          ?.map(
            (set, index) => `เซตที่ ${index + 1}: ${set.home} – ${set.away}`,
          )
          .join("\n");
        if (
          !window.confirm(
            `ตรวจสอบผลก่อนยืนยัน:\n${schoolName(match.home)} ${homeScore} – ${awayScore} ${schoolName(match.away)}${detail ? `\n${detail}` : ""}\n${formatScheduleDate(match)} · ${match.venue || "ไม่ระบุสนาม"}`,
          )
        )
          return;
        onSubmit(homeScore, awayScore, scores);
      }}
    >
      <b>
        {match.sourceNumber != null && `คู่ที่ ${match.sourceNumber} · `}
        สาย {match.pool} · {schoolName(match.home)} — {schoolName(match.away)}
      </b>
      <small className="muted">
        {formatScheduleDate(match)} · {match.venue || "ไม่ระบุสนาม"}
      </small>
      {setSport && (
        <label className="set-entry-toggle">
          <input
            type="checkbox"
            checked={recordSets}
            disabled={disabled}
            onChange={(event) => {
              setRecordSets(event.target.checked);
              setError("");
            }}
          />
          บันทึกแต้มรายเซต
        </label>
      )}
      {setSport && match.status === "finished" && !match.setScores?.length && (
        <p className="muted set-entry-note">
          ยังไม่มีแต้มรายเซต · ไม่สมมติแต้มจากผลรวมเดิม
        </p>
      )}
      {recordSets && (
        <fieldset className="set-entry-fields" disabled={disabled}>
          <legend>แต้มรายเซต · ชนะ 2 ใน 3 เซต</legend>
          {rows.map((row, index) => (
            <div className="set-entry-row" key={index}>
              <label>
                เซตที่ {index + 1} · {schoolName(match.home)}
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={row.home}
                  onChange={(event) =>
                    updateRow(index, "home", event.target.value)
                  }
                />
              </label>
              <label>
                เซตที่ {index + 1} · {schoolName(match.away)}
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={row.away}
                  onChange={(event) =>
                    updateRow(index, "away", event.target.value)
                  }
                />
              </label>
              {index === 2 && (
                <button
                  type="button"
                  className="set-entry-remove"
                  onClick={() => {
                    setRows((current) => current.slice(0, 2));
                    setError("");
                  }}
                >
                  ลบเซตที่ 3 (ไม่ได้เล่น)
                </button>
              )}
            </div>
          ))}
          {rows.length < 3 && (
            <button
              type="button"
              onClick={() => setRows((current) => [...current, emptySet()])}
            >
              เพิ่มเซตที่ 3
            </button>
          )}
        </fieldset>
      )}
      <div className="result-entry-totals">
        <label>
          เจ้าบ้าน
          <input
            type="number"
            name="home"
            min="0"
            step="1"
            required
            value={recordSets ? totals.home : home}
            readOnly={recordSets}
            disabled={disabled}
            onChange={(event) => setHome(event.target.value)}
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
            value={recordSets ? totals.away : away}
            readOnly={recordSets}
            disabled={disabled}
            onChange={(event) => setAway(event.target.value)}
          />
        </label>
        {recordSets && (
          <small className="muted">ผลรวมคำนวณจากจำนวนเซตที่ชนะ</small>
        )}
      </div>
      {error && (
        <p className="set-entry-error" role="alert">
          {error}
        </p>
      )}
      <span className="badge">
        {match.status === "finished"
          ? `ยืนยันผลแล้ว · ${match.home_score} – ${match.away_score}`
          : "รอส่งผล"}
      </span>
      {canEdit && (
        <button type="submit" className="primary" disabled={busy}>
          ยืนยันผล
        </button>
      )}
      {match.status === "finished" && onViewResult && (
        <button type="button" onClick={() => onViewResult(match)}>
          ดูผลการแข่งขัน
        </button>
      )}
    </form>
  );
}
