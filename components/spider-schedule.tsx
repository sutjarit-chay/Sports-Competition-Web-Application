"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import type { Match } from "@/lib/domain";

const MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function formatScheduleDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match) return value || "รอกำหนดเวลา";
  const [, year, month, day, time] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${Number(year) + 543} · ${time} น.`;
}

function shortSchoolName(value: string) {
  const chars = Array.from(value);
  return chars.length > 15 ? `${chars.slice(0, 14).join("")}…` : value;
}

export default function SpiderSchedule({
  matches,
  schoolName,
  canEdit,
  busy,
  canAssign,
  onSave,
}: {
  matches: Match[];
  schoolName: (id: string) => string;
  canEdit: boolean;
  busy: boolean;
  canAssign: boolean;
  onSave: (
    match: Match,
    startsAt: string,
    venue: string,
    refereeId: string,
  ) => void;
}) {
  const [activeRound, setActiveRound] = useState("");
  const [activeCompetition, setActiveCompetition] = useState("");
  const [view, setView] = useState<"bracket" | "matrix">("bracket");
  const competitions = useMemo(() => {
    const options = new Map<string, Match>();
    for (const match of matches)
      options.set(match.competition_id || "__unassigned", match);
    return [...options].map(([id, match]) => {
      return {
        id,
        name: `${match.sport} · ${match.division} · ${match.gender}${
          options.size > 1 ? ` · ${id.slice(-6)}` : ""
        }`,
      };
    });
  }, [matches]);
  const competition =
    competitions.find((item) => item.id === activeCompetition) ||
    competitions[0];
  const competitionMatches = matches.filter(
    (match) => (match.competition_id || "__unassigned") === competition?.id,
  );
  const rounds = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const match of competitionMatches)
      groups.set(match.pool, [...(groups.get(match.pool) || []), match]);
    return [...groups]
      .map(([name, fixtures]) => ({
        name,
        fixtures: [...fixtures].sort(
          (first, second) =>
            first.starts_at.localeCompare(second.starts_at) ||
            first.home.localeCompare(second.home),
        ),
        startsAt:
          fixtures
            .map((fixture) => fixture.starts_at)
            .filter(Boolean)
            .sort()[0] || "",
      }))
      .sort(
        (first, second) =>
          first.startsAt.localeCompare(second.startsAt) ||
          first.name.localeCompare(second.name, "th"),
      );
  }, [competitionMatches]);
  const round = rounds.find((item) => item.name === activeRound) || rounds[0];
  const teams = round
    ? [...new Set(round.fixtures.flatMap((match) => [match.home, match.away]))]
    : [];
  const matrixTeams = [
    ...new Set(competitionMatches.flatMap((match) => [match.home, match.away])),
  ];
  const pairings = new Map(
    competitionMatches.map((match) => [
      [match.home, match.away].sort().join(":"),
      match,
    ]),
  );

  return (
    <div className="spider-schedule">
      {rounds.length === 0 ? (
        <div className="spider-empty">
          <CalendarDays aria-hidden="true" />
          <strong>ยังไม่มีโปรแกรมแข่งขันในรายการนี้</strong>
          <span>เลือกกีฬา รุ่น และเพศที่มีการจัดสายแล้ว</span>
        </div>
      ) : (
        <>
          {competitions.length > 1 && (
            <label className="spider-competition-picker">
              รายการแข่งขัน
              <select
                aria-label="เลือกรายการแข่งขันในผัง"
                value={competition?.id || ""}
                onChange={(event) => {
                  setActiveCompetition(event.target.value);
                  setActiveRound("");
                }}
              >
                {competitions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="spider-round-picker" aria-label="เลือกรอบแข่งขัน">
            {rounds.map((item, index) => (
              <button
                type="button"
                key={item.name}
                aria-pressed={item.name === round?.name}
                onClick={() => setActiveRound(item.name)}
              >
                <span>รอบ {index + 1}</span>
                <small>{item.fixtures.length} คู่</small>
              </button>
            ))}
          </div>
          <div className="spider-round-heading">
            <div>
              <p className="eyebrow">การแข่งขันแบบพบกันหมด</p>
              <h3>{round?.name}</h3>
            </div>
            <span>
              <Trophy aria-hidden="true" />
              {round?.fixtures.length} คู่แข่งขัน
            </span>
          </div>
          <div className="schedule-view-switch" aria-label="รูปแบบแผนผัง">
            <button
              type="button"
              aria-pressed={view === "bracket"}
              onClick={() => setView("bracket")}
            >
              ผังจับคู่รายรอบ
            </button>
            <button
              type="button"
              aria-pressed={view === "matrix"}
              onClick={() => setView("matrix")}
            >
              ผังพบกันหมด
            </button>
          </div>
          <div className="spider-layout">
            {view === "bracket" ? (
              <div
                className="schedule-bracket"
                role="img"
                aria-label={`ผังจับคู่ ${round?.name}`}
              >
                <div className="schedule-bracket-labels">
                  <span>โรงเรียน</span>
                  <span>คู่แข่งขัน</span>
                </div>
                <div className="schedule-bracket-body">
                  <div className="schedule-bracket-teams">
                    {round?.fixtures.flatMap((match, index) => [
                      <div
                        className="schedule-bracket-team"
                        key={`${match.id}-home`}
                      >
                        <small>{index * 2 + 1}</small>
                        <strong title={schoolName(match.home)}>
                          {shortSchoolName(schoolName(match.home))}
                        </strong>
                      </div>,
                      <div
                        className="schedule-bracket-team"
                        key={`${match.id}-away`}
                      >
                        <small>{index * 2 + 2}</small>
                        <strong title={schoolName(match.away)}>
                          {shortSchoolName(schoolName(match.away))}
                        </strong>
                      </div>,
                    ])}
                  </div>
                  <svg
                    className="schedule-bracket-lines"
                    viewBox={`0 0 104 ${Math.max(1, teams.length) * 76}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    {round?.fixtures.map((match, index) => {
                      const firstY = index * 152 + 38;
                      const secondY = firstY + 76;
                      const centerY = (firstY + secondY) / 2;
                      return (
                        <path
                          key={match.id}
                          d={`M 0 ${firstY} H 48 V ${secondY} H 0 M 48 ${centerY} H 104`}
                        />
                      );
                    })}
                  </svg>
                  <div className="schedule-bracket-games">
                    {round?.fixtures.map((match, index) => (
                      <div className="schedule-bracket-game" key={match.id}>
                        <strong>คู่ที่ {index + 1}</strong>
                        <span>
                          {match.status === "finished" &&
                          match.home_score !== undefined &&
                          match.away_score !== undefined
                            ? `${match.home_score} – ${match.away_score}`
                            : "พบกัน"}
                        </span>
                        <small>{formatScheduleDate(match.starts_at)}</small>
                        <small>{match.venue || "รอกำหนดสนาม"}</small>
                      </div>
                    ))}
                  </div>
                </div>
                <p>แต่ละเส้นเชื่อมโรงเรียนเข้ากับคู่แข่งขันของรอบนี้</p>
              </div>
            ) : (
              <div
                className="round-robin-matrix"
                role="region"
                aria-label="ผังพบกันหมด"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">โรงเรียน</th>
                      {matrixTeams.map((team) => (
                        <th scope="col" key={team} title={schoolName(team)}>
                          {shortSchoolName(schoolName(team))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixTeams.map((rowTeam) => (
                      <tr key={rowTeam}>
                        <th scope="row" title={schoolName(rowTeam)}>
                          {schoolName(rowTeam)}
                        </th>
                        {matrixTeams.map((columnTeam) => {
                          const match =
                            rowTeam === columnTeam
                              ? undefined
                              : pairings.get(
                                  [rowTeam, columnTeam].sort().join(":"),
                                );
                          return (
                            <td
                              key={columnTeam}
                              className={
                                rowTeam === columnTeam
                                  ? "matrix-diagonal"
                                  : match?.status === "finished"
                                    ? "matrix-played"
                                    : "matrix-fixture"
                              }
                              title={
                                match
                                  ? `${match.pool} · ${formatScheduleDate(match.starts_at)} · ${match.venue || "รอกำหนดสนาม"}`
                                  : undefined
                              }
                            >
                              {rowTeam === columnTeam
                                ? "—"
                                : match?.pool.replace("รอบ ", "ร")}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>ตัวเลขในช่องคือรอบที่โรงเรียนคู่นั้นแข่งขันกัน</p>
              </div>
            )}
            <div className="spider-match-list">
              {round?.fixtures.map((match, index) => (
                <article className="spider-match-card" key={match.id}>
                  <header>
                    <span>
                      {round.name} · คู่ที่ {index + 1}
                    </span>
                    <small
                      className={
                        match.status === "finished"
                          ? "spider-match-status is-finished"
                          : "spider-match-status"
                      }
                    >
                      {match.status === "finished"
                        ? "จบการแข่งขัน"
                        : "รอแข่งขัน"}
                    </small>
                  </header>
                  <div className="spider-match-teams">
                    <strong title={schoolName(match.home)}>
                      {schoolName(match.home)}
                    </strong>
                    <span>
                      {match.status === "finished" &&
                      match.home_score !== undefined &&
                      match.away_score !== undefined
                        ? `${match.home_score} – ${match.away_score}`
                        : "พบ"}
                    </span>
                    <strong title={schoolName(match.away)}>
                      {schoolName(match.away)}
                    </strong>
                  </div>
                  <div className="spider-match-details">
                    <span>
                      <CalendarDays aria-hidden="true" />
                      {formatScheduleDate(match.starts_at)}
                    </span>
                    <span>
                      <MapPin aria-hidden="true" />
                      {match.venue || "รอกำหนดสนาม"}
                    </span>
                  </div>
                  {canEdit && (
                    <form
                      className="spider-edit-form"
                      onSubmit={(event: FormEvent<HTMLFormElement>) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        onSave(
                          match,
                          String(form.get("startsAt") || ""),
                          String(form.get("venue") || ""),
                          String(form.get("refereeId") || ""),
                        );
                      }}
                    >
                      <label>
                        วันเวลา
                        <input
                          name="startsAt"
                          type="datetime-local"
                          defaultValue={match.starts_at}
                        />
                      </label>
                      <label>
                        สนาม
                        <input
                          name="venue"
                          defaultValue={match.venue}
                          maxLength={120}
                        />
                      </label>
                      {canAssign && (
                        <label>
                          รหัสผู้ใช้กรรมการ (UUID)
                          <input
                            name="refereeId"
                            defaultValue={match.referee_id || ""}
                            maxLength={36}
                            placeholder="เว้นว่างเพื่อถอนการมอบหมาย"
                          />
                        </label>
                      )}
                      <button type="submit" disabled={busy}>
                        บันทึกเวลา
                      </button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
