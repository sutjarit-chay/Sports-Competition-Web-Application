"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { SignupRole } from "@/lib/account-types";

type Registration = {
  mode: "register";
  role: SignupRole;
  username: string;
  password: string;
  fullName: string;
  schoolName: string;
  schoolType: string;
  phone: string;
};
export default function SchoolRegistrationPage() {
  const [role, setRole] = useState<SignupRole>("school");
  const [logo, setLogo] = useState<File | null>(null),
    [logoPreview, setLogoPreview] = useState("");
  const [preview, setPreview] = useState<Registration | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!logo) {
      setLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);
  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    setPreview({
      mode: "register",
      role,
      username: String(data.get("username") || "").trim(),
      password: String(data.get("password") || ""),
      fullName: String(data.get("full_name") || "").trim(),
      schoolName:
        role === "school" ? String(data.get("school_name") || "").trim() : "",
      schoolType:
        role === "school" ? String(data.get("school_type") || "") : "",
      phone: String(data.get("phone") || "").trim(),
    });
  }
  async function submit() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/school-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "ส่งคำขอสมัครไม่สำเร็จ");
      if (result.account?.status !== "pending")
        throw Error(
          "ไม่สามารถยืนยันสถานะคำขอได้ กรุณาลองเข้าสู่ระบบเพื่อตรวจสอบ",
        );
      setSent(true);
      setPreview(null);
      setLogo(null);
      formRef.current?.reset();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "เชื่อมต่อระบบสมัครไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="registration-page">
      <div className="registration-content">
        <p className="eyebrow">ACCOUNT REGISTRATION</p>
        <h1>สมัครบัญชีโรงเรียน / กรรมการ</h1>
        <p className="muted">
          ใช้ชื่อบัญชีและรหัสผ่าน ไม่ต้องมีอีเมล
          เมื่อสมัครแล้วต้องรอผู้ดูแลระบบอนุมัติก่อนใช้งานตามบทบาท
        </p>
        {error && (
          <p className="feedback feedback-error" role="alert">
            {error}
          </p>
        )}
        {sent ? (
          <section className="panel">
            <p role="status" className="feedback feedback-success">
              ส่งคำขอสมัครแล้ว รอผู้ดูแลระบบอนุมัติ
            </p>
            <p>
              เข้าสู่ระบบด้วยชื่อบัญชีและรหัสผ่านที่สมัครไว้เพื่อตรวจสอบสถานะ
            </p>
            <Link href="/?account=1">ไปหน้าเข้าสู่ระบบ</Link>
          </section>
        ) : (
          <>
            <section className="panel">
              <form
                ref={formRef}
                className="registration-form"
                onChange={() => setPreview(null)}
                onSubmit={inspect}
              >
                <fieldset disabled={busy} className="account-fields">
                  <legend>ประเภทบัญชี</legend>
                  <div className="account-role-options">
                    <label>
                      <input
                        type="radio"
                        name="role"
                        value="school"
                        checked={role === "school"}
                        onChange={() => setRole("school")}
                      />
                      โรงเรียน
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="role"
                        value="referee"
                        checked={role === "referee"}
                        onChange={() => setRole("referee")}
                      />
                      กรรมการ
                    </label>
                  </div>
                  {role === "school" && (
                    <>
                      <label>
                        ชื่อโรงเรียน
                        <input
                          name="school_name"
                          minLength={2}
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
                            defaultChecked
                          />
                          โรงเรียนขนาดเล็ก
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="school_type"
                            value="ขยายโอกาส"
                          />
                          โรงเรียนขยายโอกาส
                        </label>
                      </fieldset>
                    </>
                  )}
                  <label>
                    {role === "school"
                      ? "ชื่อผู้บริหาร / ผู้ประสานงาน"
                      : "ชื่อ–นามสกุล"}
                    <input
                      name="full_name"
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label>
                    เบอร์โทรศัพท์ (ไม่บังคับ)
                    <input
                      name="phone"
                      type="tel"
                      maxLength={20}
                      pattern="[0-9+() -]{8,20}"
                      autoComplete="tel"
                    />
                  </label>
                  {role === "school" && (
                    <>
                      <label>
                        ตราโรงเรียน (ตัวอย่างในเครื่อง)
                        <input
                          name="school_logo"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(event) =>
                            setLogo(event.currentTarget.files?.[0] || null)
                          }
                        />
                        <small>แสดงตัวอย่างเท่านั้น ยังไม่อัปโหลดรูปภาพ</small>
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
                    </>
                  )}
                  <label>
                    ชื่อบัญชี
                    <input
                      name="username"
                      aria-label="ชื่อบัญชี"
                      minLength={3}
                      maxLength={32}
                      pattern="[A-Za-z0-9](?:[A-Za-z0-9._-]{1,30}[A-Za-z0-9])"
                      autoComplete="username"
                      required
                    />
                    <small>
                      3–32 ตัวอักษร ใช้ภาษาอังกฤษ ตัวเลข . _ -
                      ชื่อบัญชีไม่แยกตัวพิมพ์เล็ก–ใหญ่
                    </small>
                  </label>
                  <label>
                    รหัสผ่าน
                    <input
                      name="password"
                      aria-label="รหัสผ่าน"
                      type="password"
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                    <small>10–128 ตัวอักษร</small>
                  </label>
                  <button className="primary" type="submit">
                    ตรวจสอบข้อมูล
                  </button>
                </fieldset>
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
                  <dt>ประเภทบัญชี</dt>
                  <dd>{preview.role === "school" ? "โรงเรียน" : "กรรมการ"}</dd>
                  {preview.role === "school" && (
                    <>
                      <dt>ชื่อโรงเรียน</dt>
                      <dd>{preview.schoolName}</dd>
                      <dt>ประเภทโรงเรียน</dt>
                      <dd>{preview.schoolType}</dd>
                    </>
                  )}
                  <dt>ชื่อผู้สมัคร</dt>
                  <dd>{preview.fullName}</dd>
                  <dt>ชื่อบัญชี</dt>
                  <dd>{preview.username.toLowerCase()}</dd>
                  <dt>เบอร์โทรศัพท์</dt>
                  <dd>{preview.phone || "ไม่ระบุ"}</dd>
                </dl>
                <p>
                  เมื่อส่งคำขอแล้ว
                  บัญชีจะยังไม่มีสิทธิ์โรงเรียนหรือกรรมการจนกว่าผู้ดูแลอนุมัติ
                </p>
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  {busy ? "กำลังส่งคำขอ…" : "ส่งคำขอสมัคร"}
                </button>
              </section>
            )}
          </>
        )}
        <p>
          <Link href="/?account=1">มีบัญชีแล้ว เข้าสู่ระบบ</Link>
          {" · "}
          <Link href="/">กลับหน้าหลัก</Link>
        </p>
      </div>
    </main>
  );
}
