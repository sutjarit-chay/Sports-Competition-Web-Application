"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Papa from "papaparse";
import { Download, School as SchoolIcon } from "lucide-react";
import type { Athlete, State } from "@/lib/domain";
import type { ManagedCompetition } from "@/lib/admin-competitions";
import {
  compatibleRules,
  defaultPolicy,
  eventNames,
  rosterLabel,
  type RegistrationPolicy,
} from "@/lib/registration";
import { RosterRegistrationPanel } from "@/components/registration-panel";
import {
  SCHOOL_PROFILE_KEY,
  parseSchoolProfiles,
  type SchoolProfile,
} from "@/lib/school-profiles";

const COMPETITIONS_KEY = "kosamphi-admin-competitions-v1";
const STAFF_KEY = "kosamphi-school-staff-v1";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isManagedCompetition(value: unknown): value is ManagedCompetition {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.sport === "string" &&
    typeof value.ageGroup === "string" &&
    typeof value.gender === "string" &&
    typeof value.details === "string" &&
    Number.isInteger(value.starters) &&
    Number.isInteger(value.reserves) &&
    Number.isInteger(value.teamLimit) &&
    (value.format === "knockout" || value.format === "round_robin") &&
    Number.isInteger(value.winPoints) &&
    Number.isInteger(value.drawPoints) &&
    Number.isInteger(value.lossPoints) &&
    Array.isArray(value.teams) &&
    value.teams.every((id) => typeof id === "string") &&
    Array.isArray(value.fixtures) &&
    value.fixtures.every(
      (fixture) =>
        isRecord(fixture) &&
        typeof fixture.id === "string" &&
        typeof fixture.round === "string" &&
        typeof fixture.home === "string" &&
        typeof fixture.away === "string" &&
        typeof fixture.startsAt === "string" &&
        typeof fixture.venue === "string",
    )
  );
}

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
  demo,
  schoolId,
  schools,
  athletes,
  competitions: hostedCompetitions,
  demoPolicies,
  busy,
  onChooseSchool,
  onCreateDemoSchool,
  onSaveSchool,
  onSaveAthletes,
  onImportAthletes,
  onDownloadAthleteTemplate,
  onDownloadSchoolCodes,
}: {
  page: SchoolPortalPage;
  demo: boolean;
  schoolId: string;
  schools: School[];
  athletes: Athlete[];
  competitions: Competition[];
  demoPolicies: Record<string, RegistrationPolicy>;
  busy: boolean;
  onChooseSchool: (id: string) => void;
  onCreateDemoSchool: () => void;
  onSaveSchool: (school: School) => Promise<void>;
  onSaveAthletes: (rows: Athlete[]) => Promise<void>;
  onImportAthletes: (file: File, competitionId: string) => Promise<void>;
  onDownloadAthleteTemplate: (
    schoolId: string,
    competition: Competition,
  ) => void;
  onDownloadSchoolCodes: () => void;
}) {
  const [managedCompetitions, setManagedCompetitions] = useState<
    ManagedCompetition[]
  >([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SchoolProfile>>({});
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

  useEffect(() => {
    try {
      setProfiles(
        parseSchoolProfiles(localStorage.getItem(SCHOOL_PROFILE_KEY)),
      );
      if (!demo) {
        setManagedCompetitions([]);
        return;
      }
      const savedCompetitions = localStorage.getItem(COMPETITIONS_KEY);
      if (savedCompetitions) {
        const parsed: unknown = JSON.parse(savedCompetitions);
        if (!Array.isArray(parsed) || !parsed.every(isManagedCompetition))
          throw Error("ข้อมูลรายการแข่งขันสาธิตไม่ถูกต้อง");
        setManagedCompetitions(parsed);
      }
      const savedStaff = localStorage.getItem(STAFF_KEY);
      if (savedStaff) {
        const parsed: unknown = JSON.parse(savedStaff);
        if (
          !Array.isArray(parsed) ||
          !parsed.every(
            (item) =>
              isRecord(item) &&
              typeof item.id === "string" &&
              typeof item.school_id === "string" &&
              typeof item.competition_id === "string" &&
              typeof item.name === "string" &&
              typeof item.title === "string" &&
              typeof item.phone === "string",
          )
        )
          throw Error("ข้อมูลครู/ผู้ฝึกสอนสาธิตไม่ถูกต้อง");
        setStaff(parsed);
      }
    } catch (error) {
      setStorageError(
        error instanceof Error ? error.message : "อ่านข้อมูลสาธิตไม่สำเร็จ",
      );
    }
  }, [demo]);

  function persistStaffRows(rows: Staff[]) {
    try {
      localStorage.setItem(STAFF_KEY, JSON.stringify(rows));
      setStaff(rows);
      setStorageError("");
      return true;
    } catch {
      setStorageError("บันทึกข้อมูลสาธิตไม่สำเร็จ พื้นที่จัดเก็บอาจเต็ม");
      return false;
    }
  }

  function persistSchoolProfiles(value: Record<string, SchoolProfile>) {
    try {
      localStorage.setItem(SCHOOL_PROFILE_KEY, JSON.stringify(value));
      setProfiles(value);
      setStorageError("");
      return true;
    } catch {
      setStorageError("บันทึกข้อมูลสาธิตไม่สำเร็จ พื้นที่จัดเก็บอาจเต็ม");
      return false;
    }
  }

  const competitions = useMemo<Competition[]>(
    () =>
      demo
        ? managedCompetitions.map((item) => ({
            id: item.id,
            name: item.name,
            sport: item.sport,
            age_group: item.ageGroup,
            gender: item.gender,
          }))
        : hostedCompetitions,
    [demo, hostedCompetitions, managedCompetitions],
  );

  useEffect(() => {
    if (!competitions.some((item) => item.id === selectedCompetitionId))
      setSelectedCompetitionId(competitions[0]?.id || "");
  }, [competitions, selectedCompetitionId]);

  const selectedSchool = schools.find((item) => item.id === schoolId);
  const selectedCompetition = competitions.find(
    (item) => item.id === selectedCompetitionId,
  );
  const extraProfile = schoolId
    ? profiles[schoolId] || {
        shortName: "",
        logo: "",
        contactName: "",
        contactPhone: "",
        address: "",
      }
    : {
        shortName: "",
        logo: "",
        contactName: "",
        contactPhone: "",
        address: "",
      };

  useEffect(() => {
    setProfileDraft({
      name: selectedSchool?.name || "",
      school_type: selectedSchool?.school_type || "",
      ...extraProfile,
      shortName: selectedSchool?.short_name || extraProfile.shortName,
      logo: selectedSchool?.logo || extraProfile.logo,
    });
  }, [
    selectedSchool,
    extraProfile.contactName,
    extraProfile.contactPhone,
    extraProfile.address,
    extraProfile.shortName,
    extraProfile.logo,
  ]);

  const competitionAthletes = selectedCompetition
    ? athletes.filter(
        (athlete) =>
          athlete.school_id === schoolId &&
          (athlete.competition_id
            ? athlete.competition_id === selectedCompetition.id
            : demo &&
              athlete.sport === selectedCompetition.sport &&
              athlete.gender === selectedCompetition.gender &&
              athlete.division === selectedCompetition.age_group),
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
    ? demo
      ? demoPolicies[activeRuleId] || defaultPolicy(activeRuleId)
      : selectedCompetition?.registration_policy?.ruleId === activeRuleId
        ? selectedCompetition.registration_policy
        : defaultPolicy(activeRuleId)
    : null;
  const activeRuleEnabled =
    demo || selectedCompetition?.registration_policy?.ruleId === activeRuleId;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!selectedSchool) {
      setFormError("ไม่พบบัญชีโรงเรียนที่กำลังแก้ไข");
      return;
    }
    try {
      const name = profileDraft.name.trim();
      if (!name) throw Error("กรอกชื่อโรงเรียน");
      await onSaveSchool({
        ...selectedSchool,
        name,
        short_name: profileDraft.shortName.trim(),
        logo: profileDraft.logo,
        ...(demo && profileDraft.school_type
          ? {
              school_type: profileDraft.school_type as "ขนาดเล็ก" | "ขยายโอกาส",
            }
          : {}),
      });
      const nextProfiles = {
        ...profiles,
        [schoolId]: {
          shortName: profileDraft.shortName.trim(),
          logo: profileDraft.logo,
          contactName: demo
            ? profileDraft.contactName.trim()
            : extraProfile.contactName,
          contactPhone: demo
            ? profileDraft.contactPhone.trim()
            : extraProfile.contactPhone,
          address: demo ? profileDraft.address.trim() : extraProfile.address,
        },
      };
      if (!persistSchoolProfiles(nextProfiles))
        throw Error("บันทึกข้อมูลเพิ่มเติมของโรงเรียนไม่สำเร็จ");
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

  async function submitRegistration(rows: Athlete[], form: FormData) {
    const name = String(form.get("staff-name") || "").trim();
    const title = String(form.get("staff-title") || "").trim();
    const phone = String(form.get("staff-phone") || "").trim();
    const existing = staff.find((item) => item.id === editingStaffId);
    const hasStaffData = !!(editingStaffId || name || title || phone);
    if (editingStaffId && !existing)
      throw Error("ไม่พบข้อมูลครู/ผู้ฝึกสอนที่กำลังแก้ไข");
    if (hasStaffData && (!name || !title))
      throw Error("กรอกชื่อและหน้าที่ของครู/ผู้ฝึกสอนให้ครบ");
    if (hasStaffData && (!demo || !selectedCompetition))
      throw Error("ไม่สามารถลงทะเบียนครู/ผู้ฝึกสอนในรายการนี้ได้");

    const previousStaff = staff;
    if (hasStaffData) {
      const nextStaff = existing
        ? staff.map((item) =>
            item.id === existing.id ? { ...item, name, title, phone } : item,
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
      if (!persistStaffRows(nextStaff))
        throw Error("บันทึกข้อมูลครู/ผู้ฝึกสอนไม่สำเร็จ");
    }

    try {
      if (rows.length) await onSaveAthletes(rows);
    } catch (error) {
      if (hasStaffData && !persistStaffRows(previousStaff))
        throw Error(
          "ลงทะเบียนนักกีฬาไม่สำเร็จ และคืนค่าข้อมูลครู/ผู้ฝึกสอนไม่สำเร็จ กรุณาตรวจสอบข้อมูล",
        );
      throw error;
    }
    setEditingStaffId("");
    setStaffDraft({ name: "", title: "", phone: "" });
    setStatusMessage(
      [
        rows.length ? "ลงทะเบียนนักกีฬาแล้ว" : "",
        hasStaffData
          ? existing
            ? "บันทึกการแก้ไขครู/ผู้ฝึกสอนแล้ว"
            : "ลงทะเบียนครู/ผู้ฝึกสอนแล้ว"
          : "",
      ]
        .filter(Boolean)
        .join(" และ "),
    );
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
        <h2>
          {demo ? "เลือกโรงเรียนสำหรับโหมดสาธิต" : "บัญชียังไม่ผูกโรงเรียน"}
        </h2>
        <p className="muted">
          {demo
            ? "เลือกโรงเรียนที่มีในข้อมูลสาธิต หรือสร้างรายการตัวอย่างเพื่อทดลองหน้าของโรงเรียน"
            : "กรุณาติดต่อผู้ดูแลระบบให้ผูกบัญชีกับโรงเรียนก่อนใช้งาน"}
        </p>
        {demo && schools.length > 0 && (
          <label>
            โรงเรียน
            <select
              aria-label="เลือกโรงเรียนสำหรับโหมดสาธิต"
              value={schoolId}
              onChange={(event) => onChooseSchool(event.target.value)}
            >
              <option value="">เลือกโรงเรียน</option>
              {schools.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.short_name || item.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {demo && (
          <button
            type="button"
            className="primary"
            onClick={onCreateDemoSchool}
          >
            สร้างโรงเรียนตัวอย่างในเบราว์เซอร์
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="school-portal">
      <div className="admin-preview-notice" role="note">
        {demo
          ? "โหมดสาธิต: บันทึกข้อมูลโรงเรียนและผู้ฝึกสอนไว้ในเบราว์เซอร์นี้เท่านั้น"
          : "ข้อมูลโรงเรียนและนักกีฬาใช้สิทธิ์ตาม Supabase RLS; ส่วนผู้ฝึกสอนและข้อมูลติดต่อยังไม่เชื่อมฐานข้อมูล"}
      </div>
      {schools.length > 1 && demo && (
        <label className="school-portal-school-picker">
          โรงเรียนที่กำลังจัดการ
          <select
            value={schoolId}
            onChange={(event) => onChooseSchool(event.target.value)}
          >
            {schools.map((item) => (
              <option key={item.id} value={item.id}>
                {item.short_name || item.name}
              </option>
            ))}
          </select>
        </label>
      )}
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
              disabled={!competitions.length}
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
          {!demo && (
            <p className="notice">
              ฐานข้อมูลปัจจุบันเปิดให้แก้เฉพาะชื่อโรงเรียนตามสิทธิ์ RLS
              โลโก้และชื่อย่อจะบันทึกในเบราว์เซอร์นี้เท่านั้น
            </p>
          )}
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
                maxLength={160}
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
            {demo && (
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
            <button type="submit" className="primary" disabled={busy}>
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
                แล้วกดลงทะเบียนครั้งเดียว
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
                  busy={busy}
                  enabled={activeRuleEnabled}
                  submitLabel="ลงทะเบียน"
                  canSubmitWithoutAthletes={(form) =>
                    demo &&
                    (!!editingStaffId ||
                      !!String(form.get("staff-name") || "").trim() ||
                      !!String(form.get("staff-title") || "").trim() ||
                      !!String(form.get("staff-phone") || "").trim())
                  }
                  registrationFields={
                    demo ? (
                      <section className="school-portal-registration-staff">
                        <div>
                          <p className="eyebrow">COACH & STAFF</p>
                          <h3>
                            {editingStaffId
                              ? "แก้ไขครู/ผู้ฝึกสอน"
                              : "ครู/ผู้ฝึกสอน"}
                          </h3>
                          <p className="muted">
                            กรอกพร้อมรายชื่อนักกีฬา แล้วกดลงทะเบียนครั้งเดียว
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
                    ) : undefined
                  }
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
                              disabled={busy}
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
                              disabled={busy}
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
            {demo ? (
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
            ) : (
              <p className="notice">
                การจัดเก็บครู/ผู้ฝึกสอนยังไม่เชื่อมกับฐานข้อมูลจริง
                จึงปิดการแก้ไขในโหมด Supabase จนกว่าจะกำหนด schema และ RLS
              </p>
            )}
          </section>
        </section>
      )}
    </div>
  );
}
