"use client";
import { useEffect, useState } from "react";
import { adminRequest } from "@/lib/admin-api";
type Account = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  schoolId: string | null;
};
type School = { id: string; name: string };
export default function AdminAccountManager({
  schools,
  onChanged,
}: {
  schools: School[];
  onChanged: () => Promise<void>;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [schoolId, setSchoolId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const selected = accounts.find((a) => a.id === selectedId);
  async function load() {
    const r = await adminRequest<{ accounts: Account[] }>(
      "/api/admin-accounts",
    );
    setAccounts(r.accounts);
  }
  useEffect(() => {
    setBusy(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => {
    setUsername(selected?.username || "");
    setSchoolId(selected?.schoolId || "");
    setPassword("");
    setShowPassword(false);
  }, [selected]);
  async function mutate(body: unknown, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRequest("/api/admin-accounts", "PATCH", body);
      setPassword("");
      setShowPassword(false);
      await load();
      await onChanged();
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "แก้ไขบัญชีไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  function generate() {
    const alphabet =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#";
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    setPassword([...bytes].map((n) => alphabet[n % alphabet.length]).join(""));
    setShowPassword(true);
  }
  return (
    <section className="panel admin-maintenance">
      <h2>จัดการบัญชีโรงเรียนและกรรมการ</h2>
      <p className="muted">
        ดูรหัสผ่านเดิมไม่ได้ ผู้ดูแลสามารถตั้งรหัสผ่านใหม่และแจ้งเจ้าของบัญชีได้
        ชื่อบัญชีที่เคยใช้จะสงวนไว้เพื่อป้องกันการสวมชื่อ
      </p>
      {busy && <p role="status">กำลังดำเนินการบัญชี…</p>}
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
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          load()
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        โหลดบัญชีใหม่
      </button>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อบัญชี</th>
              <th>ชื่อผู้ใช้</th>
              <th>สิทธิ์</th>
              <th>โรงเรียน</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.username || "ยังไม่มีชื่อบัญชี"}</td>
                <td>{a.displayName || "—"}</td>
                <td>
                  {["school", "school_admin"].includes(a.role)
                    ? "โรงเรียน"
                    : "กรรมการ"}
                </td>
                <td>{schools.find((s) => s.id === a.schoolId)?.name || "—"}</td>
                <td>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setSelectedId(a.id);
                      setMessage("");
                      setError("");
                    }}
                  >
                    จัดการบัญชี {a.username}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!busy && !accounts.length && (
        <p className="muted">
          ยังไม่มีบัญชีโรงเรียนหรือกรรมการที่ได้รับอนุมัติ
        </p>
      )}
      {selected && (
        <div className="admin-editor">
          <h3>แก้ไขบัญชี {selected.username}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                { action: "username", userId: selected.id, username },
                "บันทึกชื่อบัญชีแล้ว",
              );
            }}
          >
            <label>
              ชื่อบัญชีใหม่
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={32}
                required
                autoComplete="off"
              />
            </label>
            <button disabled={busy || username === selected.username}>
              บันทึกชื่อบัญชี
            </button>
          </form>
          {["school", "school_admin"].includes(selected.role) && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(
                  {
                    action: "school",
                    userId: selected.id,
                    schoolId,
                    expectedSchoolId: selected.schoolId,
                  },
                  "ย้ายบัญชีไปโรงเรียนที่เลือกแล้ว",
                );
              }}
            >
              <label>
                โรงเรียนของบัญชี
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  required
                >
                  <option value="">เลือกโรงเรียน</option>
                  {schools.map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <button disabled={busy || schoolId === selected.schoolId}>
                บันทึกโรงเรียนของบัญชี
              </button>
            </form>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(
                { action: "password", userId: selected.id, password },
                "ตั้งรหัสผ่านใหม่แล้ว โปรดแจ้งเจ้าของบัญชี",
              );
            }}
          >
            <label>
              รหัสผ่านใหม่
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <div className="admin-actions">
              <button
                type="button"
                disabled={busy}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "ซ่อนรหัสผ่านใหม่" : "แสดงรหัสผ่านใหม่"}
              </button>
              <button type="button" disabled={busy} onClick={generate}>
                สร้างรหัสผ่านใหม่
              </button>
              <button
                className="primary"
                disabled={busy || password.length < 10}
              >
                ตั้งรหัสผ่านใหม่
              </button>
            </div>
          </form>
          <button
            disabled={busy}
            onClick={() => {
              setSelectedId("");
              setPassword("");
              setShowPassword(false);
            }}
          >
            ปิดการแก้ไขบัญชี
          </button>
        </div>
      )}
    </section>
  );
}
