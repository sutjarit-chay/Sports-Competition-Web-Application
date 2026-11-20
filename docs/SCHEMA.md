# Database Schema Documentation — นครโกสัมพีเกมส์ 2569

> เอกสารโครงสร้างฐานข้อมูลปัจจุบัน (Supabase PostgreSQL + JSON Structures + Storage)
> ⚠️ **คำเตือน:** ห้ามรัน `supabase/schema.sql` ซ้ำ เนื่องจากเป็น schema ตัวเก่าในอดีต โครงสร้างจริงในระบบปัจจุบันเป็น normalized schema ตามที่ระบุด้านล่างนี้

---

## 1. ตารางฐานข้อมูล (Tables)

### `public.schools`
ข้อมูลโรงเรียน
- `id` (uuid/text, PK): รหัสโรงเรียน
- `name` (text, NOT NULL): ชื่อโรงเรียน
- *(หมายเหตุ: ข้อมูลประเภทโรงเรียน เช่น "ขนาดเล็ก", "ขยายโอกาส" และโลโก้ จัดการผ่าน API และไฟล์ใน Storage / public projection)*

### `public.profiles`
บัญชีผู้ใช้งานระบบ (ผูกกับ `auth.users`)
- `id` (uuid, PK, references `auth.users(id)` on delete cascade)
- `role` (text, NOT NULL): สิทธิ์การใช้งาน (`'admin'`, `'school_admin'`, `'referee'`, `'school'`, `'recorder'`)
- `school_id` (text, references `public.schools(id)`): โรงเรียนต้นสังกัด (กรณีบทบาทโรงเรียน)

### `public.competitions`
รายการแข่งขันกีฬา/กรีฑา
- `id` (uuid, PK)
- `name` (text, NOT NULL): ชื่อรายการ เช่น "ฟุตบอล ชาย ป.1-6"
- `sport` (text, NOT NULL): ชนิดกีฬา เช่น "ฟุตบอล", "วอลเลย์บอล", "กรีฑา"
- `age_group` (text, NOT NULL): ระดับชั้น เช่น "ประถม", "มัธยมต้น"
- `gender` (text, NOT NULL): เพศ เช่น "ชาย", "หญิง", "ผสม"
- `win_points` (integer, default 3)
- `draw_points` (integer, default 1)
- `loss_points` (integer, default 0)
- `registration_policy` (jsonb): นโยบายการรับสมัครและโครงสร้างสายการแข่งขัน (ดูรายละเอียด JSON ด้านล่าง)

### `public.registrations`
การลงทะเบียนนักกีฬาในรายการแข่งขัน
- `id` (uuid, PK)
- `school_id` (text, NOT NULL, references `schools(id)`)
- `competition_id` (uuid, NOT NULL, references `competitions(id)`)
- `athlete_name` (text, NOT NULL): ชื่อ-สกุลนักกีฬา
- `bib` (text, nullable): หมายเลขประจำตัวนักกีฬา (จำเป็นสำหรับกรีฑา)
- `roster_details` (jsonb, nullable): รายละเอียดตำแหน่ง ตัวจริง/ตัวสำรอง และรายการแข่งขันย่อย

### `public.matches`
ตารางการแข่งขันและผลคะแนน (กีฬาทีม)
- `id` (uuid, PK)
- `competition_id` (uuid, NOT NULL, references `competitions(id)`)
- `group_name` (text): รอบ/สายการแข่งขัน เช่น "รอบคัดเลือก สาย A", "รอบชิงชนะเลิศ"
- `home_school_id` (text, references `schools(id)`): โรงเรียนทีมเหย้า
- `away_school_id` (text, references `schools(id)`): โรงเรียนทีมเยือน
- `starts_at` (timestamptz, nullable): วัน-เวลาแข่งขันจริง
- `venue` (text, nullable): สถานที่/สนามแข่งขัน
- `referee_id` (uuid, nullable, references `profiles(id)`): กรรมการผู้ตัดสิน
- `status` (text, default 'scheduled'): สถานะ เช่น `'scheduled'`, `'in_progress'`, `'finished'`
- `home_score` (integer, nullable): คะแนนทีมเหย้า
- `away_score` (integer, nullable): คะแนนทีมเยือน
- `revision` (integer, default 1): เวอร์ชันป้องกันการเขียนทับซ้อน (Optimistic Lock)
- `updated_at` (timestamptz)

### `public.athletics_events`
รายการย่อยกรีฑา (เช่น วิ่ง 100 เมตร ชาย)
- `id` (uuid, PK)
- `competition_id` (uuid, NOT NULL, references `competitions(id)`)
- `name` (text, NOT NULL): ชื่อรายการ
- `kind` (text): ประเภท เช่น `'track'`, `'field'`, `'relay'`
- `round` (text): รอบแข่งขัน
- `heat` (integer): ลำดับฮีต
- `direction` (text): ทิศทางการตัดสิน (`'asc'` ค่าน้อยชนะ เช่น เวลาวิ่ง, `'desc'` ค่ามากชนะ เช่น ระยะกระโดดไกล)
- `unit` (text): หน่วยวัด เช่น `"วินาที"`, `"เมตร"`
- `starts_at` (timestamptz, nullable)
- `venue` (text, nullable)
- `referee_id` (uuid, nullable)

### `public.athletics_results`
ผลการแข่งขันกรีฑา
- `id` (uuid, PK)
- `event_id` (uuid, NOT NULL, references `athletics_events(id)`)
- `school_id` (text, NOT NULL, references `schools(id)`)
- `bib` (text): หมายเลขนักกีฬา
- `value` (numeric, nullable): สถิติ/เวลา/ระยะ
- `status` (text, NOT NULL): สถานะ (`'OK'`, `'DNS'`, `'DNF'`, `'DQ'`)

### `public.school_registration_requests`
คำขอสมัครบัญชีโรงเรียนและกรรมการ (รอดำเนินการอนุมัติ)
- คำขอสมัครเข้าใช้งานที่ยังไม่ผ่านการอนุมัติจาก Admin

### `public.school_signup_rate_limits`
บันทึก Rate Limit การสมัครบัญชี (โควตา 5 ครั้งต่อ IP ต่อชั่วโมง)

---

## 2. โครงสร้าง JSON ที่สำคัญ (Embedded JSON)

### `competitions.registration_policy`
เก็บกติกาและการจัดการแข่งขัน ประกอบด้วยคีย์ย่อย:
1. **Rule & Quotas:**
   - `ruleId` (string): อ้างอิง ID ในกติกามาตรฐาน
   - `reserves` (number): จำนวนตัวสำรองที่อนุญาต
   - `eventQuotas` (object): โควตากรีฑา
   - `maxEventsPerAthlete` (number)
2. **`management` (object):**
   - `revision` (number): เวอร์ชันการจัดสาย
   - `format` (`"round_robin"` | `"knockout"`): รูปแบบการแข่ง
   - `teamLimit` (number): จำนวนทีมสูงสุด
   - `details` (string): รายละเอียดเพิ่มเติม
   - `teams` (string[]): รายชื่อ school_id ที่เข้าร่วม
   - `fixtures` (ManagedFixture[]): โปรแกรมคู่แข่งขัน
   - `groups` (array, optional): การแบ่งกลุ่มสาย A, B, ...
3. **`directPlacements` (object) — โหมดผลอันดับโดยตรง:**
   - `enabled` (boolean): เปิด/ปิดโหมดผลอันดับโดยตรง
   - `revision` (number): เวอร์ชันป้องกัน concurrent updates
   - `first` (string[]): school_id อันดับ 1 (ทอง) สูงสุด 1 โรงเรียน (เลือกได้จาก `public.schools` ทั้งหมด โดยไม่ต้องรอจับสายการแข่งขัน)
   - `second` (string[]): school_id อันดับ 2 (เงิน) สูงสุด 1 โรงเรียน (เลือกได้จาก `public.schools` ทั้งหมด โดยไม่ต้องรอจับสายการแข่งขัน)
   - `third` (string[]): school_id อันดับ 3 (ทองแดง) สูงสุด 4 โรงเรียน (รองรับอันดับร่วม, เลือกได้จาก `public.schools` ทั้งหมด)
   - `updatedBy` (string, optional): user id ที่แก้ไขล่าสุด
   - `updatedAt` (string, optional): ISO timestamp

### `registrations.roster_details`
- `ruleId` (string)
- `position` (`"starter"` | `"reserve"`): ตัวจริงหรือตัวสำรอง
- `events` (string[]): รายการกรีฑาย่อยที่ลงสมัคร

---

## 3. พื้นที่จัดเก็บไฟล์ (Supabase Storage)

### Bucket: `team-files` (Private)
- ขนาดไฟล์สูงสุด: 2 MB
- รองรับ MIME Type: `application/json`, `text/csv`, Excel
- ข้อมูลที่จัดเก็บ:
  - ประวัติโรงเรียนและข้อมูลผู้ฝึกสอน (Coaches) ในรูปแบบ Immutable JSON มี Versioning (`school-profiles/<schoolId>/<version>.json`, `school-coaches/<schoolId>/<competitionId>/<version>.json`)
  - โลโก้โรงเรียน (PNG/JPG/WEBP ขนาด ≤ 1 MB) แยก endpoint สำหรับ public projection
  - แม่แบบและข้อมูลการออกเกียรติบัตร (`certificate-settings/<version>.json`, `certificate-issues/<competitionId>/<version>.json`)
  - ข้อมูลการจัดลู่วิ่งและใบบันทึกผลการแข่งขันกรีฑา 20 รายการ (`athletics-scoresheet/<version>.json`) บันทึกแบบ Immutable JSON พร้อมระบบ Optimistic Concurrency (CAS) ผ่าน API `/api/athletics-scoresheet`

---

## 4. โครงสร้างข้อมูลใบบันทึกผลกรีฑา (Athletics Scoresheet & Reports Data Model)

โครงสร้าง JSON สำหรับจัดเก็บข้อมูลผลการแข่งขันกรีฑา 20 รายการตามสูจิบัตร และการจัดลู่วิ่ง (จัดเก็บใน Supabase Storage bucket `team-files` ที่ prefix `athletics-scoresheet/<version>.json` ผ่าน `/api/athletics-scoresheet` และเชื่อมโยงผลเหรียญรางวัลเข้ากับตารางสรุปเหรียญรวมผ่าน `athleticsScoresheetAwards`):

### `AthleticsScoresheetDocument`
เอกสารระดับบนสุดที่จัดเก็บใน Supabase Storage (`athletics-scoresheet/<version>.json`):
- `rows` (`AthleticsRow[]`): ข้อมูลรายการกรีฑาทั้ง 20 รายการ
- `updatedAt` (string | null): เวลาที่อัปเดตล่าสุด (ISO 8601)
- `updatedBy` (string | null): รหัสผู้ใช้ (`profiles.id`) ของผู้ดูแลหรือกรรมการที่บันทึกล่าสุด
- *(สิทธิ์การเข้าถึง: `GET /api/athletics-scoresheet` เปิดให้อ่านได้ทุกบทบาท รวมถึงบทบาท `viewer` ในโหมดอ่านอย่างเดียว ส่วน `PUT /api/athletics-scoresheet` จำกัดสิทธิ์เฉพาะ `admin`, `referee`, `recorder` เท่านั้น)*

### `LaneEntry`
ข้อมูลนักกีฬาและการจัดลู่วิ่งแต่ละลู่:
- `lane` (number): ลำดับลู่วิ่ง (1–5 หรือ 1–6 ในรอบชิงชนะเลิศ)
- `schoolName` (string): ชื่อเต็มโรงเรียน เช่น `"โรงเรียนบ้านหนองแดน"`, `"โรงเรียนอนุบาลโกสัมพีนคร (บ้านท่าคูณ)"` (ใช้ชื่อโรงเรียนแทนอักษรย่อและ BIB)
- `athleteName` (string): ชื่อ-สกุลนักกีฬา (ถ้ามี)
- `rank` (string, optional): อันดับเข้าเส้นชัย เช่น `"1"`, `"2"`, `"3"`, `"4"`, `"5"`, `"6"`, `"DQ"`
- `isFoul` (boolean, optional): สถานะฟาล์ว / ผิดกติกา (DQ)
- `foulReason` (string, optional): สาเหตุการฟาล์ว เช่น `"เหยียบเส้น / ล้ำลู่"`, `"ออกตัวก่อนปล่อยสัญญาณ (False Start)"`
- `time` (string, optional): สถิติเวลา/ผลการแข่งขัน

### `AthleticsRow`
ข้อมูลรายการแข่งขัน 20 รายการ:
- `id` (number): รหัสลำดับ 1–20
- `no` (string): ลำดับที่แบบเลขอารบิก เช่น `"1"`, `"2"`, `"20"`
- `sourceNumber` (number, optional): เลขรายการในสูจิบัตร (เช่น `101`–`141`)
- `name` (string): ชื่อรายการ เช่น `"วิ่ง 50 เมตร"`
- `grade` (string): ระดับชั้น เช่น `"อนุบาล"`, `"ป.1-3"`, `"ป.4-6"`, `"ม.1-3"`
- `type` (string): เพศ/ประเภท เช่น `"ชาย"`, `"หญิง"`
- `directFinal` (boolean, optional): `true` สำหรับรายการมินิมาราธอน (1–4) ที่แข่งขันรอบชิงชนะเลิศทันทีโดยไม่มีรอบคัดเลือก 1 และ 2 (ส่วนรายการวิ่งลู่ 5–20 เปิดช่องรอบ 1 และ รอบ 2 ตามตารางหน้า 29–30 ของสูจิบัตร)
- `expandableLanes` (boolean, optional): `true` สำหรับรายการมินิมาราธอน (1–4) ที่อนุญาตให้กดปุ่มเพิ่มช่องลู่/นักกีฬาได้เรื่อยๆ ไม่จำกัดจำนวน และแต่ละโรงเรียนส่งนักกรีฑาได้มากกว่า 1 คน
- `r1` (string[]): ชื่อโรงเรียนประจำลู่ 1–5 ในรอบ ๑
- `r2` (string[]): ชื่อโรงเรียนประจำลู่ 1–5 ในรอบ ๒
- `r3` (string[]): ชื่อโรงเรียนประจำลู่ 1–6 ในรอบชิงชนะเลิศ (จัดลู่อัตโนมัติตามลำดับ 3-2-1-1-2-3)
- `r1Lanes` (LaneEntry[]): ข้อมูลจัดลู่วิ่งรอบ ๑ (๕ ลู่)
- `r2Lanes` (LaneEntry[]): ข้อมูลจัดลู่วิ่งรอบ ๒ (๕ ลู่)
- `r3Lanes` (LaneEntry[]): ข้อมูลจัดลู่วิ่งรอบชิงชนะเลิศ (๖ ลู่)
- `winners` (array): ผลคะแนนเหรียญรางวัลในรอบชิงชนะเลิศ (อันดับ 1 = 3 คะแนน, อันดับ 2 = 2 คะแนน, อันดับ 3 = 1 คะแนน คำนวณผ่าน `computeFinalsWinners`)

### การรวมข้อมูลเมื่อมีการแก้ไขพร้อมกัน (Concurrent Merge Model)
เมื่อมีการบันทึกข้อมูลจากหลายอุปกรณ์พร้อมกันจนเกิด HTTP 409 Conflict ระบบใช้ `mergeConcurrentAthleticsRows(baseRows, localRows, remoteRows)` ใน `lib/athletics-scoresheet-model.ts` เพื่อรวมข้อมูลระดับฟิลด์ในแต่ละลู่วิ่ง (`mergeConcurrentLane`):
- ฟิลด์ที่แก้ไขเฉพาะฝั่ง Local จะถูกคงไว้
- ฟิลด์ที่แก้ไขเฉพาะฝั่ง Remote จะถูกนำมาใช้
- หากแก้ไขฟิลด์เดียวกันทั้งสองฝั่ง ข้อมูลบน Supabase (Remote) จะเป็นฝ่ายชนะ
- คำนวณลู่รอบชิงชนะเลิศ (`syncQualifiersToFinals`) และเหรียญรางวัล (`computeFinalsWinners`) ใหม่จากผลลัพธ์ที่รวมแล้ว
