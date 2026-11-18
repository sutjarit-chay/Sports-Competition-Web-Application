"use client";
import { useState } from "react";
import {
  PLACEMENT_LIMITS,
  emptyPlacements,
  type DirectPlacements,
  type PlacementInput,
} from "@/lib/direct-placements";

type School = { id: string; name: string };
type Props = {
  competitionName: string;
  placements: DirectPlacements | null;
  schools: School[];
  canToggle: boolean;
  busy: boolean;
  onToggle: (enabled: boolean, revision: number) => void | Promise<void>;
  onSave: (
    placements: PlacementInput,
    revision: number,
  ) => void | Promise<void>;
};

export function DirectPlacementPanel({
  competitionName,
  placements,
  schools,
  canToggle,
  busy,
  onToggle,
  onSave,
}: Props) {
  const current = placements || emptyPlacements();
  const [first, setFirst] = useState(current.first[0] || "");
  const [second, setSecond] = useState(current.second[0] || "");
  const [third, setThird] = useState<string[]>(current.third);
  const name = (id: string) =>
    schools.find((school) => school.id === id)?.name || id;
  const taken = (id: string, own: "first" | "second" | "third") =>
    (own !== "first" && first === id) ||
    (own !== "second" && second === id) ||
    (own !== "third" && third.includes(id));
  const tooMany = third.length > PLACEMENT_LIMITS.third;

  if (!current.enabled) {
    if (!canToggle) return null;
    return (
      <section className="panel" aria-label="โหมดผลอันดับโดยตรง">
        <h3>ผลอันดับโดยตรง</h3>
        <p className="muted">
          ปิดอยู่ · ตารางเหรียญ รายละเอียดโรงเรียน และเกียรติบัตรของ{" "}
          {competitionName} คำนวณจากผังและคะแนนตามเดิม
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(true, current.revision)}
        >
          เปิดโหมดผลอันดับโดยตรง
        </button>
      </section>
    );
  }

  return (
    <section
      className="panel"
      aria-label={canToggle ? "โหมดผลอันดับโดยตรง" : "บันทึกผลอันดับการแข่งขัน"}
    >
      <h3>
        {canToggle ? "ผลอันดับโดยตรง · เปิดใช้งาน" : "บันทึกผลอันดับการแข่งขัน"}
      </h3>
      <p className={canToggle ? "notice" : "muted"}>
        {canToggle
          ? "เหรียญ รายละเอียดโรงเรียน และเกียรติบัตรของรายการนี้ใช้อันดับที่บันทึกด้านล่างแทนผลคะแนน ผังและคะแนนเดิมยังอยู่ครบและไม่ถูกนับเหรียญซ้ำ"
          : "เลือกโรงเรียนที่ได้รับอันดับ 1–3 ของรายการนี้ แล้วกดบันทึกอันดับ"}
      </p>
      <div className="filters">
        <label>
          อันดับ 1 (เหรียญทอง)
          <select
            value={first}
            onChange={(event) => setFirst(event.target.value)}
          >
            <option value="">ยังไม่ระบุ</option>
            {schools.map((school) => (
              <option
                key={school.id}
                value={school.id}
                disabled={taken(school.id, "first")}
              >
                {school.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          อันดับ 2 (เหรียญเงิน)
          <select
            value={second}
            onChange={(event) => setSecond(event.target.value)}
          >
            <option value="">ยังไม่ระบุ</option>
            {schools.map((school) => (
              <option
                key={school.id}
                value={school.id}
                disabled={taken(school.id, "second")}
              >
                {school.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>
          อันดับ 3 (เหรียญทองแดง) · เลือกได้สูงสุด {PLACEMENT_LIMITS.third}{" "}
          โรงเรียน
        </legend>
        {schools.map((school) => (
          <label key={school.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={third.includes(school.id)}
              disabled={taken(school.id, "third")}
              onChange={(event) =>
                setThird((list) =>
                  event.target.checked
                    ? [...list, school.id]
                    : list.filter((id) => id !== school.id),
                )
              }
            />{" "}
            {school.name}
          </label>
        ))}
      </fieldset>
      {tooMany && (
        <p role="alert">
          อันดับ 3 เลือกได้ไม่เกิน {PLACEMENT_LIMITS.third} โรงเรียน
        </p>
      )}
      <p className="muted">
        สรุป: 🥇 {first ? name(first) : "-"} · 🥈 {second ? name(second) : "-"}{" "}
        · 🥉 {third.length ? third.map(name).join(", ") : "-"}
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={busy || tooMany}
          onClick={() =>
            onSave(
              {
                first: first ? [first] : [],
                second: second ? [second] : [],
                third,
              },
              current.revision,
            )
          }
        >
          บันทึกอันดับ
        </button>
        {canToggle && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggle(false, current.revision)}
          >
            ปิดโหมด (กลับไปคำนวณจากผลคะแนน)
          </button>
        )}
      </div>
    </section>
  );
}
