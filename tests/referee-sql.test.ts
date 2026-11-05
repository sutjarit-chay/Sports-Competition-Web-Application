import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("referee assignments restrict reads and writes to assigned match and event results", async () => {
  const db = new PGlite();
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.profiles(
      id uuid primary key,
      role text not null,
      school_id uuid
    );
    create table public.competitions(id uuid primary key, name text not null);
    create table public.matches(
      id uuid primary key,
      competition_id uuid not null references public.competitions(id),
      group_name text not null,
      home_school_id uuid not null,
      away_school_id uuid not null,
      starts_at timestamptz,
      venue text,
      status text not null,
      home_score integer,
      away_score integer,
      revision integer not null default 0
    );
    create table public.athletics_events(
      id uuid primary key,
      competition_id uuid not null references public.competitions(id),
      name text not null,
      kind text not null,
      round text not null,
      heat integer not null,
      direction text not null,
      unit text not null,
      starts_at timestamptz,
      venue text,
      referee_id uuid references public.profiles(id)
    );
    create table public.athletics_results(
      id uuid primary key,
      event_id uuid not null references public.athletics_events(id),
      school_id uuid not null,
      bib text not null,
      value numeric,
      status text not null
    );
    create table public.registrations(
      id uuid primary key,
      competition_id uuid not null references public.competitions(id),
      school_id uuid not null,
      athlete_name text not null,
      bib text
    );
    grant select on public.profiles to authenticated;
    grant select on public.competitions, public.registrations,
      public.matches, public.athletics_events, public.athletics_results
      to authenticated;
    grant insert, update, delete on public.matches,
      public.athletics_events, public.athletics_results to authenticated;
    alter table public.profiles enable row level security;
    create policy profiles_read on public.profiles to authenticated using (true);
    alter table public.competitions enable row level security;
    create policy competitions_read on public.competitions to authenticated using (true);
    alter table public.registrations enable row level security;
    create policy registrations_read on public.registrations to authenticated using (true);
    alter table public.matches enable row level security;
    create policy matches_read on public.matches to authenticated using (true);
    create policy matches_write on public.matches for all to authenticated
      using (true) with check (true);
    alter table public.athletics_events enable row level security;
    create policy events_read on public.athletics_events to authenticated using (true);
    create policy events_write on public.athletics_events for all to authenticated
      using (true) with check (true);
    alter table public.athletics_results enable row level security;
    create policy results_read on public.athletics_results to authenticated using (true);
    create policy results_write on public.athletics_results for all to authenticated
      using (true) with check (true);
  `);
  await db.exec(
    await readFile("supabase/migrations/20261106_referee_workflow.sql", "utf8"),
  );

  const referee = "00000000-0000-4000-8000-000000000001";
  const admin = "00000000-0000-4000-8000-000000000002";
  const competition = "10000000-0000-4000-8000-000000000001";
  const otherCompetition = "10000000-0000-4000-8000-000000000002";
  const assignedMatch = "20000000-0000-4000-8000-000000000001";
  const otherMatch = "20000000-0000-4000-8000-000000000002";
  const assignedEvent = "30000000-0000-4000-8000-000000000001";
  const otherEvent = "30000000-0000-4000-8000-000000000002";
  await db.exec(`
    insert into public.profiles values
      ('${referee}','recorder',null), ('${admin}','admin',null),
      ('00000000-0000-4000-8000-000000000003','school',null);
    insert into public.competitions values
      ('${competition}','Assigned'), ('${otherCompetition}','Unassigned');
    insert into public.matches(
      id,competition_id,group_name,home_school_id,away_school_id,status,referee_id
    ) values
      ('${assignedMatch}','${competition}','A','40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','scheduled','${referee}'),
      ('${otherMatch}','${otherCompetition}','A','40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004','scheduled',null);
    insert into public.athletics_events(
      id,competition_id,name,kind,round,heat,direction,unit,referee_id
    ) values
      ('${assignedEvent}','${competition}','100m','track','heat',1,'asc','s','${referee}'),
      ('${otherEvent}','${otherCompetition}','200m','track','heat',1,'asc','s',null);
    insert into public.registrations(id,competition_id,school_id,athlete_name,bib)
    values
      ('50000000-0000-4000-8000-000000000001','${competition}','40000000-0000-4000-8000-000000000001','Assigned Athlete','101'),
      ('50000000-0000-4000-8000-000000000002','${otherCompetition}','40000000-0000-4000-8000-000000000002','Other Athlete','102');
  `);

  async function as(id: string) {
    await db.exec(`
      reset role;
      select set_config('request.jwt.claim.sub','${id}',false);
      set role authenticated;
    `);
  }

  await as(referee);
  assert.deepEqual(
    (
      await db.query<{ id: string }>(
        "select id from public.matches order by id",
      )
    ).rows.map((row) => row.id),
    [assignedMatch],
  );
  assert.deepEqual(
    (
      await db.query<{ id: string }>(
        "select id from public.competitions order by id",
      )
    ).rows.map((row) => row.id),
    [competition],
  );
  assert.deepEqual(
    (
      await db.query<{ athlete_name: string }>(
        "select athlete_name from public.registrations",
      )
    ).rows.map((row) => row.athlete_name),
    ["Assigned Athlete"],
  );
  await db.exec(`
    update public.matches
    set home_score=2, away_score=1, status='finished', revision=1
    where id='${assignedMatch}';
  `);
  await assert.rejects(
    db.exec(
      `update public.matches set venue='Changed' where id='${assignedMatch}'`,
    ),
    /แก้ได้เฉพาะผลของคู่ที่ได้รับมอบหมาย/,
  );
  await db.exec(`
    insert into public.athletics_results
      (id,event_id,school_id,bib,value,status)
    values
      ('60000000-0000-4000-8000-000000000001','${assignedEvent}',
       '40000000-0000-4000-8000-000000000001','101',12.5,'OK');
  `);
  await assert.rejects(
    db.exec(`
      insert into public.athletics_results
        (id,event_id,school_id,bib,value,status)
      values
        ('60000000-0000-4000-8000-000000000002','${otherEvent}',
         '40000000-0000-4000-8000-000000000002','102',13.5,'OK');
    `),
    /รายการกรีฑานี้ไม่ได้มอบหมาย/,
  );
  await db.exec(`
    insert into public.athletics_events(
      id,competition_id,name,kind,round,heat,direction,unit,referee_id
    ) values (
      '30000000-0000-4000-8000-000000000003','${competition}',
      '100m','track','final',1,'asc','s','${referee}'
    );
  `);
  await assert.rejects(
    db.exec(`
      update public.athletics_events
      set venue='Self reassigned' where id='${assignedEvent}';
    `),
    /กรรมการแก้ไขรายการกรีฑาได้เฉพาะสร้างรอบชิง/,
  );

  await as(admin);
  await db.exec(
    `update public.matches set referee_id='${admin}' where id='${otherMatch}'`,
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query<{ referee_id: string }>(
        "select referee_id from public.matches where id=$1",
        [otherMatch],
      )
    ).rows[0].referee_id,
    admin,
  );
  await as("00000000-0000-4000-8000-000000000003");
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.matches",
      )
    ).rows[0].count,
    2,
  );
  await db.close();
});
