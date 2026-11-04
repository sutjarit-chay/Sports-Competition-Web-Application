# นครโกสัมพีเกมส์ 2569 — ตรวจแบบขาว–ทอง

สถานะ: ภาพร่างรอบเลือกแนวทาง ผู้ใช้เลือก **แบบ B** แล้ว ภาพในโฟลเดอร์นี้เป็นภาพร่างเดิม ส่วนภาพจากเว็บจริงอยู่ที่ `../design-review/` งานปรับระบบอยู่ใน branch `design/white-gold-2569` และผู้ใช้อนุญาตให้ commit/push แล้วในขั้นส่งมอบงานสมัครนักกีฬา

เปิด `index.html?design=a` สำหรับแบบ A หรือ `index.html?design=b` สำหรับแบบ B ข้อมูลในภาพเป็นข้อมูลสมมติ ปุ่มและลิงก์ใช้สื่อหน้าตาเท่านั้น ไม่ใช่ระบบลงทะเบียนจริง

## แนวทางให้เลือก

- **A: สนามขาว–ทอง (แนะนำ)** ใช้พื้นขาว ทองอ่อน ตัวอักษรสีเข้ม เมนูด้านข้างบน desktop และเมนูด้านล่างบนมือถือ Hero กะทัดรัดเพื่อให้เห็นสถิติเร็ว ใช้ Perspective Tunnel เป็นส่วนตกแต่ง hero
- **B: เวทีเปิดการแข่งขัน** ใช้ hero ขนาดใหญ่และภาพลอยขนาบหัวเรื่อง ให้ความรู้สึกพิธีเปิด ข้อมูลสถิติอยู่ต่ำลง เหมาะเมื่อเน้นภาพลักษณ์งานมากกว่าการเข้าถึงข้อมูลอย่างรวดเร็ว

ฟอนต์ตัวอย่าง Sarabun; พื้น `#FFFFFF` / `#F7F8F3`, ตัวอักษร `#252821`, ทองเข้ม `#836116`, ปุ่มทองอ่อน `#E4C474` พร้อมตัวอักษรเข้ม เสนอขนาดเนื้อหาจริง 16px และระยะบรรทัดประมาณ 1.7 ตาราง/ข้อมูลรองย่อได้ตามลำดับความสำคัญ ภาพร่างยังไม่ได้ตรวจ accessibility ครบทั้งระบบ

## โครงสร้างและ dependencies ที่ตรวจพบ

- มี Next.js App Router, TypeScript strict และ Tailwind CSS 4 พร้อม `@tailwindcss/postcss` แล้ว ไม่ต้องติดตั้ง Tailwind หรือ TypeScript ใหม่
- styles หลักปัจจุบันคือ `app/globals.css`
- ยังไม่มี `components.json`, `components/ui/` หรือ alias `@/`
- component ต้นฉบับใช้ `framer-motion` และ React hooks ไม่มี provider หรือ global state เพิ่มเติม
- component ไม่มี props; state ภายในมีขนาด stage, ความคืบหน้าภาพเคลื่อนไหว และตำแหน่ง pointer ไม่เชื่อมกับ Supabase

หลังเลือกแบบ จะสร้าง `components/ui/perspective-tunnel-hero.tsx` และตัวอย่าง `components/ui/demo.tsx` โดยใช้ชื่อ import `PerspectiveTunnelHero` ให้ตรงกัน โฟลเดอร์ `components/ui` ทำให้ component ที่ใช้ซ้ำแยกจากหน้าแอป และตรงกับตำแหน่ง import/การติดตั้งผ่าน shadcn CLI

หากตั้งค่าด้วย CLI ด้วยตนเอง ให้เพิ่ม `compilerOptions.paths` ใน `tsconfig.json` เป็น `{ "@/*": ["./*"] }` แล้วรันจาก root:

```sh
npx shadcn@latest init
npm install framer-motion lucide-react
```

ตั้งค่า shadcn ให้ใช้ TypeScript/RSC, CSS ที่ `app/globals.css` และ aliases `components: @/components`, `ui: @/components/ui`, `utils: @/lib/utils` ตรวจ diff หลัง CLI ก่อนยอมรับการแก้ theme/global styles เพื่อรักษาหน้าปัจจุบัน ไม่จำเป็นต้องสร้างโปรเจกต์ใหม่

อ้างอิง: https://ui.shadcn.com/docs/installation/manual

## การปรับ component หลังเลือกแบบ

- ใช้ hero เฉพาะแท็บภาพรวม ไม่บังฟอร์มลงทะเบียนหรือผลการแข่งขัน
- เปลี่ยนข้อความทดลองเป็นนครโกสัมพีเกมส์ ปีการศึกษา 2569 และภาพกีฬา Unsplash
- ใช้ความกว้างตาม parent แทน `w-screen` เพื่อไม่ล้น sidebar; วัดขนาด container เพื่อรองรับ tablet
- คงมิติ/ภาพลอยของต้นฉบับ แต่ไม่ดัก wheel จนเลื่อนหน้าหรือเข้าถึงข้อมูลไม่ได้
- รองรับคีย์บอร์ดและ touch ตามลักษณะ interaction ที่ตกลง; ภาพตกแต่งไม่แสร้งเป็นปุ่ม
- เมื่อ `prefers-reduced-motion` ทำงาน หยุด parallax และการเคลื่อนที่ตาม scroll แสดงข้อความและภาพนิ่งชัดเจน
- Hero ไม่ปรากฏในเอกสารพิมพ์ ส่วนตารางและหัวรายงานยังพิมพ์/บันทึก PDF ได้

## ขอบเขตงานเมื่ออนุมัติแนวทาง

ปรับเมนู ฟอร์ม ตัวกรอง การ์ดสถิติ ไอคอนกีฬา ตาราง คะแนน อันดับ และเหรียญให้ใช้ชุดสี/ระยะห่างเดียวกัน เพิ่ม loading, empty, success และ error ที่บอกด้วยข้อความ/ไอคอนควบคู่สี; รักษา labels, focus ที่มองเห็น, touch targets และการเลื่อนตารางในมือถือ

รักษาโหมดสาธิต localStorage, login/logout, Supabase, `school_admin` และบทบาทเดิม ห้ามแก้ฐานข้อมูล/constraint/RLS และห้ามเพิ่มคีย์หรือ `.env.local` ลง Git

หลังปรับระบบจึงรัน `npm test`, `npm run typecheck`, browser tests เดิมและ regression ที่จำเป็น, `npm run build`, ตรวจ keyboard/reduced-motion และ PDF พร้อมถ่าย desktop/mobile จากเว็บจริงให้ตรวจ ยังไม่ push จนกว่าผู้ใช้จะตรวจแบบเสร็จ

## สิ่งที่ตรวจในรอบภาพร่าง

เปิดแบบ A/B ใน Chrome ที่ desktop 1440px, tablet 820px, mobile 390px ตรวจภาพโหลดสำเร็จ ไม่มี JavaScript error และไม่มี horizontal overflow นี่เป็นการตรวจภาพร่าง ไม่ใช่ผลทดสอบหรือ build ของการปรับระบบจริง

## ที่มาของ assets

- ภาพกรีฑา: https://images.unsplash.com/photo-1461896836934-ffe607ba8211
- ภาพฟุตบอล: https://images.unsplash.com/photo-1574629810360-7efbbe195018
- Sarabun จาก Google Fonts; ใบอนุญาต SIL Open Font License อยู่ที่ `assets/OFL.txt`
- ภาพ tunnel ในร่างเป็นภาพนิ่งแทนการจัดวางเท่านั้น ยังไม่ได้ติดตั้งหรือรัน Framer Motion
