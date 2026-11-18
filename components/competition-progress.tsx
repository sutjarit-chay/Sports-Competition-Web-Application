import { buildCompetitionProgress } from "@/lib/competition-progress";
import type {
  AthleticsEvent,
  AthleticsResult,
  Competition,
} from "@/lib/hosted";
import type { ScheduleMatch } from "@/lib/schedule-view";

type Props = {
  competitions: Competition[];
  matches: ScheduleMatch[];
  athleticsEvents: AthleticsEvent[];
  athleticsResults: AthleticsResult[];
  schoolName: (id: string) => string;
  loading: boolean;
  error: boolean;
};
export default function CompetitionProgress({
  loading,
  error,
  ...data
}: Props) {
  const rows = buildCompetitionProgress(data);
  return (
    <section
      className="panel competition-progress"
      aria-labelledby="competition-progress-title"
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">COMPETITION PROGRESS</p>
          <h2 id="competition-progress-title">ความคืบหน้าการแข่งขัน</h2>
        </div>
        <span className="muted">ตลอดการแข่งขัน</span>
      </div>
      {loading ? (
        <p role="status">กำลังโหลดความคืบหน้าการแข่งขัน…</p>
      ) : error ? (
        <p role="alert">โหลดความคืบหน้าไม่สำเร็จ กรุณากดโหลดข้อมูลใหม่</p>
      ) : !rows.length ? (
        <p role="status">ยังไม่มีรายการแข่งขัน</p>
      ) : (
        <>
          <p className="muted">
            นับจากโปรแกรมทั้งหมด รวมคู่ที่รอผู้ผ่านเข้ารอบ
            คู่ถัดไปเรียงตามวันที่แล้วเลขคู่
          </p>
          <p className="progress-scroll-hint muted">
            บนมือถือ เลื่อนตารางแนวนอนเพื่อดูข้อมูลครบ
          </p>
          <div
            className="progress-table-scroll"
            role="region"
            aria-label="ตารางความคืบหน้าการแข่งขัน เลื่อนแนวนอนได้"
            tabIndex={0}
          >
            <table aria-describedby="competition-progress-note">
              <caption>สรุปทุกรายการตลอดการแข่งขัน</caption>
              <thead>
                <tr>
                  {[
                    "รายการแข่งขัน",
                    "จำนวนคู่/แมตช์/ฮีต",
                    "แข่งแล้ว / มีผลแล้ว",
                    "คงเหลือ",
                    "คู่ถัดไป / ฮีตถัดไป",
                  ].map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-competition-id={row.id}>
                    <th scope="row">
                      <strong>{row.name}</strong>
                      <small>
                        {row.level} · {row.gender} · {row.unit}
                      </small>
                    </th>
                    <td className="progress-number">{row.total ?? "—"}</td>
                    <td className="progress-number progress-done">
                      {row.completed ?? "—"}
                      {row.unit === "ฮีต/รอบ" && row.completed != null && (
                        <small>มีผลแล้ว</small>
                      )}
                    </td>
                    <td className="progress-number progress-remaining">
                      {row.remaining ?? "—"}
                    </td>
                    <td>
                      <span
                        className={
                          row.state === "complete" ? "progress-complete" : ""
                        }
                      >
                        {row.nextLabel}
                      </span>
                      {row.nextWhen && <small>{row.nextWhen}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p id="competition-progress-note" className="muted">
            กีฬาทีมนับแข่งแล้วเมื่อยืนยันผล กรีฑานับฮีต/รอบที่มีผลบันทึกแล้ว
            ไม่ใช่จำนวนรายชื่อนักกีฬาและไม่ใช่การยืนยันจบทั้งฮีต
            รายการที่ยังไม่จัดคู่แสดง “—”
          </p>
        </>
      )}
    </section>
  );
}
