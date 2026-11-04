import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import catalog from "../lib/registration-rules.json";

const cid = "10000000-0000-4000-8000-000000000001",
  sid = "20000000-0000-4000-8000-000000000001";
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table profiles(id uuid primary key,role text,school_id uuid);
    create table competitions(id uuid primary key,sport text,gender text,age_group text);
    create table registrations(id uuid primary key,competition_id uuid references competitions,school_id uuid,athlete_name text,bib text);
    insert into competitions values ('${cid}','ฟุตบอล','ชาย','ประถม');
    insert into registrations values ('30000000-0000-4000-8000-000000000001','${cid}','${sid}','ข้อมูลเดิม','old');`);
  await db.exec(
    await readFile(
      "supabase/migrations/20261104_registration_rosters.sql",
      "utf8",
    ),
  );
  return db;
}
test("additive migration preserves IDs and unknown legacy roles; database catalog equals shared source", async () => {
  const db = await setup();
  const legacy = await db.query<{
    roster_details: unknown;
    athlete_name: string;
  }>("select * from registrations");
  assert.equal(legacy.rows.length, 1);
  assert.equal(legacy.rows[0].roster_details, null);
  assert.equal(legacy.rows[0].athlete_name, "ข้อมูลเดิม");
  const rules = await db.query<{ rule: { id: string } }>(
    "select rule from registration_rule_catalog order by id",
  );
  assert.deepEqual(
    rules.rows.map((r) => r.rule),
    [...catalog].sort((a, b) => a.id.localeCompare(b.id)),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261104_registration_rosters.sql",
      "utf8",
    ),
  );
  assert.equal((await db.query("select * from registrations")).rows.length, 1);
  await db.close();
});
test("direct database inserts cannot bypass team caps or omit roles; legacy counts towards the total", async () => {
  const db = await setup();
  await assert.rejects(
    db.exec(
      `insert into registrations values(gen_random_uuid(),'${cid}','${sid}','ไม่มีสถานะ','bad',null)`,
    ),
    /สถานะ/,
  );
  for (let i = 0; i < 9; i++)
    await db.query(
      `insert into registrations values(gen_random_uuid(),$1,$2,$3,$3,$4)`,
      [
        cid,
        sid,
        `นักกีฬา${i}`,
        {
          ruleId: "football-male",
          position: i < 7 ? "starter" : "reserve",
          events: [],
        },
      ],
    );
  await assert.rejects(
    db.query(
      `insert into registrations values(gen_random_uuid(),$1,$2,'เกิน','extra',$3)`,
      [cid, sid, { ruleId: "football-male", position: "reserve", events: [] }],
    ),
    /เกิน/,
  );
  assert.equal((await db.query("select * from registrations")).rows.length, 10);
  await db.close();
});
test("configured quotas validate multi-event athletics and roll back an overflowing batch", async () => {
  const db = await setup();
  const track = "10000000-0000-4000-8000-000000000002";
  await db.query(
    "insert into competitions values($1,'กรีฑา','หญิง','มัธยม',$2)",
    [
      track,
      {
        ruleId: "athletics-individual",
        reserves: 0,
        eventQuotas: { run60: 1, run80: 2 },
        maxEventsPerAthlete: 2,
      },
    ],
  );
  await db.query(
    `insert into registrations values(gen_random_uuid(),$1,$2,'นักวิ่ง','201',$3)`,
    [
      track,
      sid,
      {
        ruleId: "athletics-individual",
        position: "individual",
        events: ["run60", "run80"],
      },
    ],
  );
  await assert.rejects(
    db.query(
      `insert into registrations values(gen_random_uuid(),$1,$2,'เกินโควตา','202',$3)`,
      [
        track,
        sid,
        {
          ruleId: "athletics-individual",
          position: "individual",
          events: ["run60"],
        },
      ],
    ),
    /โควตา/,
  );
  await assert.rejects(
    db.exec(`insert into registrations values
    (gen_random_uuid(),'${track}','${sid}','คนเพิ่ม1','203','{"ruleId":"athletics-individual","position":"individual","events":["run80"]}'),
    (gen_random_uuid(),'${track}','${sid}','คนเพิ่ม2','204','{"ruleId":"athletics-individual","position":"individual","events":["run80"]}');`),
    /โควตา/,
  );
  assert.equal(
    (
      await db.query("select * from registrations where competition_id=$1", [
        track,
      ])
    ).rows.length,
    1,
  );
  await db.close();
});

test("database guard blocks cross-school roles, missing school assignment and non-admin policy changes", async () => {
  const db = await setup();
  const uid = "40000000-0000-4000-8000-000000000001";
  await db.exec(`grant usage on schema auth to authenticated; grant select,insert,update on public.registrations,public.competitions to authenticated;
    insert into profiles values('${uid}','school_admin',null);
    set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  const details = { ruleId: "football-male", position: "starter", events: [] };
  await assert.rejects(
    db.query(
      "insert into registrations values(gen_random_uuid(),$1,$2,'ห้าม','deny',$3)",
      [cid, sid, details],
    ),
    /โรงเรียน/,
  );
  await assert.rejects(
    db.query("update competitions set registration_policy=$1 where id=$2", [
      {
        ruleId: "football-male",
        reserves: 3,
        eventQuotas: {},
        maxEventsPerAthlete: 1,
      },
      cid,
    ]),
    /ผู้ดูแล/,
  );
  await assert.rejects(
    db.exec("delete from registration_rule_catalog"),
    /permission denied/,
  );
  await db.exec(
    `reset role; update profiles set school_id='${sid}' where id='${uid}'; set role authenticated;`,
  );
  await db.query(
    "insert into registrations values(gen_random_uuid(),$1,$2,'อนุญาต','ok',$3)",
    [cid, sid, details],
  );
  await assert.rejects(
    db.query(
      "insert into registrations values(gen_random_uuid(),$1,$2,'ต่างโรงเรียน','other',$3)",
      [cid, "20000000-0000-4000-8000-000000000002", details],
    ),
    /โรงเรียน/,
  );
  await db.close();
});

test("malformed athletics selections cannot bypass an unopened quota", async () => {
  const db = await setup();
  const track = "10000000-0000-4000-8000-000000000009";
  await db.query(
    "insert into competitions values($1,'กรีฑา','ชาย','ประถม',$2)",
    [
      track,
      {
        ruleId: "athletics-individual",
        reserves: 0,
        eventQuotas: {},
        maxEventsPerAthlete: null,
      },
    ],
  );
  await assert.rejects(
    db.query(
      "insert into registrations values(gen_random_uuid(),$1,$2,'ข้อมูลผิด','invalid',$3)",
      [
        track,
        sid,
        {
          ruleId: "athletics-individual",
          position: "individual",
          events: [null],
        },
      ],
    ),
    /รายการกรีฑา/,
  );
  await db.close();
});

test("competition scope cannot contradict its policy or silently reclassify existing athletes", async () => {
  const db = await setup();
  await assert.rejects(
    db.exec(`update competitions set gender='หญิง' where id='${cid}'`),
    /เพศ|ข้อมูลสมัครเดิม/,
  );
  await assert.rejects(
    db.exec(`update competitions set age_group='มัธยม' where id='${cid}'`),
    /ข้อมูลสมัครเดิม/,
  );
  await db.close();
});
