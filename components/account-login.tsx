"use client";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
export default function AccountLogin({
  busy,
  onSession,
}: {
  busy: boolean;
  onSession: () => Promise<void>;
}) {
  const [method, setMethod] = useState<"username" | "email">("username");
  const [working, setWorking] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || working) return;
    setWorking(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
      if (method === "email") {
        const result = await supabase.auth.signInWithPassword({
          email: String(values.get("email") || "").trim(),
          password: String(values.get("password") || ""),
        });
        if (result.error || !result.data.user)
          throw Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        const profile = await supabase
          .from("profiles")
          .select("role")
          .eq("id", result.data.user.id)
          .maybeSingle();
        if (profile.error || profile.data?.role !== "admin") {
          await supabase.auth.signOut();
          throw Error(
            "การเข้าสู่ระบบด้วยอีเมลใช้สำหรับผู้ดูแลระบบเท่านั้น โรงเรียนและกรรมการกรุณาใช้ชื่อบัญชี",
          );
        }
      } else {
        const response = await fetch("/api/school-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "login",
            username: String(values.get("username") || "").trim(),
            password: String(values.get("password") || ""),
          }),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
        if (!result.session?.access_token || !result.session?.refresh_token)
          throw Error("ระบบไม่ส่งข้อมูลเข้าสู่ระบบ กรุณาลองใหม่");
        const saved = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (saved.error)
          throw Error("เริ่มต้นการเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
      }
      await onSession();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "เชื่อมต่อระบบเข้าสู่ระบบไม่สำเร็จ",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="account-login" aria-label="เข้าสู่ระบบ">
      <div
        className="account-login-methods"
        role="group"
        aria-label="เลือกวิธีเข้าสู่ระบบ"
      >
        <button
          type="button"
          aria-pressed={method === "username"}
          disabled={busy || working}
          onClick={() => {
            setMethod("username");
            setError("");
          }}
        >
          โรงเรียน / กรรมการ
        </button>
        <button
          type="button"
          aria-pressed={method === "email"}
          disabled={busy || working}
          onClick={() => {
            setMethod("email");
            setError("");
          }}
        >
          ผู้ดูแลระบบ (อีเมล)
        </button>
      </div>
      <p className="muted">
        {method === "email"
          ? "สำหรับบัญชีผู้ดูแลระบบที่มีอยู่แล้ว ไม่เปิดสมัครผู้ดูแลผ่านหน้านี้"
          : "โรงเรียนและกรรมการใช้ชื่อบัญชีและรหัสผ่าน บัญชีใหม่ต้องรออนุมัติ"}
      </p>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      <form key={method} onSubmit={submit}>
        <fieldset
          className="account-fields"
          disabled={busy || working || !supabase}
        >
          <label>
            {method === "email" ? "อีเมล" : "ชื่อบัญชี"}
            {method === "email" ? (
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            ) : (
              <input
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={32}
                required
              />
            )}
          </label>
          <label>
            รหัสผ่าน
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="primary">
            {working ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
