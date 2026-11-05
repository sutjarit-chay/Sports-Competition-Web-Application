import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("school registration RLS and approval provision only the reviewed school admin", async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant execute on function auth.role() to anon, authenticated, service_role;
    grant execute on function auth.jwt() to anon, authenticated;
    create table public.schools(
      id uuid primary key default gen_random_uuid(),
      name text not null unique
    );
    create table public.profiles(
      id uuid primary key references auth.users(id),
      role text not null check(role in ('admin','school_admin')),
      school_id uuid references public.schools(id)
    );
    grant select on public.profiles to authenticated;
  `);
  await db.exec(
    await readFile(
      "supabase/migrations/20261105_school_registration.sql",
      "utf8",
    ),
  );

  const applicant = "00000000-0000-4000-8000-000000000001";
  const admin = "00000000-0000-4000-8000-000000000002";
  const other = "00000000-0000-4000-8000-000000000003";
  await db.exec(`
    insert into auth.users values ('${applicant}'),('${admin}'),('${other}');
    insert into public.profiles values ('${admin}','admin',null);
  `);

  async function as(
    id: string,
    username = "",
    email = `${username}@accounts.sports-competition.invalid`,
  ) {
    const claims = JSON.stringify({ user_metadata: { username }, email });
    await db.exec(`
      reset role;
      set role authenticated;
      select set_config('request.jwt.claim.sub','${id}',false);
      select set_config('request.jwt.claims','${claims}',false);
    `);
  }

  await as(applicant, "runner01");
  await db.exec(`
    insert into public.school_registration_requests(username,school_name,contact_name)
    values ('runner01','โรงเรียนใหม่','ผู้ประสานงาน');
  `);
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.school_registration_requests",
      )
    ).rows[0].count,
    1,
  );
  await assert.rejects(
    db.exec("update public.school_registration_requests set status='approved'"),
    /permission denied|row-level security/,
  );
  await as(other, "runner02");
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.school_registration_requests",
      )
    ).rows[0].count,
    0,
  );
  await assert.rejects(
    db.exec(`
      insert into public.school_registration_requests(username,school_name,contact_name)
      values ('someone-else','โรงเรียนปลอม','ผู้ประสานงาน')
    `),
    /row-level security/,
  );
  await as(other, "runner02", "user@example.com");
  await assert.rejects(
    db.exec(`
      insert into public.school_registration_requests(username,school_name,contact_name)
      values ('runner02','โรงเรียนปลอม','ผู้ประสานงาน')
    `),
    /row-level security/,
  );

  await as(admin);
  const { rows } = await db.query<{ id: string }>(
    "select id from public.school_registration_requests limit 1",
  );
  await db.query(
    "select public.review_school_registration($1, 'approved', null)",
    [rows[0].id],
  );
  await db.exec("reset role");
  assert.deepEqual(
    (
      await db.query<{ role: string; school_id: string }>(
        "select role, school_id from public.profiles where id=$1",
        [applicant],
      )
    ).rows[0],
    {
      role: "school_admin",
      school_id: (
        await db.query<{ id: string }>(
          "select id from public.schools where name='โรงเรียนใหม่'",
        )
      ).rows[0].id,
    },
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.school_registration_requests",
      )
    ).rows[0].status,
    "approved",
  );
  await assert.rejects(
    db.query("select public.review_school_registration($1, 'approved', null)", [
      rows[0].id,
    ]),
    /ไม่พบคำขอที่รอตรวจสอบ/,
  );
  await as(other, "runner02");
  await assert.rejects(
    db.query("select public.review_school_registration($1, 'rejected', null)", [
      rows[0].id,
    ]),
    /permission denied for function|เฉพาะผู้ดูแลระบบ/,
  );

  await db.exec(`
    insert into public.school_registration_requests(username,school_name,contact_name)
    values ('runner02','โรงเรียนที่ต้องแก้ไข','ผู้ประสานงาน');
  `);
  await as(admin);
  const { rows: secondRequest } = await db.query<{ id: string }>(
    "select id from public.school_registration_requests where username='runner02'",
  );
  await db.query(
    "select public.review_school_registration($1, 'rejected', 'กรุณาแก้ชื่อโรงเรียน')",
    [secondRequest[0].id],
  );
  await as(other, "runner02");
  await db.query("select public.resubmit_school_registration($1, $2, $3)", [
    "โรงเรียนแก้ไขแล้ว",
    "ผู้ประสานงานใหม่",
    null,
  ]);
  assert.deepEqual(
    (
      await db.query<{
        school_name: string;
        status: string;
        review_note: string | null;
      }>(
        "select school_name,status,review_note from public.school_registration_requests where id=$1",
        [secondRequest[0].id],
      )
    ).rows[0],
    {
      school_name: "โรงเรียนแก้ไขแล้ว",
      status: "pending",
      review_note: null,
    },
  );
  await as(admin);
  await db.query(
    "select public.review_school_registration($1, 'approved', null)",
    [secondRequest[0].id],
  );
  await db.exec(`
    reset role;
    set role service_role;
    select set_config('request.jwt.claim.role','service_role',false);
  `);
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select public.allow_school_signup(repeat('a',64)) as allowed",
        )
      ).rows[0].allowed,
      true,
    );
  }
  assert.equal(
    (
      await db.query<{ allowed: boolean }>(
        "select public.allow_school_signup(repeat('a',64)) as allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await db.close();
});
