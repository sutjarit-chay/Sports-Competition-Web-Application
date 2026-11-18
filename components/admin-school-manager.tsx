"use client";
import { useState } from "react";
import { adminRequest } from "@/lib/admin-api";
type School = { id: string; name: string; logo?: string; school_type?: string };
type Preview = {
  schoolId: string;
  name: string;
  fingerprint: string;
  canDelete: boolean;
  retainedProfileFiles?: number;
  dependencies: Record<string, number>;
};
const labels: Record<string, string> = {
  accounts: "บัญชีที่ผูกโรงเรียน",
  profiles: "บัญชีที่ผูกโรงเรียน",
  registrations: "ทะเบียนนักกีฬา",
  matches: "ตารางแข่งขัน",
  athletics_results: "ผลกรีฑา",
  medals: "เหรียญ",
  team_files: "ไฟล์ทีม",
  management: "สายแข่งขัน",
  storage: "ไฟล์ที่เกี่ยวข้อง",
  privateFiles: "ไฟล์ที่เกี่ยวข้อง",
};
export default function AdminSchoolManager({
  schools,
  onChanged,
  onManage,
}: {
  schools: School[];
  onChanged: () => Promise<void>;
  onManage: (id: string) => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "จัดการโรงเรียนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel admin-maintenance">
      <h2>จัดการโรงเรียน</h2>
      <p className="muted">
        เปิดหน้าต่างแก้ไขชื่อ โลโก้ ประเภทโรงเรียน ข้อมูลติดต่อ
        นักกีฬาและผู้ฝึกสอน โดยรักษาทะเบียนเดิม
        การลบต้องไม่มีบัญชีหรือข้อมูลการแข่งขันเชื่อมอยู่ หากมีบัญชี
        ให้ย้ายไปโรงเรียนอื่นในส่วนจัดการบัญชีก่อน
      </p>
      {busy && <p role="status">กำลังดำเนินการโรงเรียน…</p>}
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
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">โรงเรียน</th>
              <th scope="col">ประเภทโรงเรียน</th>
              <th scope="col">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {[...schools]
              .sort((a, b) => a.name.localeCompare(b.name, "th"))
              .map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="admin-school-identity">
                      {s.logo && (
                        <img src={s.logo} alt="" width={40} height={40} />
                      )}
                      <span>{s.name}</span>
                    </div>
                  </td>
                  <td>{s.school_type || "ยังไม่ระบุ"}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        disabled={busy}
                        aria-haspopup="dialog"
                        onClick={() => onManage(s.id)}
                      >
                        แก้ไขข้อมูล {s.name}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          act(async () => {
                            const r = await adminRequest<{ preview: Preview }>(
                              `/api/admin-schools?schoolId=${s.id}`,
                            );
                            setPreview(r.preview);
                            setConfirmation("");
                          })
                        }
                      >
                        ตรวจสอบการลบ {s.name}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!schools.length && <p className="muted">ยังไม่มีโรงเรียน</p>}
      {preview && (
        <div className="admin-editor danger-zone">
          <h3>ตรวจสอบก่อนลบโรงเรียน</h3>
          <strong>{preview.name}</strong>
          <ul>
            {Object.entries(preview.dependencies)
              .filter(([, n]) => n > 0)
              .map(([key, n]) => (
                <li key={key}>
                  {labels[key] || key}: {n}
                </li>
              ))}
          </ul>
          {!preview.canDelete ? (
            <p role="status">
              ยังลบโรงเรียนนี้ไม่ได้ กรุณาจัดการบัญชีและข้อมูลที่เชื่อมโยงก่อน
            </p>
          ) : (
            <>
              <p>
                ไม่มีข้อมูลการแข่งขันหรือบัญชีเชื่อมอยู่ ประวัติและโลโก้เดิม{" "}
                {preview.retainedProfileFiles || 0}{" "}
                ไฟล์จะเก็บในพื้นที่ส่วนตัวสำหรับกู้คืน
              </p>
              <label>
                พิมพ์ชื่อโรงเรียนเพื่อยืนยัน
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <button
                className="danger-button"
                disabled={busy || confirmation !== preview.name}
                onClick={() =>
                  act(async () => {
                    await adminRequest("/api/admin-schools", "DELETE", {
                      schoolId: preview.schoolId,
                      confirmation,
                      fingerprint: preview.fingerprint,
                    });
                    await onChanged();
                    setPreview(null);
                    setConfirmation("");
                    setMessage("ลบโรงเรียนแล้ว");
                  })
                }
              >
                ยืนยันลบโรงเรียน
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={() => {
              setPreview(null);
              setConfirmation("");
            }}
          >
            ปิดการตรวจสอบการลบ
          </button>
        </div>
      )}
    </section>
  );
}
