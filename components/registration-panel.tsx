"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Athlete } from "@/lib/domain";
import {
  RULES,
  ATHLETICS_EVENTS,
  REGISTRATION_NOTICE,
  defaultPolicy,
  getRule,
  policyLimits,
  rosterLabel,
  eventNames,
  type RegistrationPolicy,
} from "@/lib/registration";

export function RegistrationRulesTable({
  policies,
}: {
  policies: Record<string, RegistrationPolicy>;
}) {
  return (
    <section className="panel registration-catalog">
      <h2>รายการแข่งขันและการสมัครนักกีฬา</h2>
      <p className="muted">
        โรงเรียนบ้านไร่ลำปาง · จำนวนต่อโรงเรียน แยกตามรายการแข่งขัน เพศ
        และระดับชั้น
      </p>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="ตารางประเภทการแข่งขันและจำนวนผู้สมัคร"
      >
        <table>
          <thead>
            <tr>
              {[
                "ประเภทการแข่งขัน",
                "เพศ",
                "ระดับชั้น",
                "จำนวนตัวจริง",
                "จำนวนตัวสำรอง",
                "จำนวนรวมสูงสุด",
                "หมายเหตุ",
              ].map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RULES.map((rule) => {
              const p = policies[rule.id] || defaultPolicy(rule.id),
                limits = policyLimits(p);
              return (
                <tr key={rule.id}>
                  <td>{rule.name}</td>
                  <td>{rule.genders.join(" / ") || "ตามรายการแข่งขัน"}</td>
                  <td>{rule.levels.join(" / ") || "ตามรายการแข่งขัน"}</td>
                  <td className="numeric">
                    {rule.starters ?? "ตามโควตาผู้จัด"}
                  </td>
                  <td className="numeric">
                    {limits.reserves ?? "ตามระเบียบผู้จัด"}
                  </td>
                  <td className="numeric points-total">
                    {limits.maximum ?? "ผู้ดูแลกำหนด"}
                  </td>
                  <td className="catalog-note">{rule.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="registration-notice">{REGISTRATION_NOTICE}</p>
    </section>
  );
}

type Props = {
  ruleId: string;
  policy: RegistrationPolicy;
  school: string;
  schools: { id: string; name: string }[];
  sport: string;
  gender: string;
  division: string;
  competitionId?: string;
  athletes: Athlete[];
  admin: boolean;
  canRegister: boolean;
  busy: boolean;
  enabled: boolean;
  onRuleChange: (id: string) => void;
  onSubmit: (rows: Athlete[], formData: FormData) => Promise<void>;
  onConfigure: (policy: RegistrationPolicy) => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onTemplate: (school: string) => void;
  onSchoolCodes: () => void;
  submitLabel?: string;
  registrationFields?: ReactNode;
  canSubmitWithoutAthletes?: (formData: FormData) => boolean;
};

export function RosterRegistrationPanel(props: Props) {
  const { ruleId, policy, admin, canRegister, busy, enabled } = props;
  const rule = getRule(ruleId),
    limits = policyLimits(policy);
  const [error, setError] = useState("");
  const [selectedSchool, setSelectedSchool] = useState(props.school);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const school = admin ? selectedSchool : props.school;
  const existing = props.athletes.filter((a) => a.school_id === school);
  const unknown = existing.filter((a) => !a.roster).length;
  const individual = rule.id === "athletics-individual";
  const configured =
    enabled &&
    (individual
      ? Object.values(policy.eventQuotas).some((quota) => quota > 0)
      : limits.reserves !== null);
  const groups = individual
    ? [
        {
          position: "individual" as const,
          count: 1,
          title: "นักกีฬาประเภทเดี่ยว",
        },
      ]
    : [
        {
          position: "starter" as const,
          count: limits.starters!,
          title:
            rule.id === "athletics-relay"
              ? "นักกีฬาตัวจริง · ผู้แข่งขัน 4 คน"
              : "นักกีฬาตัวจริง",
        },
        ...(limits.reserves
          ? [
              {
                position: "reserve" as const,
                count: limits.reserves,
                title: "นักกีฬาสำรอง",
              },
            ]
          : []),
      ];
  let index = -1;
  return (
    <section className="panel roster-panel">
      <h2>ลงทะเบียนนักกีฬา</h2>

      <div className="roster-rule-summary">
        <strong>{rule.name}</strong>
        <span>
          {props.division} · {props.gender}
        </span>
        <span>
          ลงทะเบียนแล้ว {existing.length} คน
          {limits.maximum !== null ? ` / สูงสุด ${limits.maximum} คน` : ""}
        </span>
      </div>
      <p className="muted">{rule.note}</p>
      {unknown > 0 && (
        <p className="notice">
          มีข้อมูลเดิม {unknown} คนที่ยังไม่ระบุตัวจริง/สำรอง
          รายชื่อยังคงอยู่และนับรวมในเพดาน กรุณาตรวจทานกับผู้จัด
        </p>
      )}
      {!configured && (
        <p className="notice">
          {!enabled
            ? "ผู้ดูแลต้องบันทึกกติกาสำหรับรายการแข่งขันนี้ก่อนเปิดรับสมัคร"
            : individual
              ? "รายการกรีฑาเดี่ยวยังไม่มีโควตาที่เปิดรับสมัคร กรุณาให้ผู้ดูแลตั้งค่าโควตาก่อน"
              : "ผู้ดูแลยังไม่ได้กำหนดจำนวนสำรองตามระเบียบผู้จัด กรุณาตั้งค่าก่อนสมัคร"}
        </p>
      )}
      {canRegister ? (
        <form
          aria-label="แบบฟอร์มรายชื่อนักกีฬา"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              data = new FormData(form);
            setError("");
            try {
              const rows: Athlete[] = [];
              let i = -1;
              for (const group of groups)
                for (let j = 0; j < group.count; j++) {
                  i++;
                  const name = String(
                    data.get(i === 0 ? "name" : `name_${i}`) || "",
                  ).trim();
                  if (!name) continue;
                  rows.push({
                    id: crypto.randomUUID(),
                    name,
                    school_id: school,
                    sport: props.sport,
                    gender: props.gender,
                    division: props.division,
                    competition_id: props.competitionId,
                    bib:
                      String(
                        data.get(i === 0 ? "bib" : `bib_${i}`) || "",
                      ).trim() || undefined,
                    roster: {
                      ruleId,
                      position: group.position,
                      events: individual
                        ? data.getAll("selected_events").map(String)
                        : rule.id === "athletics-relay"
                          ? ["relay"]
                          : [],
                    },
                  });
                }
              const hasSupplementalData =
                props.canSubmitWithoutAthletes?.(data) || false;
              if (rows.length && !configured)
                throw Error("กรุณาให้ผู้ดูแลตั้งค่าโควตาให้ครบก่อนสมัคร");
              if (
                rows.length &&
                (!school || !props.schools.some((s) => s.id === school))
              )
                throw Error("บัญชีนี้ยังไม่ผูกโรงเรียน กรุณาติดต่อผู้ดูแล");
              if (!rows.length && !hasSupplementalData)
                throw Error("กรอกชื่อนักกีฬาอย่างน้อย 1 คน");
              await props.onSubmit(rows, data);
              form.reset();
              setSelectedEvents([]);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "บันทึกรายชื่อไม่สำเร็จ",
              );
            }
          }}
        >
          {admin && (
            <label>
              โรงเรียน
              <select
                name="school_id"
                value={school}
                disabled={busy}
                onChange={(e) => setSelectedSchool(e.target.value)}
              >
                {props.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {individual && configured && (
            <fieldset className="athletics-choices">
              <legend>เลือกรายการแข่งขันกรีฑาก่อนกรอกชื่อนักกีฬา</legend>
              {ATHLETICS_EVENTS.filter(
                (event) =>
                  event.id !== "relay" &&
                  (policy.eventQuotas[event.id] || 0) > 0,
              ).map((event) => {
                const checked = selectedEvents.includes(event.id);
                const atLimit =
                  policy.maxEventsPerAthlete !== null &&
                  selectedEvents.length >= policy.maxEventsPerAthlete;
                return (
                  <label className="check" key={event.id}>
                    <input
                      type="checkbox"
                      name="selected_events"
                      value={event.id}
                      checked={checked}
                      disabled={busy || (!checked && atLimit)}
                      onChange={(change) =>
                        setSelectedEvents((current) =>
                          change.target.checked
                            ? [...current, event.id]
                            : current.filter((id) => id !== event.id),
                        )
                      }
                    />
                    {event.name}
                    <small>โควตา {policy.eventQuotas[event.id]} คน</small>
                  </label>
                );
              })}
            </fieldset>
          )}
          {groups.map((group) => (
            <fieldset key={group.position} className="roster-group">
              <legend>
                {group.title}
                {!individual ? ` (${group.count} ช่อง)` : ""}
              </legend>
              <div className="roster-slots">
                {Array.from({ length: group.count }, (_, n) => {
                  const i = ++index;
                  return (
                    <div className="roster-slot" key={i}>
                      <span className="roster-slot-number">{n + 1}</span>
                      <label>
                        {i === 0
                          ? "ชื่อ–นามสกุล"
                          : `${group.title} คนที่ ${n + 1}`}
                        <input
                          name={i === 0 ? "name" : `name_${i}`}
                          maxLength={120}
                          disabled={busy || !configured}
                          autoComplete="off"
                        />
                      </label>
                      <label>
                        {i === 0 ? "เลขประจำตัว (bib)" : `bib คนที่ ${i + 1}`}
                        <input
                          name={i === 0 ? "bib" : `bib_${i}`}
                          maxLength={100}
                          placeholder="เว้นว่างเพื่อใช้รหัสอัตโนมัติ"
                          disabled={busy || !configured}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          {props.registrationFields}
          <p className="registration-notice">{REGISTRATION_NOTICE}</p>
          {error && (
            <p role="alert" className="roster-error">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={busy || (!configured && !props.registrationFields)}
          >
            {props.submitLabel || "+ เพิ่มนักกีฬา"}
          </button>
        </form>
      ) : (
        <p>บัญชีนี้ไม่มีสิทธิ์ลงทะเบียน</p>
      )}
      {canRegister && (
        <div className="import">
          <label>
            นำเข้า CSV
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy || !configured}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) await props.onImport(file);
              }}
            />
          </label>
          <button type="button" onClick={() => props.onTemplate(school)}>
            ดาวน์โหลดแบบฟอร์ม CSV
          </button>
          <button type="button" onClick={props.onSchoolCodes}>
            ดาวน์โหลดรหัสโรงเรียน
          </button>
          <p className="muted">
            รองรับ rule_id, position (starter/reserve/individual) และ events
            คั่นด้วย | เช่น run60|run100 การนำเข้าทั้งชุดต้องผ่านโควตาก่อนบันทึก
          </p>
        </div>
      )}
      {admin && (
        <details className="registration-settings">
          <summary>ตั้งค่าจำนวนสำรองและโควตา (ผู้ดูแลระบบ)</summary>
          <form
            key={JSON.stringify(policy)}
            aria-label="ตั้งค่ากติกาการสมัคร"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setError("");
              const next = {
                ...policy,
                eventQuotas: { ...policy.eventQuotas },
              };
              if (rule.reserves === null)
                next.reserves =
                  String(data.get("reserves")).trim() === ""
                    ? null
                    : Number(data.get("reserves"));
              if (individual) {
                next.eventQuotas = {};
                for (const event of ATHLETICS_EVENTS.filter(
                  (e) => e.id !== "relay",
                )) {
                  const value = String(data.get(event.id) || "").trim();
                  if (value !== "") next.eventQuotas[event.id] = Number(value);
                }
                next.maxEventsPerAthlete =
                  String(data.get("maxEvents") || "").trim() === ""
                    ? null
                    : Number(data.get("maxEvents"));
              }
              try {
                policyLimits(next);
                await props.onConfigure(next);
              } catch (error) {
                setError(
                  error instanceof Error ? error.message : "ตั้งค่าไม่สำเร็จ",
                );
              }
            }}
          >
            {rule.reserves === null && (
              <label>
                จำนวนสำรองตามระเบียบผู้จัด
                <input
                  type="number"
                  name="reserves"
                  min="0"
                  max="100"
                  step="1"
                  defaultValue={policy.reserves ?? ""}
                  required
                />
              </label>
            )}
            {individual && (
              <>
                {ATHLETICS_EVENTS.filter((e) => e.id !== "relay").map(
                  (event) => (
                    <label key={event.id}>
                      โควตา {event.name}
                      <input
                        name={event.id}
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        defaultValue={policy.eventQuotas[event.id] ?? ""}
                        placeholder="ยังไม่เปิดสมัคร"
                      />
                    </label>
                  ),
                )}
                <label>
                  จำนวนรายการสูงสุดต่อคน
                  <input
                    name="maxEvents"
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    defaultValue={policy.maxEventsPerAthlete ?? ""}
                    placeholder="ไม่จำกัดเพิ่มเติม"
                  />
                </label>
              </>
            )}
            {rule.reserves !== null && !individual && (
              <p className="muted">
                ตัวจริง {limits.starters} คน สำรอง {limits.reserves} คน รวม{" "}
                {limits.maximum} คน ตามกติกาที่กำหนด
              </p>
            )}
            <button disabled={busy}>บันทึกกติกาการสมัคร</button>
          </form>
        </details>
      )}
      <h3>สรุปรายชื่อนักกีฬา</h3>
      <p className="muted">
        รายชื่อเก่ายังคงแสดง โดยไม่จัดตัวจริงหรือสำรองให้เอง
      </p>
      <div
        className="table-wrap"
        tabIndex={0}
        role="region"
        aria-label="สรุปรายชื่อและสถานะการสมัคร"
      >
        <table>
          <thead>
            <tr>
              {[
                "ชื่อ–นามสกุล",
                "โรงเรียน",
                "ประเภทการแข่งขัน",
                "รุ่น / เพศ",
                "สถานะ",
                "รายการกรีฑา",
                "bib",
              ].map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.athletes.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  {props.schools.find((s) => s.id === a.school_id)?.name ||
                    a.school_id}
                </td>
                <td>{a.roster ? getRule(a.roster.ruleId).name : a.sport}</td>
                <td>
                  {a.division} / {a.gender}
                </td>
                <td>{rosterLabel(a)}</td>
                <td>
                  {a.roster?.events.length ? eventNames(a.roster.events) : "—"}
                </td>
                <td>{a.bib || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.athletes.length && (
          <p className="empty">ยังไม่มีข้อมูลในรายการนี้</p>
        )}
      </div>
    </section>
  );
}
