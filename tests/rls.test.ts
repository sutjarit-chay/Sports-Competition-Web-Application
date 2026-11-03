import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL RLS enforces school isolation, recorder access and prevents privilege escalation", async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$; grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; alter default privileges in schema public grant all on tables to anon, authenticated;`,
  );
  await db.exec(await readFile("supabase/schema.sql", "utf8"));
  const school = "00000000-0000-0000-0000-000000000001",
    recorder = "00000000-0000-0000-0000-000000000002",
    admin = "00000000-0000-0000-0000-000000000003";
  await db.exec(
    `insert into auth.users values ('${school}'),('${recorder}'),('${admin}'); insert into profiles values ('${school}','school','1'),('${recorder}','recorder',null),('${admin}','admin',null);`,
  );
  async function asUser(id: string) {
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
    );
  }
  const athlete = "00000000-0000-0000-0000-000000000010";
  await asUser(school);
  await db.exec(
    `insert into athletes values ('${athlete}','นักวิ่ง','1','กรีฑา','ชาย','ประถม');`,
  );
  await assert.rejects(
    db.exec(
      `insert into athletes values ('00000000-0000-0000-0000-000000000011','อื่น','2','กรีฑา','ชาย','ประถม');`,
    ),
    /row-level security/,
  );
  await assert.rejects(
    db.exec(`update athletes set school_id='2' where id='${athlete}';`),
    /row-level security/,
  );
  await assert.rejects(
    db.exec(`update profiles set role='admin' where id='${school}'`),
    /permission denied/,
  );
  await assert.rejects(
    db.exec(
      `insert into matches(id,sport,division,gender,pool,home,away) values ('00000000-0000-0000-0000-000000000020','ฟุตบอล','ประถม','ชาย','A','1','2')`,
    ),
    /row-level security/,
  );
  await asUser(admin);
  await db.exec(
    `insert into athletes values ('00000000-0000-0000-0000-000000000012','โรงเรียนอื่น','2','กรีฑา','ชาย','ประถม');`,
  );
  await asUser(school);
  assert.equal((await db.query("select * from athletes")).rows.length, 1);
  await asUser(recorder);
  assert.equal((await db.query("select * from athletes")).rows.length, 2);
  await assert.rejects(
    db.exec(
      `insert into athletes values ('00000000-0000-0000-0000-000000000013','ห้าม','1','กรีฑา','ชาย','ประถม');`,
    ),
    /row-level security/,
  );
  await db.exec(
    `insert into races values ('00000000-0000-0000-0000-000000000030','วิ่ง 100 เมตร','ประถม','ชาย','heat',1,'${athlete}',12.5,'OK');`,
  );
  await asUser(school);
  await assert.rejects(
    db.exec(`delete from athletes where id='${athlete}'`),
    /foreign key/,
  );
  await assert.rejects(
    db.exec(
      `insert into awards values ('00000000-0000-0000-0000-000000000040','วิ่ง','ประถม','ชาย','1','gold')`,
    ),
    /row-level security/,
  );
  await db.exec("reset role; set role anon;");
  assert.equal((await db.query("select * from athletes")).rows.length, 0);
  assert.equal((await db.query("select * from schools")).rows.length, 10);
  await assert.rejects(db.exec("select * from profiles"), /permission denied/);
  await db.close();
});
