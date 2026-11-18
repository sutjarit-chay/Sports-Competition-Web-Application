"use client";
import { useEffect, useId, useRef } from "react";
import { medals, type Award } from "@/lib/domain";
import { medalNames, schoolMedalDetails } from "@/lib/school-medal-details";

type Standings = ReturnType<typeof medals>;
export function MedalStandingsTable({
  rows,
  schoolName,
  onSelect,
}: {
  rows: Standings;
  schoolName: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="table-wrap school-medal-standings"
      role="region"
      aria-label="ตารางเหรียญรางวัล คลิกโรงเรียนเพื่อดูรายละเอียด"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {[
              "อันดับ",
              "โรงเรียน",
              "🥇 ทอง",
              "🥈 เงิน",
              "🥉 ทองแดง",
              "รวม",
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr
                key={row.school}
                className="school-medal-row"
                onClick={(event) => {
                  event.currentTarget.querySelector("button")?.focus();
                  onSelect(row.school);
                }}
              >
                <td className="numeric">{index + 1}</td>
                <th scope="row">
                  <button
                    type="button"
                    className="school-medal-trigger"
                    aria-haspopup="dialog"
                    aria-label={`ดูรายการเหรียญของ ${schoolName(row.school)}`}
                  >
                    {schoolName(row.school)}
                  </button>
                </th>
                <td className="numeric medal-gold">{row.gold}</td>
                <td className="numeric medal-silver">{row.silver}</td>
                <td className="numeric medal-bronze">{row.bronze}</td>
                <td className="numeric">
                  {row.gold + row.silver + row.bronze}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6}>ยังไม่มีผลเหรียญรางวัล</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function SchoolMedalDialog({
  school,
  awards,
  competitionName,
  onClose,
}: {
  school: { id: string; name: string } | null;
  awards: Award[];
  competitionName: (id: string | undefined) => string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Parent state owns closing. Echoing the queued native close event can
  // incorrectly dismiss a dialog that has already been reopened.
  useEffect(() => {
    const dialog = ref.current;
    if (school && dialog && !dialog.open) dialog.showModal();
    if (!school && dialog?.open) dialog.close();
  }, [school?.id]);
  const details = schoolMedalDetails(awards, school?.id || "", competitionName);
  return (
    <dialog
      ref={ref}
      className="match-result-dialog school-medal-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="match-result-dialog-content">
        <div className="match-report-dialog-header">
          <h2 id={titleId}>
            {school
              ? `รายการเหรียญของ ${school.name}`
              : "รายการเหรียญของโรงเรียน"}
          </h2>
          <button
            type="button"
            className="match-report-close"
            aria-label="ปิดรายละเอียดเหรียญ"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {school && (
          <>
            <p
              className="school-medal-summary"
              aria-label="สรุปเหรียญของโรงเรียน"
            >
              <span>🥇 ทอง {details.totals.gold}</span>
              <span>🥈 เงิน {details.totals.silver}</span>
              <span>🥉 ทองแดง {details.totals.bronze}</span>
              <strong>รวม {details.totals.total} เหรียญ</strong>
            </p>
            <p className="muted">
              เรียงเหรียญทอง เงิน ทองแดง แล้วเรียงชื่อรายการ
              ใช้ผลชุดเดียวกับตารางเหรียญ
            </p>
            {details.rows.length ? (
              <table className="school-medal-detail-table">
                <caption>รายการแข่งขันที่ได้รับเหรียญ</caption>
                <thead>
                  <tr>
                    {["รายการแข่งขัน", "ระดับชั้น", "เพศ", "เหรียญ"].map(
                      (label) => (
                        <th key={label} scope="col">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {details.rows.map((row, index) => (
                    <tr key={`${row.id}:${index}`}>
                      <th scope="row">
                        {row.name}
                        {!row.name
                          .replace(/\s/g, "")
                          .includes(row.event.replace(/\s/g, "")) && (
                          <small>{row.event}</small>
                        )}
                      </th>
                      <td>{row.division || "ไม่ระบุ"}</td>
                      <td>{row.gender || "ไม่ระบุ"}</td>
                      <td>
                        <span className={`medal-label medal-${row.medal}`}>
                          {medalNames[row.medal]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p role="status">ยังไม่มีรายการที่ได้รับเหรียญ</p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
