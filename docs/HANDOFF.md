# HANDOFF — นครโกสัมพีเกมส์ ปีการศึกษา 2569 (kosamphi-sports-2569)

> สร้างเมื่อ 2026-11-18 จากการสำรวจไฟล์ในโปรเจกต์ (README, docs/, โครงสร้าง app/lib/components, git log)
> ผู้รับช่วงต่อ (AI/คน) ควรอ่านไฟล์นี้ก่อน แล้วค่อยเปิด `README.md` และ `docs/*.md` ตามหัวข้อ

## 1. ภาพรวม
เว็บแอปจัดการการแข่งขันกีฬาระหว่างโรงเรียน: สมัครบัญชีโรงเรียน/กรรมการ, ลงทะเบียนนักกีฬา, จัดสาย/ตารางแข่ง,
บันทึกผล (ทีม มีคะแนนรายเซ็ต + กรีฑา), สรุปเหรียญ/อันดับ และออกเกียรติบัตร PDF พร้อมหน้าตรวจสอบ
ธีมขาว–ทอง ฟอนต์ Sarabun, UI ภาษาไทย, รองรับมือถือ/พิมพ์

## 2. Tech stack
- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 + shadcn (`components/ui`)
- Supabase (Auth, Postgres + RLS, private Storage bucket `team-files`)
- pdfkit (เกียรติบัตร), jszip, papaparse (CSV), qrcode, framer-motion, lucide-react
- ทดสอบ: `node --test` ผ่าน tsx (`tests/*.test.ts`), PGlite สำหรับ SQL/RLS, Playwright E2E
- Node 24 / npm 11

> ⚠️ AGENTS.md: Next.js เวอร์ชันนี้มี breaking changes — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดที่เกี่ยวกับ Next API

## 3. คำสั่งหลัก
```sh
npm ci
cp .env.example .env.local   # เติม env เอง
npm run dev                  # next dev --hostname 0.0.0.0
npm test                     # unit/SQL/route-handler
npm run typecheck
npm run test:e2e             # Playwright
npm run build
```
Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (หรือ `..._PUBLISHABLE_KEY` อย่างใดอย่างหนึ่ง),
`SUPABASE_SERVICE_ROLE_KEY` (เซิร์ฟเวอร์เท่านั้น ห้ามใช้ `NEXT_PUBLIC_`). ห้าม commit `.env.local`

## 4. โครงสร้างโค้ด
| พาธ | หน้าที่ |
|---|---|
| `app/page.tsx` (~2,700 บรรทัด) | หน้าหลัก SPA ใหญ่: overview, ตาราง, ผล, เหรียญ, โรงเรียน, แอดมิน (ควรพิจารณาแยกไฟล์) |
| `app/school-registration/page.tsx` | สมัครบัญชีโรงเรียน/กรรมการ (รออนุมัติ) |
| `app/certificates/verify/page.tsx` | ตรวจสอบเกียรติบัตร |
| `app/api/*/route.ts` | Route Handlers: account-requests, admin-accounts, admin-schools, athlete-registrations, athletics-results, certificate(s)/download/verify/template, coaches, competition-reset, competitions, match-results, result-workspace, school-account, school-profile(+logo), schools |
| `components/` | school-portal, admin-competition-manager, admin-school-manager/dialog, admin-account-manager, account-approvals/login, registration-panel, match-result-form/program, match-results-report, athletics-program, spider-schedule, competition-progress, school-medal-details, certificate-center, admin-maintenance |
| `lib/` | ตรรกะโดเมน: domain, registration(+rules json), match-results, set-scores, athletics-results, result-correction, medal-calculation, competition-order (เรียงภาษาไทย), competition-progress, competition-access, competition-reset, certificate-*, account-*, school-*, supabase/hosted, latest-program/image-program/production-competitions |
| `supabase/` | `schema.sql` (เก่า **ห้ามรันซ้ำ**), `migrations/` (referee_workflow, registration_rosters, school_registration), `verify-rls.sql`, `inspect-hosted.sql` |
| `scripts/` | provision-latest-program.ts, generate-registration-migration.ts |
| `docs/` | IMPLEMENTATION, ACCOUNT-ACCESS, REGISTRATION, PRODUCTION-READINESS, ADMIN-MAINTENANCE, certificates, set-scores-and-results, result-entry-program, competition-program-2569, latest-program-2569, plans/specs ใน `docs/superpowers/` |
| `tests/` | ~40 ไฟล์ทดสอบ + helpers (`sports-fixtures.ts`, `account-fixture.ts`) |
| `.local-backups/` | สำรองข้อมูล/สคริปต์เฉพาะเครื่อง (git ignore) |

## 5. บทบาทและสิทธิ์
- `admin` (login ด้วยอีเมล): จัดการรายการ, อนุมัติบัญชี, จัดสาย, แก้โรงเรียน, reset, เกียรติบัตร
- `school_admin` (username/password): จัดการข้อมูล/ทะเบียนนักกีฬาของโรงเรียนตน
- `referee` (username/password): บันทึกผลตามคู่/รายการที่ได้รับมอบหมาย; ล่าสุดเปิดให้กรรมการที่อนุมัติแล้วอ่าน/บันทึกผลและดู standings ได้
- บทบาทเก่า `school`/`recorder` ยังอ่านได้ (legacy)
- API ตรวจ `getUser()` + profile จริงก่อนใช้ service key; ไม่เชื่อ role จาก client; เบราว์เซอร์ไม่มีสิทธิ์เขียนตารางผลโดยตรง

## 6. โมเดลข้อมูล (Supabase)
`schools`, `profiles`, `competitions` (`registration_policy` เก็บ rule/reserves/quota/`management`: revision, format, teams, fixtures),
`registrations` (`roster_details`), `matches`, `athletics_events`, `athletics_results`, `school_registration_requests`.
ประวัติโรงเรียน/โลโก้/ผู้ฝึกสอน = immutable JSON มีเวอร์ชันใน Storage `team-files` (private, 2 MB, JSON/CSV/Excel; โลโก้ ≤1 MB).
คู่แข่งขันสร้างใน `matches` เมื่อรู้ทั้งสองทีม + วัน/เวลา/สนามครบเท่านั้น (ไม่ใช้ค่าสมมติ)
ไม่มีโหมดสาธิตและไม่เก็บข้อมูลธุรกิจใน localStorage

## 7. ประวัติงานล่าสุด (git log, ใหม่→เก่า)
1. จัดการโรงเรียน/ทะเบียนใน modal สำหรับ admin (`c949782`, HEAD = origin/main)
2. แสดงรายการที่ได้เหรียญใน dialog รายละเอียดโรงเรียน
3. หน้า overview: ความคืบหน้ารายการ + ตารางนัดถัดไป
4. แก้ผลแบบชัดเจน + แก้ผู้ชนะ terminal อย่างปลอดภัย
5. เปิดสิทธิ์ standings/จัดการรายการให้กรรมการ
6. เรียงการบันทึกผลตามวันโปรแกรม/เลขแมตช์; เรียงรายการภาษาไทย
7. อนุญาตตารางแข่งพร้อมกัน; คะแนนรายเซ็ต; sync โปรแกรมล่าสุด

## 8. สถานะ working tree ตอนสร้างไฟล์
- ยังไม่ commit: `next-env.d.ts` (แก้อัตโนมัติ), โฟลเดอร์ `design/` (untracked: audits, certificate drafts), และไฟล์นี้
- branch: `main` (ตรงกับ origin/main)

## 9. ข้อควรระวัง
- ห้ามรัน `supabase/schema.sql` ซ้ำ; อย่าแก้ schema/constraint/RLS โดยไม่ตรวจกับฐาน hosted จริง
- มีข้อมูลจริง (admin 1, school_admin 2 ณ การตรวจครั้งก่อน) — ระวังเขียนข้อมูลบนโปรเจกต์จริง
- ต้องติดตั้ง referee-workflow migration + ตรวจ RLS ก่อนใช้บันทึกผลจริง (ดู docs/IMPLEMENTATION.md, docs/PRODUCTION-READINESS.md)
- Ingress ต้องเขียนทับ `x-real-ip`; โควตาสมัคร 5 ครั้ง/IP/ชั่วโมง
- ผลทดสอบล่าสุดใน README: unit/SQL/route 75 ข้อ + E2E 35 ข้อผ่าน (อาจเก่ากว่าโค้ดปัจจุบัน — รันซ้ำก่อนเชื่อ)

## 10. จุดที่ควรทำต่อ / ข้อเสนอ (ยังไม่ได้ยืนยันกับเจ้าของงาน)
- รัน `npm test`, `npm run typecheck`, `npm run test:e2e` เพื่อยืนยัน baseline
- แยก `app/page.tsx` (2.7k บรรทัด) เป็น component ย่อย
- ตัดสินใจเรื่อง `design/` (commit หรือ ignore)
- ตรวจ README/docs ให้ตรงกับฟีเจอร์ล่าสุด (เกียรติบัตร, school modal, overview progress)
- ถามเจ้าของงานว่ามี backlog/ปัญหาค้างอะไรเพิ่ม และใส่ไว้ในหัวข้อนี้

## 11. วิธีอัปเดตไฟล์นี้
ก่อนจบเซสชัน/เครดิตหมด ให้เพิ่ม: งานที่ทำ, ไฟล์ที่แก้, สิ่งที่ค้าง, คำสั่งทดสอบและผลลัพธ์ล่าสุด

## 12. ฟีเจอร์ล่าสุด: โหมด "ผลอันดับโดยตรง"
- เก็บที่ `competitions.registration_policy.directPlacements` = `{enabled, revision, first[], second[], third[], updatedBy, updatedAt}` (ไม่แก้ schema/RLS)
- `lib/direct-placements.ts`: อ่าน/ตรวจ/แปลงเป็น Award; `applyDirectPlacements` แทนเหรียญที่คำนวณของรายการที่เปิดโหมด (ไม่นับซ้ำ)
- `app/api/direct-placements/route.ts`: `action: "mode"` (admin เท่านั้น) / `"placements"` (admin + referee/recorder); CAS ด้วย `directPlacements.revision`; ตรวจสอบรายชื่อโรงเรียนจาก `schools` ทั้งหมดในระบบ ไม่จำเป็นต้องจัดสายหรือมีคู่แข่งขันก่อน
- UI: `components/direct-placement-panel.tsx` ในแท็บบันทึกผล (tab 3); แสดงรายชื่อโรงเรียนทั้งหมดในระบบ (`data.schools`) เรียงตามพจนานุกรมไทย ทำให้เลือกโรงเรียนได้ทันทีโดยไม่ต้องจับสายการแข่งขันก่อน; ปรับ UI อันดับ 3 จากเดิมที่เป็น Checkbox ยาวเหยียด มาเป็น Dropdown สไตล์เดียวกับอันดับ 1 และ 2 พร้อมปุ่ม "+ เพิ่มอันดับ 3 ร่วม" และปุ่ม ✕ สำหรับลบช่อง (เลือกได้สูงสุด 4 โรงเรียน); สำหรับกรรมการ (Referee) จะไม่แสดงสถานะว่าเปิดหรือปิดอยู่ หากปิดจะไม่แสดงแผงนี้เลย และหากผู้ดูแลเปิดไว้ จะแสดงเป็นฟอร์ม "บันทึกผลอันดับการแข่งขัน" ให้เลือกโรงเรียนและบันทึกผลได้ทันที; ตารางเหรียญ/รายละเอียดโรงเรียนใช้ `applyDirectPlacements` ใน `app/page.tsx`
- เกียรติบัตร: `lib/certificate-eligibility.ts` ใช้อันดับโดยตรงและข้ามเช็กความครบของคู่/คะแนน แต่ต้องมีอันดับ 1 และ 2
- ข้อจำกัด: กีฬาทีมเท่านั้น (กรีฑาไม่รองรับ); อันดับ 1/2 โรงเรียนละ 1, อันดับ 3 ได้สูงสุด 4; เปิดโหมดแต่ยังไม่กรอก = ไม่มีเหรียญ (ไม่ย้อนไปใช้คะแนน)
- เทสต์: `tests/direct-placements.test.ts` (277/277 ผ่าน)

## 13. ฟีเจอร์ล่าสุด: ระบบลงทะเบียนจัดลู่และใบบันทึกผลกรีฑา
- พัฒนาคอมโพเนนต์ `components/athletics-scoresheet.tsx` แสดงในแท็บ 4 ("กรีฑา") ของ `app/page.tsx` พร้อมชุดทดสอบ `tests/athletics-scoresheet.test.ts` (282/282 ผ่าน)
- **ใช้ชื่อโรงเรียนจริงแทนอักษรย่อ (School Name):** ทุกส่วนของระบบ (ตารางบันทึกผล, การจัดลู่วิ่ง, สรุปเหรียญและรายงานคะแนน) แสดงและจัดเก็บด้วยชื่อโรงเรียนจริง (เช่น "โรงเรียนบ้านหนองแดน" / "บ้านหนองแดน", "โรงเรียนอนุบาลโกสัมพีนคร (บ้านท่าคูณ)", "โรงเรียนบ้านดงซ่อม") โดยไม่มีการใช้อักษรย่อหรือ BIB
- **มาตรฐาน 20 รายการตามสูจิบัตร & รองรับรายการแข่งรอบชิงทันที (`directFinal`):**
  - ปรับข้อมูลให้ตรงตามสูจิบัตร 20 รายการทุกหน้า และเปลี่ยนการแสดงผลตัวเลขทั้งหมดเป็น **เลขอารบิก (0-9)** แทนเลขไทย (รวมถึงแปลงข้อมูลเก่าใน `localStorage` ให้เป็นเลขอารบิกอัตโนมัติ)
  - รายการที่แข่งรอบชิงชนะเลิศทันทีโดยไม่มีรอบคัดเลือก 1 และ 2 (มินิมาราธอน รายการที่ 1–4 และวิ่ง 100/200 ม. ระดับ ม.1–3 รายการที่ 15, 16, 19, 20) จะแสดงแถบ *"— แข่งขันรอบชิงชนะเลิศทันที —"* ในช่องรอบ 1–2 และสลับไปจัดลู่รอบชิงชนะเลิศให้อัตโนมัติ
- **แยกหน้า "ลงทะเบียนและจัดลู่วิ่ง" ออกจาก "ใบบันทึกผลการแข่งขัน":**
  1. **หน้าลงทะเบียนและจัดลู่วิ่ง (`subTab === "register"`):**
     - เมนูเลือกรายการแข่งขัน ๒๐ รายการ พร้อมปุ่ม "รายการก่อนหน้า" และ "รายการถัดไป"
     - สลับรอบการแข่งขัน: รอบ ๑ (๕ ลู่), รอบ ๒ (๕ ลู่), รอบชิงชนะเลิศ (๖ ลู่) พร้อมแจ้งเตือนหากเลือกโรงเรียนซ้ำในรอบเดียวกัน
     - ตารางจัดลู่วิ่ง: ประกอบด้วย ๓ คอลัมน์ที่จำเป็นสำหรับการลงทะเบียน ได้แก่ **ลู่วิ่ง, ชื่อโรงเรียน (เลือกจากรายชื่อ Dropdown), และ ชื่อ-สกุลนักกีฬา**
     - **ปุ่ม "บันทึก" (Save):** เพิ่มปุ่ม "บันทึก" เด่นชัดทั้งบริเวณหัวตารางและแถบด้านล่างตาราง พร้อมแจ้งเตือน Toast เมื่อกดบันทึกสำเร็จ
     - แผงการ์ดภาพรวมสถานะ ๒๐ รายการ แสดงจำนวนลู่ที่ลงทะเบียนในแต่ละรอบ
  2. **หน้าใบบันทึกผลการแข่งขัน (`subTab === "sheet"`):**
     - ตารางทางการ ๒๐ รายการ แสดงชื่อโรงเรียนในแต่ละลู่ (รอบ ๑: ๕ ลู่, รอบ ๒: ๕ ลู่, รอบชิง: ๖ ลู่) พร้อมรองรับการสั่งพิมพ์ตารางใบบันทึกผล (Print A4)
     - **Modal บันทึกอันดับและสถานะฟาล์วครบทั้งฮีตในหน้าต่างเดียว:** เมื่อคลิกที่ช่องโรงเรียนใดในรอบนั้น จะเปิด Modal แสดงทุกลู่ในรอบนั้นให้กรอกอันดับเข้าเส้นชัย, ติ๊กสถานะฟาล์ว (DQ) พร้อมเหตุผล, และสถิติเวลา ได้ครบทุกลู่ในครั้งเดียว
     - **ป้องกันอันดับซ้ำ (`assignUniqueRankInLanes`):** เมื่อเลือกอันดับซ้ำในฮีตเดียวกัน ระบบจะล้างอันดับเดิมจากลู่อื่นให้อัตโนมัติ
     - **ระบบส่งตัวเข้ารอบชิงชนะเลิศอัตโนมัติ (เรียงลู่ 3-2-1-1-2-3) & ล้างค่าเมื่อฟาล์ว:** เมื่อบันทึกอันดับ ๑, ๒, ๓ ของรอบ ๑ และ รอบ ๒ ระบบจะคัดลอกโรงเรียนและนักกีฬาไปจัดลู่ในรอบชิงชนะเลิศ (๖ ลู่: ลู่ ๑=R1#3, ลู่ ๒=R1#2, ลู่ ๓=R1#1, ลู่ ๔=R2#1, ลู่ ๕=R2#2, ลู่ ๖=R2#3) และหากภายหลังถูกปรับฟาล์วหรือยกเลิกอันดับ ระบบจะล้างชื่อออกจากลู่รอบชิงที่ผูกไว้ทันที
  3. **หน้าสรุปผลและรายงานคะแนน (`subTab === "summary"`):**
     - สรุปผล ๒๐ รายการ (ทอง=๓ แต้ม, เงิน=๒ แต้ม, ทองแดง=๑ แต้ม) โดยแสดงผลเฉพาะผู้ที่ได้รับการบันทึกอันดับ ๑, ๒, ๓ ในรอบชิงแล้วเท่านั้น (`computeFinalsWinners`) ไม่ดึงรายชื่อลู่ ๑–๓ ที่ยังไม่ได้แข่งมาแสดงล่วงหน้า
     - ตารางสรุปคะแนนรวมโรงเรียนเพื่อหาแชมป์กรีฑา (`calculateSchoolAthleticsStandings`) แสดงจำนวนเหรียญ **🥇 ทอง, 🥈 เงิน, 🥉 ทองแดง, และคะแนนรวม** พร้อมจัดอันดับด้วยกฎ Tie-break (คะแนนรวม > ทอง > เงิน > ทองแดง > ชื่อโรงเรียน)
     - ส่วนลงนามกรรมการและปุ่มพิมพ์ A4 PDF
- ซ่อนส่วน Dropdown เลือกรายการแข่งขัน (`filter`) และแผง "กรีฑา · ฮีตและรอบชิง" แบบเดิมในแท็บ 4 ("กรีฑา") ของ `app/page.tsx` ออกไปชั่วคราวตามคำขอของผู้ใช้ เพื่อให้แสดงเฉพาะระบบลงทะเบียนจัดลู่ ใบบันทึกผล และสรุปผลกรีฑาชุดใหม่
- นำข้อความอ้างอิงเลขหน้า `(หน้า ...)` ออกจาก UI ทั้งหมดตามคำขอของผู้ใช้
