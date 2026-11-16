"use client";
import type { ComponentProps } from "react";
import SpiderSchedule from "./spider-schedule";
type Props = Pick<
  ComponentProps<typeof SpiderSchedule>,
  "matches" | "schoolName" | "busy" | "onSave"
> & {
  admin: boolean;
  profileId: string;
};
export function MatchResultProgram({
  matches,
  admin,
  profileId: _profileId,
  ...schedule
}: Props) {
  if (!matches.length)
    return (
      <p role="status">
        {admin
          ? "ยังไม่มีคู่แข่งขันในรายการนี้ รอจัดสายหรือกำหนดรายการแข่งขันก่อนบันทึกผล"
          : "ยังไม่มีคู่แข่งขันในรายการนี้ กรุณาให้ผู้ดูแลเปิดคู่แข่งขันก่อน จากนั้นกดโหลดข้อมูลใหม่"}
      </p>
    );
  const pending = matches.filter((match) => match.fixtureOnly);
  if (!pending.length) return null;
  return (
    <section aria-label="คู่แข่งขันที่รอเปิดบันทึกผล">
      <h3>โปรแกรมการแข่งขัน · รอเปิดบันทึกผล</h3>
      <p role="status">
        {admin
          ? "คู่ต่อไปนี้อยู่ในโปรแกรมแล้ว กรุณากำหนดเวลาแข่งขันจริงและสนาม แล้วบันทึกโปรแกรมเพื่อเปิดกรอกผล กรรมการทุกคนสามารถบันทึกผลคู่ที่เปิดแล้วได้ คู่ที่ยังไม่ทราบโรงเรียนต้องยืนยันทีมที่ผ่านเข้ารอบก่อน"
          : "คู่ต่อไปนี้ยังไม่เปิดบันทึกผล กรุณาให้ผู้ดูแลกำหนดเวลาและสนาม เมื่อเปิดคู่แล้วกรรมการทุกคนบันทึกผลได้ โดยไม่ต้องมอบหมายรายคู่"}
      </p>
      <SpiderSchedule
        {...schedule}
        matches={pending}
        canEdit={admin}
        canAssign={admin}
      />
    </section>
  );
}
