import type { Competition } from "@/lib/hosted";
import { formatProgramDate, formatSessionDate } from "@/lib/schedule-view";

type ProgramEvent = {
  eventId: string;
  eventName: string;
  levelBand: string;
  date: string;
  sessionStart: string;
  slots: {
    sourceNumber: number;
    stage: "heat" | "final";
    heat: number;
    note?: string;
  }[];
};
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export default function AthleticsProgram({
  competitions,
}: {
  competitions: Competition[];
}) {
  const rows = competitions
    .flatMap((competition) => {
      const management = object(
        object(competition.registration_policy).management,
      );
      const candidates = Array.isArray(management.athleticsProgram)
        ? management.athleticsProgram
        : [management.athleticsProgram];
      const events = candidates.filter((value): value is ProgramEvent => {
        const event = object(value);
        return (
          ["eventId", "eventName", "levelBand", "date", "sessionStart"].every(
            (key) => typeof event[key] === "string",
          ) &&
          Array.isArray(event.slots) &&
          event.slots.every((value) => {
            const slot = object(value);
            return (
              Number.isSafeInteger(slot.sourceNumber) &&
              (slot.stage === "heat" || slot.stage === "final") &&
              Number.isSafeInteger(slot.heat)
            );
          })
        );
      });
      return events.flatMap((event) =>
        event.slots.map((slot) => ({ competition, event, slot })),
      );
    })
    .sort(
      (a, b) =>
        a.event.date.localeCompare(b.event.date) ||
        a.slot.sourceNumber - b.slot.sourceNumber ||
        a.competition.name.localeCompare(b.competition.name, "th") ||
        a.event.eventId.localeCompare(b.event.eventId),
    );
  const pending = competitions.filter(
    (competition) =>
      competition.sport === "เปตอง" &&
      object(object(competition.registration_policy).management).drawPending ===
        true,
  );
  if (!rows.length && !pending.length) return null;
  return (
    <section
      className="athletics-program"
      aria-label="โปรแกรมกรีฑาตามกำหนดการแข่งขัน"
    >
      {pending.map((competition) => {
        const range = object(
          object(object(competition.registration_policy).management).dateRange,
        );
        return (
          <article className="program-draw-notice" key={competition.id}>
            <h3>{competition.name}</h3>
            <p>รอจับสลากและประกาศคู่แข่งขัน</p>
            {typeof range.start === "string" &&
              typeof range.end === "string" && (
                <p>
                  {formatProgramDate(range.start)} –{" "}
                  {formatProgramDate(range.end)}
                </p>
              )}
          </article>
        );
      })}
      {rows.length > 0 && (
        <>
          <h3>โปรแกรมกรีฑา</h3>
          <p>
            เวลาเริ่มเป็นเวลาของช่วงการแข่งขัน
            รายการย่อยใช้เลขรายการร่วมกันตามกำหนดการ
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>รายการที่</th>
                  <th>ประเภท</th>
                  <th>รุ่น / เพศ</th>
                  <th>รอบ</th>
                  <th>วันและช่วงเวลา</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ competition, event, slot }, index) => (
                  <tr
                    key={`${competition.id}-${event.eventId}-${slot.sourceNumber}-${index}`}
                  >
                    <td>{slot.sourceNumber}</td>
                    <td>{event.eventName}</td>
                    <td>
                      {event.levelBand} · {competition.gender}
                    </td>
                    <td>
                      {slot.stage === "final"
                        ? "ชิงชนะเลิศ"
                        : `คัดเลือก ฮีต ${slot.heat}`}
                    </td>
                    <td>{formatSessionDate(event.date, event.sessionStart)}</td>
                    <td>{slot.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
