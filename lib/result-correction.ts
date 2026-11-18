import type { Management } from "./production-competitions";

/** A terminal fixture can change winner with one match revision CAS. Earlier
 * rounds require a separate bracket repair; never alter downstream results here. */
export function winnerCorrectionError(
  management: Management | null,
  matchId: string,
): string | undefined {
  const index =
    management?.fixtures.findIndex((fixture) => fixture.id === matchId) ?? -1;
  if (!management || index < 0)
    return "ไม่สามารถเปลี่ยนผู้ชนะได้ เพราะไม่มีข้อมูลผังคู่นี้ให้ตรวจสอบ กรุณาให้ผู้จัดตรวจสอบผัง";
  const number = management.fixtures[index].sourceNumber || index + 1;
  const references = new Set([`ผู้ชนะคู่ ${number}`, `ผู้แพ้คู่ ${number}`]);
  const downstream = management.fixtures.flatMap((fixture, i) =>
    fixture.id !== matchId &&
    (references.has(fixture.home) || references.has(fixture.away))
      ? [fixture.sourceNumber || i + 1]
      : [],
  );
  if (downstream.length)
    return `ไม่สามารถเปลี่ยนผู้ชนะคู่นี้ได้ เพราะเชื่อมต่อกับคู่ที่ ${downstream.join(", ")} กรุณาให้ผู้จัดตรวจสอบสายก่อน ระบบจะไม่ลบผลคู่อื่นอัตโนมัติ`;
  return undefined;
}
