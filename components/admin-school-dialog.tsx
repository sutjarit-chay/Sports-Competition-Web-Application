"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
export type SchoolEditorPage = "profile" | "roster";
export default function AdminSchoolDialog({
  school,
  page,
  busy,
  onPageChange,
  onClose,
  children,
}: {
  school: { id: string; name: string } | null;
  page: SchoolEditorPage;
  busy: boolean;
  onPageChange: (page: SchoolEditorPage) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (school && dialog && !dialog.open) dialog.showModal();
    if (!school && dialog?.open) dialog.close();
  }, [school?.id]);
  return (
    <dialog
      ref={ref}
      className="match-result-dialog admin-school-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="match-result-dialog-content">
        <div className="match-report-dialog-header">
          <h2 id={titleId}>
            {school ? `จัดการโรงเรียน: ${school.name}` : "จัดการข้อมูลโรงเรียน"}
          </h2>
          <button
            type="button"
            className="match-report-close"
            aria-label="ปิดการจัดการโรงเรียน"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {school && (
          <>
            <p className="muted">
              ผู้ดูแลระบบกำลังจัดการข้อมูลแทนโรงเรียนนี้
              ข้อมูลจะเปลี่ยนเมื่อกดบันทึกในแต่ละส่วน
            </p>
            <div
              className="admin-school-dialog-tabs"
              aria-label="ส่วนข้อมูลโรงเรียน"
            >
              <button
                type="button"
                aria-pressed={page === "profile"}
                disabled={busy}
                onClick={() => onPageChange("profile")}
              >
                ข้อมูลโรงเรียนและโลโก้
              </button>
              <button
                type="button"
                aria-pressed={page === "roster"}
                disabled={busy}
                onClick={() => onPageChange("roster")}
              >
                นักกีฬาและผู้ฝึกสอน
              </button>
            </div>
            {busy && <p role="status">กำลังบันทึกข้อมูล กรุณารอสักครู่…</p>}
            {children}
          </>
        )}
      </div>
    </dialog>
  );
}
