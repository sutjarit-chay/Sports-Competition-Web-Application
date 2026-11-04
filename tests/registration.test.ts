import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RULES,
  defaultPolicy,
  validateRoster,
  prepareRoster,
  normalizeLevel,
} from "../lib/registration";
import { parseAthletes, type Athlete } from "../lib/domain";

const athlete = (
  id: string,
  ruleId = "football-male",
  position = "starter",
  events: string[] = [],
): Athlete => ({
  id,
  name: `นักกีฬา ${id}`,
  school_id: "s1",
  sport: RULES.find((r) => r.id === ruleId)!.sport,
  gender: "ชาย",
  division: "ประถม",
  competition_id: "c1",
  roster: { ruleId, position: position as "starter", events },
});
test("all fixed team types enforce their own starter/reserve and total caps", () => {
  for (const [id, starters, reserves] of [
    ["football-male", 7, 3],
    ["volleyball-male", 6, 6],
    ["volleyball-female", 6, 6],
    ["takraw-male", 3, 2],
    ["takraw-female", 3, 2],
    ["petanque-male", 3, 0],
    ["petanque-female", 3, 0],
    ["athletics-relay", 4, 4],
  ] as const) {
    const p = defaultPolicy(id);
    const rows = Array.from({ length: starters + reserves }, (_, i) =>
      athlete(String(i), id, i < starters ? "starter" : "reserve"),
    );
    const rule = RULES.find((r) => r.id === id)!;
    rows.forEach((a) => {
      a.gender = rule.genders[0] || "ชาย";
      if (id === "athletics-relay") a.roster!.events = ["relay"];
    });
    assert.doesNotThrow(() => validateRoster([], rows, p));
    assert.throws(
      () =>
        validateRoster(
          rows,
          [{ ...rows[0], id: "overflow", name: "เกินจำนวน" }],
          p,
        ),
      /จำนวน|เกิน/,
    );
    if (reserves)
      assert.throws(
        () =>
          validateRoster(
            [],
            rows.map((a) => ({
              ...a,
              roster: { ...a.roster!, position: "starter" },
            })),
            p,
          ),
        /ตัวจริง/,
      );
  }
});
test("organizer reserves are unknown until configured, never silently zero or unlimited", () => {
  for (const id of ["chairball-female", "throwball-mixed"]) {
    const p = defaultPolicy(id),
      a = athlete("a", id, "reserve");
    a.gender = id === "chairball-female" ? "หญิง" : "ผสม";
    a.division = id === "throwball-mixed" ? "อนุบาล" : "ประถม";
    assert.throws(() => validateRoster([], [a], p), /ผู้ดูแล|กำหนด/);
    assert.doesNotThrow(() => validateRoster([], [a], { ...p, reserves: 2 }));
    assert.throws(
      () => validateRoster([], [a], { ...p, reserves: -1 }),
      /จำนวน|ถูกต้อง/,
    );
  }
});
test("legacy rows remain unclassified but consume capacity and limits are isolated by school/competition", () => {
  const old = Array.from({ length: 10 }, (_, i) => {
    const a = athlete(String(i));
    delete a.roster;
    return a;
  });
  assert.throws(
    () => validateRoster(old, [athlete("new")], defaultPolicy("football-male")),
    /เกิน|เต็ม/,
  );
  assert.doesNotThrow(() =>
    validateRoster(
      old,
      [{ ...athlete("other"), school_id: "s2" }],
      defaultPolicy("football-male"),
    ),
  );
  assert.doesNotThrow(() =>
    validateRoster(
      old,
      [{ ...athlete("other"), competition_id: "c2" }],
      defaultPolicy("football-male"),
    ),
  );
  assert.ok(old.every((a) => !a.roster));
});
test("individual athletics supports multiple events, per-event quotas and per-person limits", () => {
  const p = {
    ...defaultPolicy("athletics-individual"),
    eventQuotas: { run60: 1, run80: 2 },
    maxEventsPerAthlete: 2,
  };
  const a = athlete("a", "athletics-individual", "individual", [
    "run60",
    "run80",
  ]);
  assert.doesNotThrow(() => validateRoster([], [a], p));
  assert.throws(
    () => validateRoster([a], [{ ...a, id: "b", name: "คนที่สอง" }], p),
    /60|โควตา/,
  );
  assert.throws(
    () => validateRoster([], [a], { ...p, maxEventsPerAthlete: 1 }),
    /รายการ/,
  );
  assert.throws(
    () =>
      validateRoster(
        [],
        [{ ...a, roster: { ...a.roster!, events: ["run200"] } }],
        p,
      ),
    /โควตา|ผู้ดูแล/,
  );
  assert.throws(
    () =>
      validateRoster(
        [],
        [{ ...a, roster: { ...a.roster!, events: ["unknown"] } }],
        p,
      ),
    /รายการ/,
  );
});
test("a full batch is checked before assignment, including CSV missing roles and duplicate names", () => {
  const p = defaultPolicy("football-male");
  const rows = Array.from({ length: 10 }, (_, i) => {
    const a = athlete(String(i));
    delete a.roster;
    return a;
  });
  const prepared = prepareRoster([], rows, p);
  assert.equal(
    prepared.filter((a) => a.roster?.position === "starter").length,
    7,
  );
  assert.equal(
    prepared.filter((a) => a.roster?.position === "reserve").length,
    3,
  );
  assert.throws(
    () =>
      prepareRoster(
        [],
        [...rows, { ...rows[0], id: "extra", name: "อีกคน" }],
        p,
      ),
    /เกิน|เต็ม/,
  );
  assert.throws(
    () => prepareRoster([], [rows[0], { ...rows[0], id: "duplicate" }], p),
    /ซ้ำ/,
  );
});
test("level and gender rules reject the wrong category without rewriting historical data", () => {
  assert.equal(normalizeLevel("ประถม"), "ประถมศึกษา");
  assert.equal(normalizeLevel("มัธยม"), "มัธยมศึกษา");
  assert.throws(
    () =>
      validateRoster(
        [],
        [{ ...athlete("wrong"), gender: "หญิง" }],
        defaultPolicy("football-male"),
      ),
    /เพศ/,
  );
  assert.throws(
    () =>
      validateRoster(
        [],
        [{ ...athlete("wrong"), division: "อนุบาล" }],
        defaultPolicy("football-male"),
      ),
    /ระดับชั้น/,
  );
});

test("CSV with explicit category and omitted positions fills remaining starter and reserve slots", () => {
  const csv =
    "name,school_id,sport,gender,division,rule_id\n" +
    Array.from(
      { length: 10 },
      (_, i) => `คน${i},s1,ฟุตบอล,ชาย,ประถม,football-male`,
    ).join("\n");
  const parsed = parseAthletes(csv, [{ id: "s1", name: "โรงเรียน" }]);
  const rows = prepareRoster([], parsed, defaultPolicy("football-male"));
  assert.equal(rows.filter((a) => a.roster?.position === "starter").length, 7);
  assert.equal(rows.filter((a) => a.roster?.position === "reserve").length, 3);
});
