"use client";

import { useEffect, useState, type FormEvent } from "react";
import Papa from "papaparse";
import { Download, School as SchoolIcon } from "lucide-react";
import type { Athlete, State } from "@/lib/domain";
import {
  compatibleRules,
  defaultPolicy,
  eventNames,
  rosterLabel,
  type RegistrationPolicy,
} from "@/lib/registration";
import { RosterRegistrationPanel } from "@/components/registration-panel";
type SchoolProfile = {
  shortName: string;
  schoolType: string;
  logo: string;
  contactName: string;
  contactPhone: string;
  address: string;
};
const emptyProfile: SchoolProfile = {
  shortName: "",
  schoolType: "",
  logo: "",
  contactName: "",
  contactPhone: "",
  address: "",
};

type Competition = {
  id: string;
  name: string;
  sport: string;
  age_group: string;
  gender: string;
  registration_policy?: RegistrationPolicy | null;
};

type School = State["schools"][number];
type Staff = {
  id: string;
  school_id: string;
  competition_id: string;
  name: string;
  title: string;
  phone: string;
};
type SchoolPortalPage = "profile" | "roster";

function csvDownload(filename: string, rows: Record<string, string>[]) {
  const blob = new Blob(["\uFEFF" + Papa.unparse(rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readLogo(file: File) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return Promise.reject(Error("เลือกไฟล์ PNG, JPG หรือ WEBP"));
  if (file.size > 3_000_000)
    return Promise.reject(Error("ขนาดโลโก้ต้องไม่เกิน 3 MB"));

  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(Error("ไฟล์โลโก้ไม่มีขนาดภาพที่ถูกต้อง"));
        return;
      }
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(Error("อ่านไฟล์โลโก้ไม่สำเร็จ"));
        return;
      }
      try {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const logo = canvas.toDataURL("image/webp", 0.82);
        if (logo.length > 1_000_000) {
          reject(Error("ไฟล์โลโก้หลังปรับขนาดยังใหญ่เกินกำหนด"));
          return;
        }
        resolve(logo);
      } catch {
        reject(Error("ปรับขนาดไฟล์โลโก้ไม่สำเร็จ"));
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Error("อ่านไฟล์โลโก้ไม่สำเร็จ"));
    };
    image.src = url;
  });
}

export default function SchoolPortal({
  page,
  accessToken,
  schoolId,
  schools,
  athletes,
  competitions: hostedCompetitions,
  busy,
  onSaveSchool,
  onSaved,
  onSaveAthletes,
  onImportAthletes,
  onDownloadAthleteTemplate,
  onDownloadSchoolCodes,
}: {
  page: SchoolPortalPage;
  accessToken: string;
  schoolId: string;
  schools: School[];
  athletes: Athlete[];
  competitions: Competition[];
  busy: boolean;
  onSaveSchool: (school: School) => Promise<void>;
  onSaved?: () => Promise<void>;
  onSaveAthletes: (rows: Athlete[]) => Promise<void>;
  onImportAthletes: (file: File, competitionId: string) => Promise<void>;
  onDownloadAthleteTemplate: (
    schoolId: string,
    competition: Competition,
  ) => void;
  onDownloadSchoolCodes: () => void;
}) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [extraProfile, setExtraProfile] = useState<SchoolProfile>(emptyProfile);
  const [profileVersion, setProfileVersion] = useState<string | null>(null);
  const [staffVersion, setStaffVersion] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [staffReady, setStaffReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [formError, setFormError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [editingAthleteId, setEditingAthleteId] = useState("");
  const [editingStaffId, setEditingStaffId] = useState("");
  const [staffDraft, setStaffDraft] = useState({
    name: "",
    title: "",
    phone: "",
  });
  const [ruleId, setRuleId] = useState("");
  const [profileDraft, setProfileDraft] = useState({
    name: "",
    shortName: "",
    logo: "",
    school_type: "",
    contactName: "",
    contactPhone: "",
    address: "",
  });

  async function api(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: body ? "PUT" : "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "เชื่อมต่อข้อมูลโรงเรียนไม่สำเร็จ");
    return data;
  }
  useEffect(() => {
    let active = true;
    setProfileReady(false);
    setExtraProfile(emptyProfile);
    setProfileVersion(null);
    setStorageError("");
    if (schoolId && accessToken)
      void api(`/api/school-profile?schoolId=${encodeURIComponent(schoolId)}`)
        .then((data) => {
          if (active) {
            setExtraProfile(data.profile);
            setProfileVersion(data.version);
            setProfileReady(true);
          }
        })
        .catch((error) => {
          if (active) setStorageError(error.message);
        });
    return () => {
      active = false;
    };
  }, [schoolId, accessToken]);
  useEffect(() => {
    let active = true;
    setStaffReady(false);
    setStaff([]);
    setStaffVersion(null);
    setEditingStaffId("");
    setStaffDraft({ name: "", title: "", phone: "" });
    if (schoolId && selectedCompetitionId && accessToken)
      void api(
        `/api/coaches?schoolId=${encodeURIComponent(schoolId)}&competitionId=${encodeURIComponent(selectedCompetitionId)}`,
      )
        .then((data) => {
          if (active) {
            setStaff(data.coaches);
            setStaffVersion(data.version);
            setStaffReady(true);
          }
        })
        .catch((error) => {
          if (active) setStorageError(error.message);
        });
    return () => {
      active = false;
    };
  }, [schoolId, selectedCompetitionId, accessToken]);
  const competitions = hostedCompetitions;

  useEffect(() => {
    if (!competitions.some((item) => item.id === selectedCompetitionId))
      setSelectedCompetitionId(competitions[0]?.id || "");
  }, [competitions, selectedCompetitionId]);

  const selectedSchool = schools.find((item) => item.id === schoolId);
  const selectedCompetition = competitions.find(
    (item) => item.id === selectedCompetitionId,
  );
  useEffect(() => {
    setProfileDraft({
      name: selectedSchool?.name || "",
      school_type: extraProfile.schoolType,
      ...extraProfile,
      shortName: extraProfile.shortName,
      logo: extraProfile.logo,
    });
  }, [
    selectedSchool,
    extraProfile.contactName,
    extraProfile.contactPhone,
    extraProfile.address,
    extraProfile.shortName,
    extraProfile.logo,
    extraProfile.schoolType,
  ]);

  const competitionAthletes = selectedCompetition
    ? athletes.filter(
        (athlete) =>
          athlete.school_id === schoolId &&
          athlete.competition_id === selectedCompetition.id,
      )
    : [];
  const competitionStaff = staff.filter(
    (item) =>
      item.school_id === schoolId &&
      item.competition_id === selectedCompetitionId,
  );
  const rules = selectedCompetition
    ? compatibleRules(
        selectedCompetition.sport,
        selectedCompetition.gender,
        selectedCompetition.age_group,
      )
    : [];
  const activeRuleId = rules.some((item) => item.id === ruleId)
    ? ruleId
    : rules[0]?.id || "";
  const activePolicy = activeRuleId
    ? selectedCompetition?.registration_policy?.ruleId === activeRuleId
      ? selectedCompetition.registration_policy
      : defaultPolicy(activeRuleId)
    : null;
  const activeRuleEnabled =
    selectedCompetition?.registration_policy?.ruleId === activeRuleId;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setStatusMessage("");
    if (!selectedSchool) {
      setFormError("ไม่พบบัญชีโรงเรียนที่กำลังแก้ไข");
      return;
    }
    try {
      const name = profileDraft.name.trim();
      if (!name) throw Error("กรอกชื่อโรงเรียน");
      if (!profileReady) throw Error("กรุณารอโหลดข้อมูลโรงเรียนก่อนบันทึก");
      setSaving(true);
      let nameSaved = false;
      try {
        if (name !== selectedSchool.name) {
          await onSaveSchool({ ...selectedSchool, name });
          nameSaved = true;
        }
        const data = await api("/api/school-profile", {
          schoolId,
          expectedVersion: profileVersion,
          profile: {
            shortName: profileDraft.shortName.trim(),
            schoolType: profileDraft.school_type,
            logo: profileDraft.logo,
            contactName: profileDraft.contactName.trim(),
            contactPhone: profileDraft.contactPhone.trim(),
            address: profileDraft.address.trim(),
          },
        });
        setExtraProfile(data.profile);
        setProfileVersion(data.version);
      } catch (error) {
        if (nameSaved)
          throw Error(
            `บันทึกชื่อโรงเรียนแล้ว แต่ข้อมูลเพิ่มเติมไม่สำเร็จ: ${error instanceof Error ? error.message : "กรุณาลองใหม่"}`,
          );
        throw error;
      } finally {
        setSaving(false);
      }
      if (onSaved) {
        try {
          await onSaved();
        } catch {
          throw Error(
            "บันทึกข้อมูลโรงเรียนแล้ว แต่โหลดข้อมูลแสดงผลใหม่ไม่สำเร็จ กรุณาโหลดหน้าอีกครั้ง",
          );
        }
      }
      setStatusMessage("บันทึกข้อมูลโรงเรียนแล้ว");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "บันทึกข้อมูลโรงเรียนไม่สำเร็จ",
      );
    }
  }

  async function saveAthleteEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = competitionAthletes.find(
      (athlete) => athlete.id === editingAthleteId,
    );
    if (!current) return;
    const name = String(form.get("athlete-name") || "").trim();
    const bib = String(form.get("athlete-bib") || "").trim();
    if (!name) {
      setFormError("กรอกชื่อนักกีฬา");
      return;
    }
    setFormError("");
    try {
      await onSaveAthletes([
        {
          ...current,
          name,
          bib: bib || undefined,
          competition_id: selectedCompetitionId,
        },
      ]);
      setEditingAthleteId("");
      setStatusMessage("แก้ไขข้อมูลนักกีฬาแล้ว");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "แก้ไขข้อมูลนักกีฬาไม่สำเร็จ",
      );
    }
  }

  async function submitRegistration(rows: Athlete[]) {
    if (rows.length) await onSaveAthletes(rows);
    setStatusMessage("ลงทะเบียนนักกีฬาแล้ว");
  }
  async function saveCoach() {
    setFormError("");
    setStatusMessage("");
    try {
      if (!staffReady || !selectedCompetition)
        throw Error("กรุณารอโหลดผู้ฝึกสอนก่อนบันทึก");
      const name = staffDraft.name.trim(),
        title = staffDraft.title.trim(),
        phone = staffDraft.phone.trim();
      if (!name || !title)
        throw Error("กรอกชื่อและหน้าที่ของครู/ผู้ฝึกสอนให้ครบ");
      setSaving(true);
      const next = editingStaffId
        ? staff.map((item) =>
            item.id === editingStaffId ? { ...item, name, title, phone } : item,
          )
        : [
            ...staff,
            {
              id: crypto.randomUUID(),
              school_id: schoolId,
              competition_id: selectedCompetitionId,
              name,
              title,
              phone,
            },
          ];
      const data = await api("/api/coaches", {
        schoolId,
        competitionId: selectedCompetitionId,
        expectedVersion: staffVersion,
        coaches: next,
      });
      setStaff(data.coaches);
      setStaffVersion(data.version);
      setEditingStaffId("");
      setStaffDraft({ name: "", title: "", phone: "" });
      setStatusMessage("บันทึกครู/ผู้ฝึกสอนแล้ว");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "บันทึกผู้ฝึกสอนไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  function downloadAthletes() {
    csvDownload(
      `${selectedCompetition?.name || "competition"}-athletes.csv`,
      competitionAthletes.map((athlete) => ({
        competition: selectedCompetition?.name || "",
        name: athlete.name,
        school: selectedSchool?.name || "",
        sport: athlete.sport,
        division: athlete.division,
        gender: athlete.gender,
        bib: athlete.bib || "",
        roster: athlete.roster ? rosterLabel(athlete) : "ยังไม่ระบุ",
        events: athlete.roster ? eventNames(athlete.roster.events) : "",
      })),
    );
    setStatusMessage("ดาวน์โหลดรายชื่อนักกีฬาแล้ว");
  }

  function downloadStaff() {
    csvDownload(
      `${selectedCompetition?.name || "competition"}-coaches.csv`,
      competitionStaff.map((item) => ({
        competition: selectedCompetition?.name || "",
        school: selectedSchool?.name || "",
        name: item.name,
        role: item.title,
        phone: item.phone,
      })),
    );
    setStatusMessage("ดาวน์โหลดรายชื่อผู้ฝึกสอนแล้ว");
  }

  if (!schoolId || !selectedSchool) {
    return (
      <section className="panel school-portal-empty">
        <SchoolIcon aria-hidden="true" />
        <h2>บัญชียังไม่ผูกโรงเรียน</h2>
        <p className="muted">
          กรุณาติดต่อผู้ดูแลระบบให้ผูกบัญชีกับโรงเรียนก่อนใช้งาน
        </p>
      </section>
    );
  }

  return (
    <div className="school-portal">
      {storageError && (
        <p className="feedback feedback-error" role="alert">
          {storageError}
        </p>
      )}
      {statusMessage && (
        <p className="feedback feedback-success" role="status">
          {statusMessage}
        </p>
      )}
      {formError && (
        <p className="feedback feedback-error" role="alert">
          {formError}
        </p>
      )}
      <section className="school-portal-heading panel">
        <div>
          <div className="school-portal-title">
            <div className="school-portal-logo" aria-hidden="true">
              {profileDraft.logo ? (
                <img src={profileDraft.logo} alt="" />
              ) : (
                <SchoolIcon />
              )}
            </div>
            <div>
              <p className="eyebrow">
                {page === "profile" ? "SCHOOL PROFILE" : "SCHOOL ROSTER"}
              </p>
              <h2>{selectedSchool.name}</h2>
              {profileDraft.shortName && (
                <p className="school-portal-short-name">
                  ชื่อย่อ: {profileDraft.shortName}
                </p>
              )}
              <p className="muted">
                {selectedCompetition
                  ? `${selectedCompetition.name} · ${selectedCompetition.age_group} · ${selectedCompetition.gender}`
                  : "ยังไม่มีรายการแข่งขันให้เลือก"}
              </p>
            </div>
          </div>
        </div>
        {page === "roster" && (
          <label>
            รายการแข่งขัน
            <select
              aria-label="รายการแข่งขันของโรงเรียน"
              value={selectedCompetitionId}
              onChange={(event) => {
                setSelectedCompetitionId(event.target.value);
                setEditingStaffId("");
                setStaffDraft({ name: "", title: "", phone: "" });
              }}
              disabled={!competitions.length || busy || saving}
            >
              {!competitions.length && <option value="">ยังไม่มีรายการ</option>}
              {competitions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.sport} · {item.age_group} · {item.gender}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      {page === "profile" && (
        <section className="panel">
          <h2>ข้อมูลพื้นฐานโรงเรียน</h2>
          <form
            className="school-portal-form"
            onSubmit={(event) => void saveProfile(event)}
          >
            <label>
              ชื่อโรงเรียน
              <input
                value={profileDraft.name}
                onChange={(event) =>
                  setProfileDraft((draft) => ({
                    ...draft,
                    name: event.target.value,
                  }))
                }
                maxLength={200}
                required
              />
            </label>
            <label>
              ชื่อโรงเรียนแบบย่อ
              <input
                value={profileDraft.shortName}
                onChange={(event) =>
                  setProfileDraft((draft) => ({
                    ...draft,
                    shortName: event.target.value,
                  }))
                }
                maxLength={40}
                placeholder="เช่น บ้านโกสัมพี"
              />
              <small>ใช้แสดงแทนชื่อเต็มในตารางแข่งขัน</small>
            </label>
            <div className="school-portal-logo-field">
              <div className="school-portal-logo school-portal-logo-large">
                {profileDraft.logo ? (
                  <img src={profileDraft.logo} alt="ตัวอย่างโลโก้โรงเรียน" />
                ) : (
                  <SchoolIcon aria-hidden="true" />
                )}
              </div>
              <label>
                โลโก้โรงเรียน
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="เลือกโลโก้โรงเรียน"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setFormError("");
                    void readLogo(file)
                      .then((logo) =>
                        setProfileDraft((draft) => ({ ...draft, logo })),
                      )
                      .catch((error: unknown) =>
                        setFormError(
                          error instanceof Error
                            ? error.message
                            : "อ่านไฟล์โลโก้ไม่สำเร็จ",
                        ),
                      );
                  }}
                />
                <small>รองรับ PNG, JPG, WEBP ไม่เกิน 3 MB</small>
              </label>
              {profileDraft.logo && (
                <button
                  type="button"
                  onClick={() =>
                    setProfileDraft((draft) => ({ ...draft, logo: "" }))
                  }
                >
                  ลบโลโก้
                </button>
              )}
            </div>
            {profileReady && (
              <>
                <label>
                  ประเภทโรงเรียน
                  <select
                    value={profileDraft.school_type}
                    onChange={(event) =>
                      setProfileDraft((draft) => ({
                        ...draft,
                        school_type: event.target.value,
                      }))
                    }
                  >
                    <option value="">ยังไม่ระบุ</option>
                    <option value="ขนาดเล็ก">ขนาดเล็ก</option>
                    <option value="ขยายโอกาส">ขยายโอกาส</option>
                  </select>
                </label>
                <label>
                  ผู้ประสานงาน
                  <input
                    value={profileDraft.contactName}
                    onChange={(event) =>
                      setProfileDraft((draft) => ({
                        ...draft,
                        contactName: event.target.value,
                      }))
                    }
                    maxLength={120}
                  />
                </label>
                <label>
                  เบอร์โทรศัพท์
                  <input
                    value={profileDraft.contactPhone}
                    onChange={(event) =>
                      setProfileDraft((draft) => ({
                        ...draft,
                        contactPhone: event.target.value,
                      }))
                    }
                    type="tel"
                    maxLength={30}
                  />
                </label>
                <label className="school-portal-wide">
                  ที่อยู่
                  <textarea
                    value={profileDraft.address}
                    onChange={(event) =>
                      setProfileDraft((draft) => ({
                        ...draft,
                        address: event.target.value,
                      }))
                    }
                    rows={3}
                    maxLength={500}
                  />
                </label>
              </>
            )}
            <button
              type="submit"
              className="primary"
              disabled={busy || saving || !profileReady}
            >
              บันทึกข้อมูลโรงเรียน
            </button>
          </form>
        </section>
      )}

      {page === "roster" && (
        <section className="panel school-portal-roster">
          <div className="school-portal-panel-heading">
            <div>
              <p className="eyebrow">ROSTER MANAGEMENT</p>
              <h2>รายชื่อตามรายการแข่งขัน</h2>
              <p className="muted">
                เลือกรายการแข่งขันก่อน กรอกนักกีฬาและครู/ผู้ฝึกสอน
                บันทึกนักกีฬาและผู้ฝึกสอนแยกกัน
              </p>
            </div>
            <div className="school-portal-downloads">
              <button
                type="button"
                onClick={downloadAthletes}
                disabled={!selectedCompetition}
              >
                <Download aria-hidden="true" /> ดาวน์โหลดนักกีฬา
              </button>
              <button
                type="button"
                onClick={downloadStaff}
                disabled={!selectedCompetition}
              >
                <Download aria-hidden="true" /> ดาวน์โหลดผู้ฝึกสอน
              </button>
            </div>
          </div>
          <section className="school-portal-roster-section">
            <div className="school-portal-panel-heading">
              <div>
                <p className="eyebrow">ATHLETE ROSTER</p>
                <h3>นักกีฬา ({competitionAthletes.length})</h3>
              </div>
            </div>
            {selectedCompetition && activeRuleId && activePolicy ? (
              <>
                {rules.length > 1 && (
                  <label className="school-portal-rule-picker">
                    ประเภทการสมัคร
                    <select
                      value={activeRuleId}
                      onChange={(event) => setRuleId(event.target.value)}
                    >
                      {rules.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <RosterRegistrationPanel
                  key={`${schoolId}-${selectedCompetition.id}-${activeRuleId}`}
                  ruleId={activeRuleId}
                  policy={activePolicy}
                  school={schoolId}
                  schools={schools}
                  sport={selectedCompetition.sport}
                  gender={selectedCompetition.gender}
                  division={selectedCompetition.age_group}
                  competitionId={selectedCompetition.id}
                  athletes={competitionAthletes.filter(
                    (athlete) =>
                      !athlete.roster || athlete.roster.ruleId === activeRuleId,
                  )}
                  admin={false}
                  canRegister
                  busy={busy || saving}
                  enabled={activeRuleEnabled}
                  submitLabel="ลงทะเบียน"
                  onRuleChange={setRuleId}
                  onSubmit={submitRegistration}
                  onConfigure={async () => undefined}
                  onTemplate={(id) =>
                    onDownloadAthleteTemplate(id, selectedCompetition)
                  }
                  onSchoolCodes={onDownloadSchoolCodes}
                  onImport={async (file) => {
                    await onImportAthletes(file, selectedCompetition.id);
                    setStatusMessage("นำเข้ารายชื่อนักกีฬาแล้ว");
                  }}
                />
                {competitionAthletes.length > 0 && (
                  <div className="school-portal-roster-list">
                    <h3>รายชื่อนักกีฬาที่บันทึกแล้ว</h3>
                    {competitionAthletes.map((athlete) => (
                      <article key={athlete.id}>
                        {editingAthleteId === athlete.id ? (
                          <form
                            className="school-portal-inline-form"
                            onSubmit={(event) => void saveAthleteEdit(event)}
                          >
                            <label>
                              ชื่อ–นามสกุล
                              <input
                                name="athlete-name"
                                defaultValue={athlete.name}
                                maxLength={120}
                                required
                              />
                            </label>
                            <label>
                              เลขประจำตัว (bib)
                              <input
                                name="athlete-bib"
                                defaultValue={athlete.bib || ""}
                                maxLength={100}
                              />
                            </label>
                            <button
                              type="submit"
                              className="primary"
                              disabled={busy || saving}
                            >
                              บันทึก
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingAthleteId("")}
                            >
                              ยกเลิก
                            </button>
                          </form>
                        ) : (
                          <>
                            <div>
                              <strong>{athlete.name}</strong>
                              <small>
                                {athlete.roster
                                  ? rosterLabel(athlete)
                                  : "ข้อมูลเดิม · ยังไม่ระบุตัวจริง/สำรอง"}
                                {athlete.bib ? ` · bib ${athlete.bib}` : ""}
                              </small>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditingAthleteId(athlete.id)}
                              disabled={busy || saving}
                            >
                              แก้ไข
                            </button>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="notice">
                {selectedCompetition
                  ? "รายการนี้ยังไม่มีประเภทสมัครนักกีฬาที่ตรงกับกีฬา รุ่น และเพศ"
                  : "กรุณาเลือกรายการแข่งขันก่อนลงทะเบียน"}
              </p>
            )}
          </section>
          <section className="school-portal-roster-section">
            <div className="school-portal-panel-heading">
              <div>
                <p className="eyebrow">COACH & STAFF</p>
                <h3>ครู/ผู้ฝึกสอน ({competitionStaff.length})</h3>
              </div>
            </div>
            <section className="school-portal-registration-staff">
              <div>
                <p className="eyebrow">COACH & STAFF</p>
                <h3>
                  {editingStaffId ? "แก้ไขครู/ผู้ฝึกสอน" : "ครู/ผู้ฝึกสอน"}
                </h3>
                <p className="muted">
                  บันทึกผู้ฝึกสอนแยกจากการลงทะเบียนนักกีฬา
                </p>
              </div>
              <div className="school-portal-form">
                <label>
                  ชื่อ–นามสกุลครู/ผู้ฝึกสอน
                  <input
                    name="staff-name"
                    value={staffDraft.name}
                    onChange={(event) =>
                      setStaffDraft((draft) => ({
                        ...draft,
                        name: event.target.value,
                      }))
                    }
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>
                <label>
                  หน้าที่
                  <select
                    name="staff-title"
                    value={staffDraft.title}
                    onChange={(event) =>
                      setStaffDraft((draft) => ({
                        ...draft,
                        title: event.target.value,
                      }))
                    }
                  >
                    <option value="">เลือกหน้าที่</option>
                    <option>ครูผู้ฝึกสอน</option>
                    <option>ผู้ช่วยผู้ฝึกสอน</option>
                    <option>ผู้จัดการทีม</option>
                    <option>ผู้ประสานงาน</option>
                  </select>
                </label>
                <label>
                  เบอร์โทรศัพท์
                  <input
                    name="staff-phone"
                    type="tel"
                    value={staffDraft.phone}
                    onChange={(event) =>
                      setStaffDraft((draft) => ({
                        ...draft,
                        phone: event.target.value,
                      }))
                    }
                    maxLength={30}
                    autoComplete="tel"
                  />
                </label>
                {editingStaffId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStaffId("");
                      setStaffDraft({
                        name: "",
                        title: "",
                        phone: "",
                      });
                    }}
                  >
                    ยกเลิกแก้ไขครู/ผู้ฝึกสอน
                  </button>
                )}
              </div>
            </section>
            <button
              type="button"
              className="primary"
              disabled={busy || saving || !staffReady}
              onClick={() => void saveCoach()}
            >
              บันทึกครู/ผู้ฝึกสอน
            </button>
            <div className="school-portal-roster-list">
              {competitionStaff.map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.title}
                      {item.phone ? ` · ${item.phone}` : ""}
                    </small>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStaffId(item.id);
                        setStaffDraft({
                          name: item.name,
                          title: item.title,
                          phone: item.phone,
                        });
                      }}
                    >
                      แก้ไข
                    </button>
                  </div>
                </article>
              ))}
              {!competitionStaff.length && (
                <p className="muted">ยังไม่มีครู/ผู้ฝึกสอนในรายการนี้</p>
              )}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
