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
  const [thirdSlots, setThirdSlots] = useState<string[]>(
    current.third.length ? current.third : [""],
  );

  const name = (id: string) =>
    schools.find((school) => school.id === id)?.name || id;

  const validThird = thirdSlots.filter(Boolean);
  const uniqueThird = [...new Set(validThird)];
  const tooMany = uniqueThird.length > PLACEMENT_LIMITS.third;

  const takenFirst = (id: string) =>
    second === id || validThird.includes(id);

  const takenSecond = (id: string) =>
    first === id || validThird.includes(id);

  const takenThird = (id: string, ownIndex: number) =>
    first === id ||
    second === id ||
    thirdSlots.some((slotId, i) => i !== ownIndex && slotId === id);

  function updateThirdSlot(index: number, value: string) {
    setThirdSlots((slots) => slots.map((s, i) => (i === index ? value : s)));
  }

  function addThirdSlot() {
    if (thirdSlots.length < PLACEMENT_LIMITS.third) {
      setThirdSlots((slots) => [...slots, ""]);
    }
  }

  function removeThirdSlot(index: number) {
    setThirdSlots((slots) =>
      slots.length > 1 ? slots.filter((_, i) => i !== index) : [""],
    );
  }

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
                disabled={takenFirst(school.id)}
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
                disabled={takenSecond(school.id)}
              >
                {school.name}
              </option>
            ))}
          </select>
        </label>

        {thirdSlots.map((selectedId, idx) => (
          <label key={idx}>
            {idx === 0
              ? "อันดับ 3 (เหรียญทองแดง)"
              : `อันดับ 3 ร่วม (เหรียญทองแดง)`}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <select
                value={selectedId}
                onChange={(event) => updateThirdSlot(idx, event.target.value)}
              >
                <option value="">ยังไม่ระบุ</option>
                {schools.map((school) => (
                  <option
                    key={school.id}
                    value={school.id}
                    disabled={takenThird(school.id, idx)}
                  >
                    {school.name}
                  </option>
                ))}
              </select>
              {thirdSlots.length > 1 && (
                <button
                  type="button"
                  className="ui-button-outline ui-button-sm"
                  title="ลบอันดับนี้"
                  aria-label="ลบอันดับนี้"
                  onClick={() => removeThirdSlot(idx)}
                >
                  ✕
                </button>
              )}
            </div>
          </label>
        ))}

        {thirdSlots.length < PLACEMENT_LIMITS.third && (
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              className="ui-button-outline ui-button-sm"
              onClick={addThirdSlot}
              style={{ marginBottom: "2px" }}
            >
              + เพิ่มอันดับ 3 ร่วม
            </button>
          </div>
        )}
      </div>

      {tooMany && (
        <p role="alert">
          อันดับ 3 เลือกได้ไม่เกิน {PLACEMENT_LIMITS.third} โรงเรียน
        </p>
      )}

      <p className="muted">
        สรุป: 🥇 {first ? name(first) : "-"} · 🥈 {second ? name(second) : "-"}{" "}
        · 🥉 {uniqueThird.length ? uniqueThird.map(name).join(", ") : "-"}
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
                third: uniqueThird,
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
