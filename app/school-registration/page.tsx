"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type RegistrationPreview = {
  schoolName: string;
  schoolType: string;
  executiveName: string;
  username: string;
};

export default function SchoolRegistrationPage() {
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [preview, setPreview] = useState<RegistrationPreview | null>(null);

  useEffect(() => {
    if (!logo) {
      setLogoPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(logo);
    setLogoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logo]);

  function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPreview({
      schoolName: String(form.get("school_name")).trim(),
      schoolType: String(form.get("school_type")),
      executiveName: String(form.get("executive_name")).trim(),
      username: String(form.get("username")).trim(),
    });
  }

  return (
    <main className="registration-page">
      <div className="registration-content">
        <p className="eyebrow">SCHOOL REGISTRATION</p>
        <h1>ลงทะเบียนโรงเรียน</h1>
        <p className="muted">
          กรอกข้อมูลพื้นฐานเพื่อเตรียมคำขอลงทะเบียน ใช้ชื่อบัญชีและรหัสผ่าน
          ไม่ต้องใช้อีเมล
        </p>
        <p className="registration-message" role="status">
          หน้านี้เป็นตัวอย่างหน้าจอ ข้อมูลยังไม่ถูกส่งหรือบันทึกในระบบ
        </p>

        <section className="panel">
          <form
            className="registration-form"
            onChange={() => setPreview(null)}
            onSubmit={showPreview}
          >
            <label>
              ชื่อโรงเรียน
              <input
                name="school_name"
                maxLength={120}
                autoComplete="organization"
                required
              />
            </label>

            <fieldset className="school-type-options">
              <legend>ประเภทโรงเรียน</legend>
              <label>
                <input
                  type="radio"
                  name="school_type"
                  value="ขนาดเล็ก"
                  required
                  defaultChecked
                />
                โรงเรียนขนาดเล็ก
              </label>
              <label>
                <input
                  type="radio"
                  name="school_type"
                  value="ขยายโอกาส"
                  required
                />
                โรงเรียนขยายโอกาส
              </label>
            </fieldset>

            <label>
              ชื่อผู้บริหาร
              <input
                name="executive_name"
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>

            <label>
              ตราโรงเรียน
              <input
                name="school_logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                required
                onChange={(event) => {
                  setLogo(event.currentTarget.files?.[0] || null);
                }}
              />
              <small>
                เลือกไฟล์ภาพเพื่อดูตัวอย่างเท่านั้น ยังไม่มีการอัปโหลด
              </small>
            </label>
            {logoPreview && logo && (
              <div className="school-logo-preview">
                <Image
                  src={logoPreview}
                  alt={`ตัวอย่างตรา ${logo.name}`}
                  width={128}
                  height={128}
                  unoptimized
                />
                <span>{logo.name}</span>
              </div>
            )}

            <label>
              ชื่อบัญชี
              <input
                name="username"
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9](?:[A-Za-z0-9._-]{1,30}[A-Za-z0-9])"
                autoComplete="username"
                required
              />
              <small>3–32 ตัวอักษร ใช้ภาษาอังกฤษ ตัวเลข . _ -</small>
            </label>

            <label>
              รหัสผ่าน
              <input
                name="password"
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <small>อย่างน้อย 10 ตัวอักษร</small>
            </label>

            <button className="primary" type="submit">
              ดูตัวอย่างข้อมูล
            </button>
          </form>
        </section>

        {preview && (
          <section
            className="panel registration-preview"
            aria-labelledby="registration-preview-title"
            aria-live="polite"
          >
            <h2 id="registration-preview-title">ตรวจสอบข้อมูล</h2>
            <dl>
              <dt>ชื่อโรงเรียน</dt>
              <dd>{preview.schoolName}</dd>
              <dt>ประเภทโรงเรียน</dt>
              <dd>{preview.schoolType}</dd>
              <dt>ชื่อผู้บริหาร</dt>
              <dd>{preview.executiveName}</dd>
              <dt>ชื่อบัญชี</dt>
              <dd>{preview.username}</dd>
              <dt>ตราโรงเรียน</dt>
              <dd>{logo?.name}</dd>
            </dl>
            <p className="muted">
              ตัวอย่างนี้ยังไม่ได้สร้างบัญชีหรือลงทะเบียนโรงเรียน
              การบันทึกจะเพิ่มภายหลังเมื่อเชื่อมระบบ
            </p>
          </section>
        )}

        <Link href="/">กลับหน้าหลัก</Link>
      </div>
    </main>
  );
}
