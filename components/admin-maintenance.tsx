"use client";
import { useEffect, useRef, useState } from "react";
import { adminRequest } from "@/lib/admin-api";
type Preview = { counts: Record<string, number>; fingerprint: string };
type Job = {
  id: string;
  status: "preparing" | "clearing" | "partial" | "complete" | "released";
  processed: number;
  total: number;
  manifest?: string;
  error?: string;
};
type Manifest = {
  id: string;
  parts: number;
  sha256: string;
  createdAt?: string;
  counts?: Record<string, number>;
};
const phrase = "ล้างข้อมูลการแข่งขันทั้งหมด";
const labels: Record<string, string> = {
  registrations: "ทะเบียนนักกีฬา",
  matches: "คู่แข่งขัน",
  athletics_events: "รายการกรีฑา",
  athletics_results: "ผลกรีฑา",
  medals: "เหรียญ",
  team_files: "ไฟล์ทีม",
  competitions: "สายแข่งขันที่จะเริ่มใหม่",
  coachFiles: "ไฟล์ผู้ฝึกสอนทุกเวอร์ชัน",
};
export default function AdminMaintenance({
  onChanged,
}: {
  onChanged: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [job, setJob] = useState<Job | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [archives, setArchives] = useState<Manifest[]>([]);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await adminRequest<{
        preview: Preview | null;
        job: Job | null;
        previewError?: string;
      }>("/api/competition-reset");
      setPreview(r.preview);
      setJob(r.job);
      setMaintenanceActive(!!r.job);
      setConfirmation("");
      if (r.previewError) setError(r.previewError);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตรวจข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function follow(current: Job) {
    setJob(current);
    for (
      let i = 0;
      i < 10000 && active.current && current.status !== "complete";
      i++
    ) {
      if (current.error) {
        setError(current.error);
        return;
      }
      const r = await adminRequest<{ job: Job }>(
        "/api/competition-reset",
        "POST",
        { action: "step", jobId: current.id },
      );
      current = r.job;
      if (active.current) setJob(current);
    }
    if (current.status === "complete" && active.current) {
      setMaintenanceActive(false);
      setConfirmation("");
      setMessage("เริ่มการแข่งขันใหม่เรียบร้อยแล้ว");
      await onChanged();
    } else if (active.current && !current.error)
      setMessage("หยุดติดตามชั่วคราว สามารถกดดำเนินการต่อได้");
  }
  async function begin(resume = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (resume && job) {
        const r = await adminRequest<{ job: Job }>(
          "/api/competition-reset",
          "POST",
          { action: "step", jobId: job.id },
        );
        await follow(r.job);
      } else {
        if (!preview || confirmation !== phrase)
          throw Error("กรอกข้อความยืนยันให้ตรงกัน");
        const r = await adminRequest<{ job: Job }>(
          "/api/competition-reset",
          "POST",
          { action: "start", fingerprint: preview.fingerprint, confirmation },
        );
        setMaintenanceActive(true);
        await follow(r.job);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "ดำเนินการไม่สำเร็จ กรุณาโหลดสถานะแล้วดำเนินการต่อ",
      );
      try {
        const r = await adminRequest<{
          preview: Preview | null;
          job: Job | null;
          previewError?: string;
        }>("/api/competition-reset");
        setPreview(r.preview);
        if (r.job) setJob(r.job);
        setMaintenanceActive(!!r.job);
      } catch {}
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function download(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const manifest = await adminRequest<Manifest>(
        `/api/competition-reset?archiveId=${id}&part=manifest`,
      );
      if (
        !Number.isInteger(manifest.parts) ||
        manifest.parts < 1 ||
        manifest.parts > 100
      )
        throw Error("ส่วนสำรองไม่ถูกต้อง");
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < manifest.parts; i++) {
        const p = await adminRequest<{ encoding: string; data: string }>(
          `/api/competition-reset?archiveId=${id}&part=${i}`,
        );
        if (p.encoding !== "base64-json") throw Error("รูปแบบสำรองไม่ถูกต้อง");
        chunks.push(Uint8Array.from(atob(p.data), (c) => c.charCodeAt(0)));
      }
      const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== manifest.sha256) throw Error("ข้อมูลสำรองไม่ครบหรือเสียหาย");
      const entries = JSON.parse(new TextDecoder().decode(bytes));
      const url = URL.createObjectURL(
        new Blob([JSON.stringify({ manifest, entries }, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `competition-backup-${id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("ดาวน์โหลดข้อมูลสำรองแล้ว เก็บไฟล์นี้ในพื้นที่ส่วนตัว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดาวน์โหลดสำรองไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function history() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const all: Manifest[] = [];
      let offset: number | null = 0;
      do {
        const r: { archives: Manifest[]; nextOffset: number | null } =
          await adminRequest<{
            archives: Manifest[];
            nextOffset: number | null;
          }>(`/api/competition-reset?archives=1&offset=${offset}`);
        all.push(...r.archives);
        offset = r.nextOffset;
      } while (offset !== null && offset !== undefined);
      setArchives(all);
      if (!all.length) setMessage("ยังไม่มีข้อมูลสำรองการแข่งขัน");
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดสำรองไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function release() {
    if (
      !job ||
      busy ||
      !window.confirm(
        "ยุติงานและเปิดให้บันทึกข้อมูลอีกครั้งใช่หรือไม่? ข้อมูลอาจถูกล้างบางส่วนแล้ว โปรดตรวจสำรองก่อนเริ่มใหม่",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await adminRequest("/api/competition-reset", "POST", {
        action: "release",
        jobId: job.id,
      });
      setJob({
        ...job,
        status: "released",
        error: "ยุติงานแล้ว โปรดตรวจสำรองและข้อมูลคงเหลือก่อนเริ่มใหม่",
      });
      setMaintenanceActive(false);
      setPreview(null);
      setMessage("ยุติงานและเปิดให้บันทึกข้อมูลแล้ว");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยุติงานไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-maintenance danger-zone">
      <h2>เริ่มการแข่งขันใหม่</h2>
      <p>
        ล้างนักกีฬา ผู้ฝึกสอน ตารางแข่งขัน ผลกรีฑา และเหรียญ
        รวมถึงทีมและคู่ในสายแข่งขัน โดยเก็บโรงเรียน บัญชี ประวัติ/โลโก้โรงเรียน
        รายการกีฬาและกติกาไว้
      </p>
      <p className="muted">
        ระบบสำรองก่อนล้างทุกครั้ง
        ระหว่างดำเนินการจะไม่รับการบันทึกข้อมูลการแข่งขัน
        หากสะดุดให้โหลดสถานะแล้วดำเนินการต่อ
      </p>
      <div className="admin-actions">
        <button disabled={busy} onClick={load}>
          ตรวจข้อมูลก่อนเริ่มการแข่งขันใหม่
        </button>
        <button disabled={busy} onClick={history}>
          ดูข้อมูลสำรองย้อนหลัง
        </button>
      </div>
      {busy && <p role="status">กำลังดำเนินการ กรุณารอ…</p>}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {preview &&
        !maintenanceActive &&
        (!job || job.status === "complete" || job.status === "released") && (
          <div className="admin-editor">
            <h3>ข้อมูลที่จะล้าง</h3>
            <dl className="reset-counts">
              {Object.entries(preview.counts).map(([key, n]) => (
                <div key={key}>
                  <dt>{labels[key] || key}</dt>
                  <dd>{n}</dd>
                </div>
              ))}
            </dl>
            <label>
              พิมพ์ข้อความยืนยันการล้างข้อมูล
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                placeholder={phrase}
              />
            </label>
            <p>พิมพ์ “{phrase}” เพื่อยืนยัน</p>
            <button
              className="danger-button"
              disabled={busy || confirmation !== phrase}
              onClick={() => begin()}
            >
              ยืนยันเริ่มการแข่งขันใหม่
            </button>
          </div>
        )}
      {job && (
        <div className="admin-editor">
          <h3>สถานะการล้างข้อมูล</h3>
          <p>
            {job.status === "complete"
              ? "เสร็จแล้ว"
              : job.status === "released"
                ? "ยุติงานแล้ว"
                : job.status === "preparing"
                  ? "กำลังสำรองข้อมูล"
                  : job.status === "partial"
                    ? "ดำเนินการยังไม่ครบ"
                    : "กำลังล้างข้อมูล"}{" "}
            · {job.processed}/{job.total}
          </p>
          <p className="muted">รหัสงาน: {job.id}</p>
          {job.error && <p role="alert">{job.error}</p>}
          {maintenanceActive && (
            <div className="admin-actions">
              {job.status !== "released" && (
                <button disabled={busy} onClick={() => begin(true)}>
                  {job.status === "complete"
                    ? "ปลดโหมดบำรุงรักษาหลังล้างข้อมูล"
                    : "ดำเนินการล้างข้อมูลต่อ"}
                </button>
              )}
              {job.status !== "complete" && (
                <button disabled={busy} onClick={release}>
                  {job.status === "released"
                    ? "เปิดให้บันทึกข้อมูลอีกครั้ง"
                    : "ยุติงานและเปิดให้บันทึกข้อมูล"}
                </button>
              )}
            </div>
          )}
          {job.manifest && (
            <button disabled={busy} onClick={() => download(job.id)}>
              ดาวน์โหลดข้อมูลสำรอง
            </button>
          )}
        </div>
      )}
      {archives.length > 0 && (
        <div className="admin-editor">
          <h3>ข้อมูลสำรองที่ผ่านมา</h3>
          <ul>
            {archives.map((a) => (
              <li key={a.id}>
                {a.createdAt
                  ? new Date(a.createdAt).toLocaleString("th-TH", {
                      timeZone: "Asia/Bangkok",
                    })
                  : a.id}{" "}
                <button disabled={busy} onClick={() => download(a.id)}>
                  ดาวน์โหลดสำรอง {a.id.slice(0, 8)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
