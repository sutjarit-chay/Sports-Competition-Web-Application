-- Additive school-account registration; existing tables, policies, and rows are untouched.
begin;

do $$
declare
  schools_id_type oid;
  profiles_school_type oid;
begin
  if to_regclass('public.schools') is null or to_regclass('public.profiles') is null then
    raise exception 'ต้องใช้ฐานข้อมูล normalized ที่มี schools และ profiles';
  end if;
  select a.atttypid into schools_id_type
  from pg_attribute a
  where a.attrelid='public.schools'::regclass and a.attname='id' and not a.attisdropped;
  select a.atttypid into profiles_school_type
  from pg_attribute a
  where a.attrelid='public.profiles'::regclass and a.attname='school_id' and not a.attisdropped;
  if schools_id_type is distinct from 'uuid'::regtype
    or profiles_school_type is distinct from schools_id_type then
    raise exception 'ชนิด schools.id และ profiles.school_id ต้องเป็น UUID ที่ตรงกัน';
  end if;
  if not exists (
    select 1 from pg_attribute a
    where a.attrelid='public.schools'::regclass and a.attname='name'
      and not a.attisdropped and a.atttypid='text'::regtype
  ) then
    raise exception 'ต้องมี schools.name ชนิด text';
  end if;
  if not exists (
    select 1 from pg_attrdef d
    join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
    where d.adrelid='public.schools'::regclass and a.attname='id'
  ) then
    raise exception 'schools.id ต้องมีค่าเริ่มต้นสำหรับสร้าง UUID';
  end if;
end $$;

create table public.school_registration_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() unique
    references auth.users(id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  school_name text not null check (length(btrim(school_name)) between 2 and 120),
  contact_name text not null check (length(btrim(contact_name)) between 2 and 100),
  contact_phone text check (
    contact_phone is null or contact_phone ~ '^[0-9+() -]{8,20}$'
  ),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  review_note text check (review_note is null or length(review_note) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check ((status = 'pending') = (reviewed_at is null))
);

create table public.school_signup_rate_limits (
  ip_hash text primary key check (ip_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null default now(),
  attempt_count integer not null check (attempt_count between 1 and 6)
);

alter table public.school_registration_requests enable row level security;
alter table public.school_signup_rate_limits enable row level security;
revoke all on public.school_registration_requests from public, anon, authenticated;
revoke all on public.school_signup_rate_limits from public, anon, authenticated;
grant select on public.school_registration_requests to authenticated;
grant insert (username, school_name, contact_name, contact_phone)
  on public.school_registration_requests to authenticated;

create policy school_registration_request_read
  on public.school_registration_requests for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy school_registration_request_insert
  on public.school_registration_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and username = lower(auth.jwt()->'user_metadata'->>'username')
    and auth.jwt()->>'email' = username || '@accounts.sports-competition.invalid'
  );

create or replace function public.review_school_registration(
  p_request_id uuid,
  p_decision text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  application public.school_registration_requests%rowtype;
  school_key uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่ตรวจคำขอได้';
  end if;
  if p_decision is null or p_decision not in ('approved','rejected') then
    raise exception 'สถานะการตรวจสอบไม่ถูกต้อง';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'หมายเหตุต้องไม่เกิน 500 ตัวอักษร';
  end if;

  select * into application
  from public.school_registration_requests
  where id = p_request_id
  for update;
  if not found or application.status <> 'pending' then
    raise exception 'ไม่พบคำขอที่รอตรวจสอบ';
  end if;

  if p_decision = 'approved' then
    insert into public.schools(name)
    values (application.school_name)
    returning id into school_key;
    insert into public.profiles(id, role, school_id)
    values (application.user_id, 'school_admin', school_key);
  end if;

  update public.school_registration_requests
  set status = p_decision, review_note = p_note, reviewed_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.allow_school_signup(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  attempts integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'เฉพาะ backend ที่เชื่อถือได้เท่านั้นที่ตรวจโควตาสมัครได้';
  end if;
  if p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'รหัสเครือข่ายไม่ถูกต้อง';
  end if;

  delete from public.school_signup_rate_limits
  where window_started_at < now() - interval '24 hours';

  insert into public.school_signup_rate_limits(ip_hash, window_started_at, attempt_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
  set window_started_at = case
        when school_signup_rate_limits.window_started_at < now() - interval '1 hour'
        then now()
        else school_signup_rate_limits.window_started_at
      end,
      attempt_count = case
        when school_signup_rate_limits.window_started_at < now() - interval '1 hour'
        then 1
        else least(school_signup_rate_limits.attempt_count + 1, 6)
      end
  returning attempt_count into attempts;

  return attempts <= 5;
end;
$$;

create or replace function public.resubmit_school_registration(
  p_school_name text,
  p_contact_name text,
  p_contact_phone text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.school_registration_requests
  set school_name = p_school_name,
      contact_name = p_contact_name,
      contact_phone = nullif(p_contact_phone, ''),
      status = 'pending',
      review_note = null,
      reviewed_at = null
  where user_id = auth.uid()
    and status = 'rejected'
    and username = lower(auth.jwt()->'user_metadata'->>'username')
    and auth.jwt()->>'email' =
      lower(auth.jwt()->'user_metadata'->>'username') ||
      '@accounts.sports-competition.invalid';
  if not found then
    raise exception 'ไม่พบคำขอที่ปฏิเสธและยังส่งใหม่ได้';
  end if;
end;
$$;

revoke all on function public.review_school_registration(uuid,text,text) from public, anon;
revoke all on function public.allow_school_signup(text) from public, anon, authenticated;
revoke all on function public.resubmit_school_registration(text,text,text) from public, anon;
grant execute on function public.review_school_registration(uuid,text,text) to authenticated;
grant execute on function public.allow_school_signup(text) to service_role;
grant execute on function public.resubmit_school_registration(text,text,text) to authenticated;

commit;
