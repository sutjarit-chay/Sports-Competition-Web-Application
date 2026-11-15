"use client";

import { useEffect, useId, useRef } from "react";
import type { Match } from "../lib/domain";
import { isSetSport } from "../lib/set-scores";
import { formatScheduleDate, type ScheduleMatch } from "../lib/schedule-view";

type Names = {
  schoolName: (id: string) => string;
  competitionName?: (id: string | undefined) => string;
};
function hasScore(match: Match) {
  return (
    typeof match.home_score === "number" && typeof match.away_score === "number"
  );
}
function outcome(match: Match, schoolName: Names["schoolName"]) {
  if (!hasScore(match)) return "ยังไม่มีผลคะแนน";
  return match.home_score === match.away_score
    ? "เสมอ"
    : `ผู้ชนะ: ${schoolName(match.home_score! > match.away_score! ? match.home : match.away)}`;
}
function title(match: Match, competitionName?: Names["competitionName"]) {
  return (
    (match as ScheduleMatch).competitionName ||
    competitionName?.(match.competition_id) ||
    `${match.sport} · ${match.gender} · ${match.division}`
  );
}
function SetPoints({ match, schoolName }: { match: Match } & Names) {
  if (!match.setScores?.length)
    return isSetSport(match.sport) ? (
      <p className="match-report-muted">ยังไม่มีข้อมูลแต้มรายเซต</p>
    ) : null;
  return (
    <div className="match-report-table-scroll">
      <table className="match-report-set-table">
        <caption>แต้มรายเซต</caption>
        <thead>
          <tr>
            <th scope="col">เซต</th>
            <th scope="col">{schoolName(match.home)}</th>
            <th scope="col">{schoolName(match.away)}</th>
          </tr>
        </thead>
        <tbody>
          {match.setScores.map((score, index) => (
            <tr key={index}>
              <th scope="row">{index + 1}</th>
              <td>{score.home}</td>
              <td>{score.away}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MatchResultsReport({
  matches,
  schoolName,
  competitionName,
  onSelect,
}: Names & { matches: Match[]; onSelect: (match: Match) => void }) {
  const finished = matches.filter((match) => match.status === "finished");
  if (!finished.length)
    return (
      <p className="match-report-empty">ยังไม่มีผลการแข่งขันที่ยืนยันแล้ว</p>
    );
  return (
    <div className="match-report-grid">
      {finished.map((match) => (
        <button
          type="button"
          className="match-report-card"
          key={match.id}
          onClick={() => onSelect(match)}
          aria-haspopup="dialog"
        >
          <span className="match-report-card-top">
            <span>{title(match, competitionName)}</span>
            <span className="match-report-status">แข่งขันเสร็จแล้ว</span>
          </span>
          <span className="match-report-meta">
            {match.pool} · {formatScheduleDate(match)}
          </span>
          <span className="match-report-score-row">
            <span>{schoolName(match.home)}</span>
            <strong>
              {match.home_score ?? "–"} : {match.away_score ?? "–"}
            </strong>
            <span>{schoolName(match.away)}</span>
          </span>
          <span className="match-report-outcome">
            {outcome(match, schoolName)}
          </span>
          {!!match.setScores?.length && (
            <span className="match-report-set-chips">
              {match.setScores.map((score, index) => (
                <span key={index}>
                  เซต {index + 1}: {score.home}–{score.away}
                </span>
              ))}
            </span>
          )}
          <span className="match-report-detail-link">
            ดูรายละเอียดการแข่งขัน →
          </span>
        </button>
      ))}
    </div>
  );
}

export function MatchResultDialog({
  match,
  schoolName,
  competitionName,
  onClose,
  points,
}: Names & {
  match: Match | null;
  onClose: () => void;
  points?: { win: number; draw: number; loss: number };
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (match && dialog && !dialog.open) dialog.showModal();
    if (!match && dialog?.open) dialog.close();
  }, [match]);
  const league =
    match &&
    points &&
    hasScore(match) &&
    match.phase !== "knockout" &&
    (match.phase === "group" || match.format === "round_robin");
  return (
    <dialog
      ref={ref}
      className="match-result-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const box = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom
          )
            onClose();
        }
      }}
    >
      <div className="match-result-dialog-content">
        <div className="match-report-dialog-header">
          <h2 id={titleId}>รายละเอียดผลการแข่งขัน</h2>
          <button
            type="button"
            className="match-report-close"
            onClick={onClose}
            autoFocus
            aria-label="ปิดรายละเอียดผลการแข่งขัน"
          >
            ×
          </button>
        </div>
        {match && (
          <>
            <p>{title(match, competitionName)}</p>
            <p className="match-report-status">
              {match.status === "finished"
                ? "แข่งขันเสร็จแล้ว"
                : "ยังไม่ยืนยันผล"}
            </p>
            <dl className="match-report-facts">
              <div>
                <dt>ประเภท</dt>
                <dd>
                  {match.sport} · {match.gender} · {match.division}
                </dd>
              </div>
              <div>
                <dt>รอบแข่งขัน</dt>
                <dd>
                  {match.pool || "–"}
                  {(match as ScheduleMatch).sourceNumber
                    ? ` · คู่ที่ ${(match as ScheduleMatch).sourceNumber}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>วันเวลา</dt>
                <dd>{formatScheduleDate(match)}</dd>
              </div>
              <div>
                <dt>สนามแข่งขัน</dt>
                <dd>{match.venue || "ยังไม่ระบุสนาม"}</dd>
              </div>
            </dl>
            <div className="match-report-score-row match-report-score-large">
              <span>{schoolName(match.home)}</span>
              <strong>
                {match.home_score ?? "–"} : {match.away_score ?? "–"}
              </strong>
              <span>{schoolName(match.away)}</span>
            </div>
            <p className="match-report-outcome">{outcome(match, schoolName)}</p>
            <SetPoints match={match} schoolName={schoolName} />
            {league && (
              <p className="match-report-league-points">
                คะแนนตาราง: {schoolName(match.home)}{" "}
                {match.home_score === match.away_score
                  ? points.draw
                  : match.home_score! > match.away_score!
                    ? points.win
                    : points.loss}{" "}
                · {schoolName(match.away)}{" "}
                {match.home_score === match.away_score
                  ? points.draw
                  : match.away_score! > match.home_score!
                    ? points.win
                    : points.loss}
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
