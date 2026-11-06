"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { AccountRequest } from "@/lib/account-types";
export default function AccountApprovals({
  onReviewed,
}: {
  onReviewed: () => Promise<void>;
}) {
  const [requests, setRequests] = useState<AccountRequest[]>([]),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function call(method: "GET" | "POST", body?: object) {
    if (!supabase) throw Error("ยังไม่ได้ตั้งค่า Supabase");
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw Error("กรุณาเข้าสู่ระบบใหม่");
    const response = await fetch("/api/account-requests", {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "ตรวจคำขอไม่สำเร็จ");
    return result;
  }
  async function load() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await call("GET");
      setRequests(data.requests);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดคำขอไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function review(
    item: AccountRequest,
    decision: "approved" | "rejected",
  ) {
    if (busy) return;
    const note =
      decision === "rejected" && !item.reviewDecision
        ? window.prompt("ระบุเหตุผลที่ไม่อนุมัติ (ไม่บังคับ):")
        : "";
    if (note === null) return;
    if (
      decision === "approved" &&
      !window.confirm(
        `อนุมัติบัญชี ${item.username} เป็น${item.kind === "school" ? "ผู้ดูแลโรงเรียน" : "กรรมการ"} ใช่หรือไม่?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await call("POST", {
        kind: item.kind,
        id: item.id,
        decision,
        note,
      });
      setRequests((current) =>
        current.filter((r) => r.id !== item.id || r.kind !== item.kind),
      );
      setMessage(
        result.warning ||
          (decision === "approved"
            ? "อนุมัติบัญชีแล้ว"
            : "บันทึกการไม่อนุมัติแล้ว"),
      );
      await onReviewed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตรวจคำขอไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel account-approvals">
      <h2>คำขอสมัครโรงเรียนและกรรมการ</h2>
      <p className="muted">
        บัญชีใหม่ยังไม่มีสิทธิ์ตามบทบาทจนกว่าจะอนุมัติ
        ผู้สมัครไม่สามารถอนุมัติตนเองได้
      </p>
      <button type="button" disabled={busy} onClick={() => void load()}>
        {busy ? "กำลังดำเนินการ…" : "โหลดคำขอที่รอตรวจสอบ"}
      </button>
      {error && (
        <p role="alert" className="feedback feedback-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="feedback feedback-success">
          {message}
        </p>
      )}
      {loaded && requests.length === 0 && (
        <p className="muted">ไม่มีคำขอที่รอตรวจสอบ</p>
      )}
      {requests.map((item) => (
        <article className="school-request" key={`${item.kind}:${item.id}`}>
          <strong>
            {item.kind === "school" ? item.schoolName : item.fullName}
          </strong>
          <p>
            {item.kind === "school" ? "โรงเรียน" : "กรรมการ"} · บัญชี{" "}
            {item.username} · {item.fullName}
            {item.phone ? ` · ${item.phone}` : ""}
          </p>
          <p className="muted">
            ส่งเมื่อ{" "}
            {new Date(item.createdAt).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}
          </p>
          <div>
            {item.reviewDecision ? (
              <>
                <p>
                  คำขอนี้บันทึกคำตัดสินไว้แล้ว
                  หากการดำเนินการสะดุดให้ลองทำต่อหลัง 2 นาที
                  โดยไม่เปลี่ยนคำตัดสินเดิม
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void review(item, item.reviewDecision!)}
                >
                  ดำเนินการต่อตามคำตัดสินเดิม
                </button>
              </>
            ) : (
              <>
                <button
                  className="primary"
                  type="button"
                  disabled={busy}
                  onClick={() => void review(item, "approved")}
                >
                  อนุมัติ
                  {item.kind === "school" ? "และสร้างโรงเรียน" : "กรรมการ"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void review(item, "rejected")}
                >
                  ไม่อนุมัติ
                </button>
              </>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
