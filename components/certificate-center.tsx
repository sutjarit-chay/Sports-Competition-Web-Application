"use client";

import { useEffect, useRef, useState } from "react";
import {
  CERTIFICATE_AWARD_LABELS,
  DEFAULT_CERTIFICATE_BACKGROUND,
  DEFAULT_CERTIFICATE_LAYOUT,
  type CertificateCandidate,
  type CertificateIssue,
  type CertificateLayout,
  type CertificateTemplate,
} from "@/lib/certificate-types";

type Props = {
  accessToken: string;
  role: string;
  schoolId: string;
  schools: { id: string; name: string }[];
  competitions: { id: string; name: string }[];
};
type Preview = {
  candidates: CertificateCandidate[];
  blocked: string[];
  fingerprint: string;
};
const positionLabels: Record<keyof CertificateLayout, string> = {
  nameY: "ตำแหน่งชื่อ (%)",
  schoolY: "ตำแหน่งโรงเรียน (%)",
  roleY: "ตำแหน่งประเภทผู้รับ (%)",
  eventY: "ตำแหน่งรายการ (%)",
  awardY: "ตำแหน่งรางวัล (%)",
  fontSize: "ขนาดตัวอักษร (pt)",
  qrX: "QR แนวนอน (%)",
  qrY: "QR แนวตั้ง (%)",
  qrSize: "ขนาด QR (%)",
};

export default function CertificateCenter({
  accessToken,
  role,
  schoolId,
  schools,
  competitions,
}: Props) {
  const admin = role === "admin";
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || "");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [issue, setIssue] = useState<CertificateIssue | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [template, setTemplate] = useState<CertificateTemplate>({
    background: null,
    layout: { ...DEFAULT_CERTIFICATE_LAYOUT },
  });
  const [templateVersion, setTemplateVersion] = useState<string | null>(null);
  const [background, setBackground] = useState(DEFAULT_CERTIFICATE_BACKGROUND);
  const [templateReady, setTemplateReady] = useState(false);
  const [rawBackground, setRawBackground] = useState("");
  const [templateDirty, setTemplateDirty] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedIds([]);
  }, [competitionId, accessToken, selectedSchool, schoolId]);
  const [busy, setBusy] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  async function jsonRequest(path: string, init: RequestInit = {}) {
    const res = await fetch(path, { ...init, headers, cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(
        res.status === 409
          ? "ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่ก่อนดำเนินการอีกครั้ง"
          : body.error || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่",
      );
    return body;
  }
  useEffect(() => {
    const current = ++sequence.current;
    setIssue(null);
    setVersion(null);
    setPreview(null);
    setError("");
    setMessage("");
    if (!competitionId) return;
    setBusy("load");
    jsonRequest(
      `/api/certificates?competitionId=${encodeURIComponent(competitionId)}`,
    )
      .then((data) => {
        if (current === sequence.current) {
          setIssue(data.issue);
          setVersion(data.version);
        }
      })
      .catch((e) => {
        if (current === sequence.current) setError(e.message);
      })
      .finally(() => {
        if (current === sequence.current) setBusy("");
      });
    return () => {
      sequence.current++;
    };
    // Authentication and competition changes invalidate all displayed issuance data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitionId, accessToken, refresh]);
  useEffect(() => {
    if (!admin) return;
    let active = true;
    jsonRequest("/api/certificate-template")
      .then((data) => {
        if (active) {
          setTemplate(data.template);
          setTemplateDirty(false);
          setTemplateVersion(data.version);
          setBackground(
            data.defaultBackground || DEFAULT_CERTIFICATE_BACKGROUND,
          );
          setTemplateReady(true);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin, accessToken, refresh]);
  async function action(action: "preview" | "publish" | "revoke") {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const data = await jsonRequest("/api/certificates", {
        method: "POST",
        body: JSON.stringify({
          action,
          competitionId,
          expectedVersion: version,
          fingerprint: preview?.fingerprint,
        }),
      });
      if (action === "preview") {
        setPreview(data);
        setMessage("ตรวจสอบรายชื่อเรียบร้อยแล้ว");
      } else {
        setIssue(data.issue);
        setVersion(data.version);
        setPreview(null);
        setMessage(
          action === "publish"
            ? "ออกเกียรติบัตรเรียบร้อยแล้ว"
            : "ยกเลิกการเผยแพร่เกียรติบัตรแล้ว",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
      setPreview(null);
    } finally {
      setBusy("");
    }
  }
  async function download(
    format: "pdf" | "zip",
    ids?: string[],
    sample = false,
  ) {
    setBusy("download");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/certificates/download", {
        method: "POST",
        headers,
        body: JSON.stringify({
          competitionId,
          format,
          ids,
          schoolId: admin ? selectedSchool || undefined : schoolId,
          preview: sample,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "ดาวน์โหลดไม่สำเร็จ");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificates${sample ? "-preview" : ""}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("เตรียมไฟล์ดาวน์โหลดเรียบร้อยแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function applyBackground(value: string) {
    const trimmed = value.trim();
    const dataUrl = trimmed.startsWith("data:")
      ? trimmed
      : `data:image/${trimmed.startsWith("iVBOR") ? "png" : "jpeg"};base64,${trimmed}`;
    if (!/^data:image\/(png|jpeg);base64,/i.test(dataUrl))
      throw new Error("รองรับเฉพาะภาพ JPEG หรือ PNG แบบ Base64 เท่านั้น");
    const encoded = dataUrl.split(",")[1];
    let decoded: string;
    try {
      decoded = atob(encoded);
    } catch {
      throw new Error("ข้อมูล Base64 ไม่ถูกต้อง");
    }
    if (decoded.length > 1300000)
      throw new Error("ภาพต้องมีขนาดหลังถอดรหัสไม่เกิน 1.3 MB");
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ภาพได้"));
      image.src = dataUrl;
    });
    setTemplate((previous) => ({ ...previous, background: dataUrl }));
    setTemplateDirty(true);
    setPreview(null);
    setMessage("ใช้ภาพในตัวอย่างแล้ว กรุณาบันทึกแม่แบบเพื่อยืนยัน");
  }
  async function saveTemplate() {
    setBusy("template");
    setError("");
    setMessage("");
    try {
      const data = await jsonRequest("/api/certificate-template", {
        method: "PUT",
        body: JSON.stringify({ template, expectedVersion: templateVersion }),
      });
      setTemplateVersion(data.version);
      if (data.template) setTemplate(data.template);
      setTemplateDirty(false);
      setPreview(null);
      setMessage("บันทึกแม่แบบเรียบร้อยแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  const records = (issue?.published ? issue.records : []).filter((record) =>
    admin
      ? !selectedSchool || record.schoolId === selectedSchool
      : record.schoolId === schoolId,
  );
  const activeSelectedIds = selectedIds.filter((id) =>
    records.some((record) => record.id === id),
  );
  const batchIds = activeSelectedIds.length
    ? activeSelectedIds
    : records.map((record) => record.id);
  const sample = preview?.candidates[0] || records[0];
  return (
    <section className="certificate-center" aria-label="ศูนย์เกียรติบัตร">
      <div className="certificate-heading">
        <div>
          <h2>เกียรติบัตรการแข่งขัน</h2>
          <p>เกียรติบัตรสำหรับนักกีฬาและผู้ฝึกสอน</p>
        </div>
        <span className="certificate-badge">
          {issue?.published ? "เผยแพร่แล้ว" : "ยังไม่เผยแพร่"}
        </span>
      </div>
      <div className="certificate-toolbar">
        <label>
          รายการแข่งขัน
          <select
            value={competitionId}
            disabled={!!busy}
            onChange={(e) => setCompetitionId(e.target.value)}
          >
            <option value="">เลือกรายการแข่งขัน</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {admin && (
          <label>
            โรงเรียน
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
            >
              <option value="">ทุกโรงเรียน</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="certificate-actions">
        <button
          disabled={!!busy}
          onClick={() => {
            setTemplateReady(false);
            setRefresh((n) => n + 1);
          }}
        >
          โหลดข้อมูลล่าสุด
        </button>
      </div>
      <div aria-live="polite" role="status">
        {busy && <p>กำลังดำเนินการ กรุณารอสักครู่…</p>}
        {message && <p className="certificate-success">{message}</p>}
      </div>
      {error && (
        <p role="alert" className="certificate-error">
          {error}
        </p>
      )}
      {admin && (
        <div className="certificate-actions">
          <button
            disabled={!!busy || !competitionId}
            onClick={() => action("preview")}
          >
            ตรวจสอบรายชื่อก่อนออก
          </button>
          <button
            disabled={
              !!busy ||
              templateDirty ||
              !preview?.candidates.length ||
              !!preview?.blocked.length ||
              !preview.fingerprint
            }
            onClick={() => action("publish")}
          >
            ยืนยันออกเกียรติบัตร
          </button>
          <button
            disabled={!!busy || !issue?.published}
            onClick={() => action("revoke")}
          >
            ยกเลิกการเผยแพร่
          </button>
        </div>
      )}
      {admin && preview && (
        <div className="certificate-panel">
          <h3>ผลการตรวจสอบ: {preview.candidates.length} รายชื่อ</h3>
          {preview.blocked.length > 0 && (
            <div className="certificate-error">
              <p>ยังออกเกียรติบัตรไม่ได้ กรุณาแก้ไขข้อมูลต่อไปนี้</p>
              <ul>
                {preview.blocked.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {!preview.candidates.length && <p>ไม่พบผู้มีสิทธิ์รับเกียรติบัตร</p>}
          <ul className="certificate-candidates">
            {preview.candidates.map((c, i) => (
              <li key={`${c.recipientId}-${i}`}>
                {c.recipientName} · {c.schoolName} · {c.event} ·{" "}
                {CERTIFICATE_AWARD_LABELS[c.award]}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="certificate-panel">
        <div className="certificate-heading">
          <h3>เกียรติบัตรที่เผยแพร่ ({records.length})</h3>
          <div className="certificate-actions">
            <button
              disabled={!!busy || !batchIds.length || batchIds.length > 50}
              onClick={() => download("pdf", batchIds)}
            >
              ดาวน์โหลดรวม PDF
            </button>
            <button
              disabled={!!busy || !batchIds.length || batchIds.length > 10}
              onClick={() => download("zip", batchIds)}
            >
              ดาวน์โหลด ZIP
            </button>
          </div>
        </div>
        <p>
          เลือกแล้ว {activeSelectedIds.length} รายชื่อ ·
          หากไม่เลือกจะดาวน์โหลดทุกรายชื่อในตัวกรอง ({batchIds.length} รายชื่อ)
          · PDF สูงสุด 50 รายชื่อ / ZIP สูงสุด 10 รายชื่อ และไฟล์ไม่เกิน 4 MB
          หาก ZIP มีขนาดใหญ่ กรุณาใช้ PDF รวม
        </p>
        {batchIds.length > 50 && (
          <p className="certificate-error">
            กรุณาเลือกผู้รับไม่เกิน 50 รายชื่อ หรือกรองโรงเรียนก่อนดาวน์โหลด
          </p>
        )}
        {!records.length ? (
          <p>
            {busy === "load"
              ? "กำลังโหลดเกียรติบัตร…"
              : "ยังไม่มีเกียรติบัตรที่เผยแพร่สำหรับรายการนี้"}
          </p>
        ) : (
          <div className="certificate-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          records.length > 0 &&
                          activeSelectedIds.length === records.length
                        }
                        disabled={!!busy}
                        onChange={(e) =>
                          setSelectedIds(
                            e.target.checked ? records.map((r) => r.id) : [],
                          )
                        }
                      />
                      เลือกทั้งหมด
                    </label>
                  </th>
                  <th>ชื่อผู้รับ / เลขเกียรติบัตร</th>
                  <th>โรงเรียน / รายการ</th>
                  <th>รางวัล</th>
                  <th>ดาวน์โหลด</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`เลือก ${r.recipientName}`}
                        checked={activeSelectedIds.includes(r.id)}
                        disabled={!!busy}
                        onChange={(e) =>
                          setSelectedIds((ids) =>
                            e.target.checked
                              ? [...ids, r.id]
                              : ids.filter((id) => id !== r.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      {r.recipientName}
                      <small>
                        {r.number} ·{" "}
                        {r.recipientType === "coach" ? "ผู้ฝึกสอน" : "นักกีฬา"}
                      </small>
                    </td>
                    <td>
                      {r.schoolName}
                      <small>{r.event}</small>
                    </td>
                    <td>{CERTIFICATE_AWARD_LABELS[r.award]}</td>
                    <td>
                      <button
                        disabled={!!busy}
                        onClick={() => download("pdf", [r.id])}
                        aria-label={`ดาวน์โหลดเกียรติบัตร ${r.recipientName}`}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {admin && (
        <details className="certificate-panel">
          <summary>ตั้งค่าแม่แบบเกียรติบัตร</summary>
          {templateDirty && (
            <p className="certificate-error">
              มีการแก้ไขแม่แบบที่ยังไม่บันทึก
              กรุณาบันทึกและตรวจสอบรายชื่ออีกครั้งก่อนออกเกียรติบัตร
            </p>
          )}
          <p>
            เก็บความละเอียดต้นฉบับโดยไม่ย่อภาพ รองรับ JPEG/PNG
            ขนาดหลังถอดรหัสไม่เกิน 1.3 MB ตามข้อจำกัดพื้นที่จัดเก็บส่วนตัว
            การเปลี่ยนภาพจะมีผลหลังบันทึกแม่แบบเท่านั้น
          </p>
          <fieldset disabled={!templateReady || !!busy}>
            <legend>ภาพพื้นหลัง</legend>
            <label>
              เลือกไฟล์ภาพ
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setError("");
                  try {
                    if (!["image/png", "image/jpeg"].includes(file.type))
                      throw new Error("รองรับเฉพาะ JPEG หรือ PNG");
                    if (file.size > 1300000)
                      throw new Error("ไฟล์ภาพต้องมีขนาดไม่เกิน 1.3 MB");
                    const value = await new Promise<string>(
                      (resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      },
                    );
                    await applyBackground(value);
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "อ่านภาพไม่สำเร็จ",
                    );
                  }
                }}
              />
            </label>
            <label>
              หรือวาง Base64 / Data URL
              <textarea
                rows={3}
                value={rawBackground}
                onChange={(e) => setRawBackground(e.target.value)}
                placeholder="data:image/png;base64,…"
              />
            </label>
            <div className="certificate-actions">
              <button
                disabled={!rawBackground.trim()}
                onClick={() => {
                  setError("");
                  applyBackground(rawBackground).catch((e) =>
                    setError(e.message),
                  );
                }}
              >
                ใช้ภาพที่วางในตัวอย่าง
              </button>
              <button
                onClick={() => {
                  setTemplate((t) => ({ ...t, background: null }));
                  setTemplateDirty(true);
                  setPreview(null);
                }}
              >
                ใช้พื้นหลังเริ่มต้น
              </button>
            </div>
            <div className="certificate-layout-fields">
              {(Object.keys(positionLabels) as (keyof CertificateLayout)[]).map(
                (key) => (
                  <label key={key}>
                    {positionLabels[key]}
                    <input
                      type="number"
                      min={key === "fontSize" ? 10 : 5}
                      max={key === "fontSize" ? 36 : key === "qrSize" ? 12 : 95}
                      step="0.5"
                      value={template.layout[key]}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (
                          Number.isFinite(value) &&
                          value >= (key === "fontSize" ? 10 : 5) &&
                          value <=
                            (key === "fontSize"
                              ? 36
                              : key === "qrSize"
                                ? 12
                                : 95)
                        ) {
                          setTemplateDirty(true);
                          setTemplate((t) => ({
                            ...t,
                            layout: { ...t.layout, [key]: value },
                          }));
                          setPreview(null);
                        }
                      }}
                    />
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <div
            className="certificate-preview"
            aria-label="ตัวอย่างตำแหน่งข้อความบนเกียรติบัตร"
          >
            <img
              src={template.background || background}
              alt="พื้นหลังเกียรติบัตร"
            />
            {(
              [
                {
                  key: "nameY",
                  text: sample?.recipientName || "นายตัวอย่าง นามสกุล",
                },
                {
                  key: "schoolY",
                  text: sample?.schoolName || "โรงเรียนตัวอย่าง",
                },
                {
                  key: "roleY",
                  text:
                    sample?.recipientType === "coach" ? "ผู้ฝึกสอน" : "นักกีฬา",
                },
                {
                  key: "eventY",
                  text: sample?.event || "รายการแข่งขันตัวอย่าง",
                },
                {
                  key: "awardY",
                  text: CERTIFICATE_AWARD_LABELS[sample?.award || "gold"],
                },
              ] as const
            ).map((item) => (
              <span
                key={item.key}
                style={{
                  top: `${template.layout[item.key]}%`,
                  fontSize: `${template.layout.fontSize / 11}cqw`,
                }}
              >
                {item.text}
              </span>
            ))}
            <span
              className="certificate-qr"
              style={{
                left: `${template.layout.qrX}%`,
                top: `${template.layout.qrY}%`,
                width: `${template.layout.qrSize}%`,
              }}
            >
              QR
            </span>
          </div>
          <p>
            ตัวอย่างตำแหน่งโดยประมาณ ดาวน์โหลดตัวอย่าง PDF เพื่อตรวจสอบผลจริง
          </p>
          <div className="certificate-actions">
            <button disabled={!!busy || !templateReady} onClick={saveTemplate}>
              บันทึกแม่แบบ
            </button>
            <button
              disabled={!!busy || !competitionId}
              onClick={() => download("pdf", undefined, true)}
            >
              ดาวน์โหลดตัวอย่าง PDF (แม่แบบที่บันทึกแล้ว)
            </button>
          </div>
        </details>
      )}
    </section>
  );
}
