import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { saveAthleticsResult } from "../lib/athletics-results";
import { POST } from "../app/api/athletics-results/route";
const school = "10000000-0000-4000-8000-000000000001",
  competition = "20000000-0000-4000-8000-000000000001",
  athlete = "30000000-0000-4000-8000-000000000001",
  event = "40000000-0000-4000-8000-000000000001",
  actor = "50000000-0000-4000-8000-000000000001",
  result = "60000000-0000-4000-8000-000000000001";
type Row = Record<string, any>;
function fixture() {
  const db: Record<string, Row[]> = {
    schools: [{ id: school, name: "โรงเรียนจริง" }],
    competitions: [
      {
        id: competition,
        name: "กรีฑา",
        sport: "กรีฑา",
        age_group: "ประถมศึกษา",
        gender: "ชาย",
        win_points: 3,
        draw_points: 1,
        loss_points: 0,
        registration_policy: null,
      },
    ],
    registrations: [
      {
        id: athlete,
        competition_id: competition,
        school_id: school,
        athlete_name: "นักกีฬา",
        bib: "101",
      },
    ],
    matches: [],
    athletics_events: [
      {
        id: event,
        competition_id: competition,
        name: "วิ่ง 100 เมตร",
        kind: "track",
        round: "heat",
        heat: 1,
        direction: "asc",
        unit: "s",
        starts_at: "2026-11-30T02:00:00Z",
        venue: "สนาม",
        referee_id: actor,
      },
    ],
    athletics_results: [],
    medals: [],
  };
  const writes: Row[] = [];
  const client = createClient(
    "https://athletics-fixture.invalid",
    "service-fixture",
    {
      auth: { persistSession: false },
      global: {
        fetch: async (input, init) => {
          const u = new URL(String(input));
          assert.equal(u.origin, "https://athletics-fixture.invalid");
          const table = u.pathname.split("/").pop()!;
          let rows = db[table] || [];
          for (const [key, value] of u.searchParams)
            if (value.startsWith("eq."))
              rows = rows.filter((r) => String(r[key]) === value.slice(3));
          if (!init?.method || init.method === "GET") {
            const offset = Number(u.searchParams.get("offset") || 0);
            return new Response(
              JSON.stringify(
                rows.slice(
                  offset,
                  offset + Number(u.searchParams.get("limit") || 500),
                ),
              ),
              { headers: { "content-type": "application/json" } },
            );
          }
          const body = JSON.parse(String(init.body));
          if (
            table === "athletics_events" &&
            init.method === "POST" &&
            !["lower", "higher"].includes(body.direction)
          )
            return new Response(
              JSON.stringify({
                code: "23514",
                message: "athletics_events_direction_check",
              }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          writes.push({ table, body });
          if (init.method === "POST") db[table].push(body);
          else rows.forEach((r) => Object.assign(r, body));
          return new Response(JSON.stringify(rows), {
            headers: { "content-type": "application/json" },
          });
        },
      },
    },
  );
  const race = {
    id: result,
    event: "วิ่ง 100 เมตร",
    stage: "heat",
    heat: 1,
    status: "OK",
    value: 12,
    athlete_id: athlete,
    competition_id: competition,
    event_id: event,
  };
  return { db, writes, client, race };
}
test("athletics result endpoint refuses anonymous requests", async () => {
  const response = await POST(
    new Request("http://localhost/api/athletics-results", {
      method: "POST",
      body: "{}",
    }),
  );
  assert.equal(response.status, 401);
});
test("school and unassigned referee cannot write athletics results", async () => {
  const f = fixture();
  await assert.rejects(
    () =>
      saveAthleticsResult(f.client, f.race, {
        id: actor,
        role: "school_admin",
      }),
    /ไม่มีสิทธิ์/,
  );
  await assert.rejects(
    () =>
      saveAthleticsResult(f.client, f.race, { id: school, role: "referee" }),
    /ไม่ได้รับมอบหมาย/,
  );
  assert.equal(f.writes.length, 0);
});
test("assigned referee saves trusted athlete and event identity through backend", async () => {
  const f = fixture();
  await saveAthleticsResult(
    f.client,
    { ...f.race, school_id: "forged", gender: "forged" },
    { id: actor, role: "referee" },
  );
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].table, "athletics_results");
  assert.equal(f.writes[0].body.school_id, school);
  assert.equal(f.writes[0].body.event_id, event);
  assert.equal(f.writes[0].body.bib, "101");
});
test("athletics result validation rejects invalid value, mismatched scope, and result ownership change", async () => {
  const f = fixture();
  await assert.rejects(
    () =>
      saveAthleticsResult(
        f.client,
        { ...f.race, value: -1 },
        { id: actor, role: "admin" },
      ),
    /มากกว่า 0/,
  );
  await assert.rejects(
    () =>
      saveAthleticsResult(
        f.client,
        { ...f.race, competition_id: school },
        { id: actor, role: "admin" },
      ),
    /ไม่พบนักกีฬา/,
  );
  f.db.athletics_results.push({
    id: result,
    event_id: event,
    school_id: school,
    bib: "other",
    value: 11,
    status: "OK",
  });
  await assert.rejects(
    () => saveAthleticsResult(f.client, f.race, { id: actor, role: "admin" }),
    /เจ้าของ/,
  );
  assert.equal(f.writes.length, 0);
});
test("new final requires real time and venue and derives assigned referee from its heat", async () => {
  const f = fixture();
  f.db.athletics_results.push({
    id: "70000000-0000-4000-8000-000000000001",
    event_id: event,
    school_id: school,
    bib: "101",
    value: 12,
    status: "OK",
  });
  const final = {
    ...f.race,
    event_id: undefined,
    stage: "final",
    kind: "track",
    direction: "asc",
    unit: "s",
    referee_id: school,
  };
  await assert.rejects(
    () => saveAthleticsResult(f.client, final, { id: actor, role: "referee" }),
    /วันเวลา/,
  );
  assert.equal(f.writes.length, 0);
  await saveAthleticsResult(
    f.client,
    { ...final, starts_at: "2026-11-30T15:00", venue: "สนามจริง" },
    { id: actor, role: "referee" },
  );
  assert.equal(f.writes[0].body.referee_id, actor);
  assert.equal(f.writes[0].body.starts_at, "2026-11-30T08:00:00.000Z");
  assert.equal(f.writes[1].body.school_id, school);
});

test("referee cannot invent finalists without an OK result in their assigned heat", async () => {
  const f = fixture();
  const final = {
    ...f.race,
    event_id: undefined,
    stage: "final",
    kind: "track",
    direction: "desc",
    unit: "m",
    starts_at: "2026-11-30T15:00",
    venue: "สนาม",
  };
  await assert.rejects(
    () => saveAthleticsResult(f.client, final, { id: actor, role: "referee" }),
    /ฮีต/,
  );
  assert.equal(f.writes.length, 0);
  f.db.athletics_results.push({
    id: "70000000-0000-4000-8000-000000000001",
    event_id: event,
    school_id: school,
    bib: "101",
    value: null,
    status: "DQ",
  });
  await assert.rejects(
    () => saveAthleticsResult(f.client, final, { id: actor, role: "referee" }),
    /ฮีต/,
  );
  assert.equal(f.writes.length, 0);
  f.db.athletics_results[0].status = "OK";
  f.db.athletics_results[0].value = 12;
  await saveAthleticsResult(f.client, final, { id: actor, role: "referee" });
  assert.equal(f.writes[0].body.direction, "lower");
  assert.equal(f.writes[0].body.unit, "s");
  assert.equal(f.writes[0].body.kind, "track");
});

test("only admin may assign athletics referees, with target validation", async () => {
  const { assignAthleticsReferee } = await import("../lib/athletics-results");
  const f = fixture();
  await assert.rejects(
    () =>
      assignAthleticsReferee(f.client, event, actor, {
        id: actor,
        role: "referee",
      }),
    /ผู้ดูแลระบบ/,
  );
  await assert.rejects(
    () =>
      assignAthleticsReferee(f.client, event, school, {
        id: actor,
        role: "admin",
      }),
    /ไม่ใช่กรรมการ/,
  );
  assert.equal(f.writes.length, 0);
  await assignAthleticsReferee(f.client, event, null, {
    id: actor,
    role: "admin",
  });
  assert.deepEqual(f.writes[0].body, { referee_id: null });
  assert.equal(f.db.athletics_events[0].referee_id, null);
});
