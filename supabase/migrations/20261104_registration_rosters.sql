-- Generated from lib/registration-rules.json by scripts/generate-registration-migration.ts.
-- Additive migration for the NORMALIZED hosted contract, never legacy schema.sql.
-- Existing RLS/policies/constraints/registration IDs are not altered.
begin;
do $$ begin
  if to_regclass('public.competitions') is null or to_regclass('public.registrations') is null then
    raise exception 'ต้องใช้ฐานข้อมูล normalized ที่มี competitions และ registrations';
  end if;
end $$;
alter table public.competitions add column if not exists registration_policy jsonb;
alter table public.registrations add column if not exists roster_details jsonb;
create table if not exists public.registration_rule_catalog(id text primary key, rule jsonb not null);
insert into public.registration_rule_catalog(id,rule) values
('football-male', '{"id":"football-male","name":"ฟุตบอล ชาย 7 คน","sport":"ฟุตบอล","genders":["ชาย"],"levels":["ประถมศึกษา","มัธยมศึกษา"],"starters":7,"reserves":3,"note":"จำนวนรวมสูงสุด 10 คน"}'::jsonb),
('chairball-female', '{"id":"chairball-female","name":"แชร์บอล หญิง","sport":"แชร์บอล","genders":["หญิง"],"levels":["ประถมศึกษา","มัธยมศึกษา"],"starters":6,"reserves":null,"note":"จำนวนสำรองตามระเบียบของผู้จัดการแข่งขัน"}'::jsonb),
('volleyball-male', '{"id":"volleyball-male","name":"วอลเลย์บอล ชาย","sport":"วอลเลย์บอล","genders":["ชาย"],"levels":["ประถมศึกษา","มัธยมศึกษา"],"starters":6,"reserves":6,"note":"จำนวนรวมสูงสุด 12 คน"}'::jsonb),
('volleyball-female', '{"id":"volleyball-female","name":"วอลเลย์บอล หญิง","sport":"วอลเลย์บอล","genders":["หญิง"],"levels":["ประถมศึกษา","มัธยมศึกษา"],"starters":6,"reserves":6,"note":"จำนวนรวมสูงสุด 12 คน"}'::jsonb),
('takraw-male', '{"id":"takraw-male","name":"ตะกร้อ ชาย ประเภททีมเดี่ยว","sport":"เซปักตะกร้อ","genders":["ชาย"],"levels":[],"starters":3,"reserves":2,"note":"ประเภททีมเดี่ยว"}'::jsonb),
('takraw-female', '{"id":"takraw-female","name":"ตะกร้อ หญิง ประเภททีมเดี่ยว","sport":"เซปักตะกร้อ","genders":["หญิง"],"levels":[],"starters":3,"reserves":2,"note":"ประเภททีมเดี่ยว"}'::jsonb),
('petanque-male', '{"id":"petanque-male","name":"เปตอง ทีมชาย","sport":"เปตอง","genders":["ชาย"],"levels":[],"starters":3,"reserves":0,"note":"ไม่มีการเปลี่ยนตัวระหว่างเกม"}'::jsonb),
('petanque-female', '{"id":"petanque-female","name":"เปตอง ทีมหญิง","sport":"เปตอง","genders":["หญิง"],"levels":[],"starters":3,"reserves":0,"note":"ไม่มีการเปลี่ยนตัวระหว่างเกม"}'::jsonb),
('throwball-mixed', '{"id":"throwball-mixed","name":"โยนบอล ทีมผสม","sport":"โยนบอล","genders":["ผสม"],"levels":["อนุบาล"],"starters":5,"reserves":null,"note":"จำนวนสำรองตามระเบียบของผู้จัดการแข่งขัน"}'::jsonb),
('athletics-individual', '{"id":"athletics-individual","name":"กรีฑา ประเภทเดี่ยว","sport":"กรีฑา","genders":[],"levels":[],"starters":null,"reserves":0,"note":"วิ่ง 60 เมตร, 80 เมตร, 100 เมตร, 200 เมตร และมินิมาราธอน ตามโควตาผู้จัด เลือกได้หลายรายการ"}'::jsonb),
('athletics-relay', '{"id":"athletics-relay","name":"กรีฑา วิ่งผลัด","sport":"กรีฑา","genders":[],"levels":[],"starters":4,"reserves":4,"note":"ผู้แข่งขัน 4 คน สำรองไม่เกิน 4 คน รวมไม่เกิน 8 คน"}'::jsonb)
on conflict(id) do update set rule=excluded.rule;
revoke all on public.registration_rule_catalog from public, anon, authenticated;
grant select on public.registration_rule_catalog to anon, authenticated;

create or replace function public.roster_level(value text) returns text
language sql immutable set search_path=public as $$
  select case trim(value) when 'ประถม' then 'ประถมศึกษา' when 'มัธยม' then 'มัธยมศึกษา' else trim(value) end
$$;

create or replace function public.validate_registration_policy() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare r jsonb; reserves integer; e record;
begin
  if TG_OP='UPDATE' and NEW.registration_policy is not distinct from OLD.registration_policy and NEW.sport is not distinct from OLD.sport and NEW.gender is not distinct from OLD.gender and NEW.age_group is not distinct from OLD.age_group then return NEW; end if;
  if auth.uid() is not null then
    if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
      raise exception 'เฉพาะผู้ดูแลระบบเท่านั้นที่ตั้งค่าโควตาได้';
    end if;
  elsif coalesce(current_setting('role',true),'') in ('anon','authenticated') then
    raise exception 'กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแล';
  end if;
  if TG_OP='UPDATE' and OLD.registration_policy is not null and (NEW.sport is distinct from OLD.sport or NEW.gender is distinct from OLD.gender or NEW.age_group is distinct from OLD.age_group) and exists(select 1 from public.registrations where competition_id=NEW.id) then raise exception 'มีข้อมูลสมัครเดิม ห้ามเปลี่ยนกีฬา เพศ หรือระดับชั้นของรายการ'; end if;
  if NEW.registration_policy is null then
    if TG_OP='UPDATE' and OLD.registration_policy is not null then raise exception 'ห้ามยกเลิกกติกาของรายการที่เปิดใช้งานแล้ว'; end if;
    return NEW;
  end if;
  select rule into r from public.registration_rule_catalog where id=NEW.registration_policy->>'ruleId';
  if r is null then raise exception 'ประเภทการแข่งขันไม่ถูกต้อง'; end if;
  if (case NEW.sport::text when 'ตะกร้อ' then 'เซปักตะกร้อ' else NEW.sport::text end)<>r->>'sport'
    or (jsonb_array_length(r->'genders')>0 and not (r->'genders' ? NEW.gender::text))
    or (jsonb_array_length(r->'levels')>0 and not (r->'levels' ? public.roster_level(NEW.age_group::text))) then
    raise exception 'กีฬา เพศ หรือระดับชั้นไม่ตรงกับกติกา';
  end if;
  if TG_OP='UPDATE' and OLD.registration_policy is not null and OLD.registration_policy->>'ruleId'<>NEW.registration_policy->>'ruleId'
    and exists(select 1 from public.registrations where competition_id=NEW.id) then
    raise exception 'มีข้อมูลสมัครเดิม ห้ามเปลี่ยนประเภทการแข่งขัน';
  end if;
  if NEW.registration_policy->'reserves' is not null and NEW.registration_policy->'reserves'<>'null'::jsonb then
    if jsonb_typeof(NEW.registration_policy->'reserves')<>'number' or NEW.registration_policy->>'reserves' !~ '^[0-9]+$' then raise exception 'จำนวนสำรองไม่ถูกต้อง'; end if;
    reserves=(NEW.registration_policy->>'reserves')::integer;
    if reserves<0 or reserves>100 then raise exception 'จำนวนสำรองต้องอยู่ในช่วง 0–100'; end if;
  end if;
  if r->'reserves'<>'null'::jsonb and (NEW.registration_policy->'reserves' is null or NEW.registration_policy->'reserves' is distinct from r->'reserves') then raise exception 'ห้ามเปลี่ยนจำนวนสำรองของประเภทที่กำหนดตายตัว'; end if;
  if jsonb_typeof(NEW.registration_policy->'eventQuotas') is distinct from 'object' then raise exception 'โควตากรีฑาไม่ถูกต้อง'; end if;
  for e in select * from jsonb_each(NEW.registration_policy->'eventQuotas') loop
    if e.key not in ('run60','run80','run100','run200','miniMarathon') or jsonb_typeof(e.value)<>'number' or e.value::text !~ '^[0-9]+$' then raise exception 'โควตากรีฑาไม่ถูกต้อง'; end if;
    if (e.value::text)::integer>100 then raise exception 'โควตากรีฑาต้องอยู่ในช่วง 0–100'; end if;
  end loop;
  if NEW.registration_policy->'maxEventsPerAthlete' is not null and NEW.registration_policy->'maxEventsPerAthlete'<>'null'::jsonb then
    if jsonb_typeof(NEW.registration_policy->'maxEventsPerAthlete')<>'number' or NEW.registration_policy->>'maxEventsPerAthlete' !~ '^[1-6]$' then raise exception 'จำนวนรายการต่อคนไม่ถูกต้อง'; end if;
  end if;
  return NEW;
end $$;
drop trigger if exists validate_registration_policy on public.competitions;
create trigger validate_registration_policy before insert or update on public.competitions for each row execute function public.validate_registration_policy();

-- Bind only unambiguous catalog matches. Athletics requires an explicit choice
-- between individual and relay; old generic/U12/mixed competitions stay untouched.
update public.competitions c set registration_policy=jsonb_build_object('ruleId',r.id,'reserves',r.rule->'reserves','eventQuotas','{}'::jsonb,'maxEventsPerAthlete',null)
from public.registration_rule_catalog r
where c.registration_policy is null and c.sport<>'กรีฑา'
  and (case c.sport::text when 'ตะกร้อ' then 'เซปักตะกร้อ' else c.sport::text end)=r.rule->>'sport'
  and (jsonb_array_length(r.rule->'genders')=0 or r.rule->'genders' ? c.gender::text)
  and (jsonb_array_length(r.rule->'levels')=0 or r.rule->'levels' ? public.roster_level(c.age_group::text));

create or replace function public.validate_roster_registration() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare p jsonb; r jsonb; d jsonb; pos text; starter_limit integer; reserve_limit integer; total_limit integer;
  total_count integer; starter_count integer; reserve_count integer; event_id text; quota integer; event_count integer;
  profile_role text; profile_school text; legacy_count integer;
begin
  select registration_policy into p from public.competitions where id=NEW.competition_id;
  if p is null then
    if NEW.roster_details is not null then raise exception 'ผู้ดูแลยังไม่ได้ตั้งค่าประเภทการแข่งขันนี้'; end if;
    return NEW;
  end if;
  if TG_OP='UPDATE' and NEW.roster_details is null and OLD.roster_details is null and NEW.school_id=OLD.school_id and NEW.competition_id=OLD.competition_id then return NEW; end if;
  if auth.uid() is not null then
    select role, school_id::text into profile_role,profile_school from public.profiles where id=auth.uid();
    if profile_role is distinct from 'admin' and not (coalesce(profile_role,'') in ('school','school_admin') and profile_school is not null and profile_school=NEW.school_id::text) then raise exception 'ลงทะเบียนได้เฉพาะโรงเรียนตนเอง'; end if;
  elsif coalesce(current_setting('role',true),'') in ('anon','authenticated') then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform pg_advisory_xact_lock(hashtextextended(NEW.competition_id::text||':'||NEW.school_id::text,0));
  -- Read policy again after serializing with other registrations/settings.
  select registration_policy into p from public.competitions where id=NEW.competition_id for share;
  select rule into r from public.registration_rule_catalog where id=p->>'ruleId';
  d=NEW.roster_details; pos=d->>'position';
  if d is null or d->>'ruleId' is distinct from p->>'ruleId' or pos is null or pos not in ('starter','reserve','individual') then raise exception 'กรุณาระบุประเภทการแข่งขันและสถานะตัวจริง/สำรอง'; end if;
  if jsonb_typeof(d->'events') is distinct from 'array' then raise exception 'รายการกรีฑาไม่ถูกต้อง'; end if;
  if NEW.athlete_name is null or length(trim(NEW.athlete_name))=0 then raise exception 'กรุณากรอกชื่อนักกีฬา'; end if;
  if exists(select 1 from public.registrations x where x.competition_id=NEW.competition_id and x.school_id=NEW.school_id and x.id<>NEW.id and trim(x.athlete_name)=trim(NEW.athlete_name)) then raise exception 'ข้อมูลนักกีฬาซ้ำ'; end if;
  select count(*),count(*) filter(where roster_details->>'position'='starter'),count(*) filter(where roster_details->>'position'='reserve'),count(*) filter(where roster_details is null)
    into total_count,starter_count,reserve_count,legacy_count from public.registrations where competition_id=NEW.competition_id and school_id=NEW.school_id and id<>NEW.id;
  if p->>'ruleId'='athletics-individual' then
    if pos<>'individual' or jsonb_array_length(d->'events')=0 then raise exception 'เลือกรายการกรีฑาอย่างน้อยหนึ่งรายการ'; end if;
    if legacy_count>0 then raise exception 'มีข้อมูลกรีฑาเดิมที่ยังไม่ระบุรายการ กรุณาตรวจทานก่อนสมัครเพิ่ม'; end if;
    if jsonb_array_length(d->'events')<>(select count(distinct value) from jsonb_array_elements(d->'events')) then raise exception 'รายการกรีฑาซ้ำ'; end if;
    if p->'maxEventsPerAthlete'<>'null'::jsonb and jsonb_array_length(d->'events')>(p->>'maxEventsPerAthlete')::integer then raise exception 'เกินจำนวนรายการต่อคน'; end if;
    for event_id in select jsonb_array_elements_text(d->'events') loop
      if event_id is null or event_id not in ('run60','run80','run100','run200','miniMarathon') then raise exception 'รายการกรีฑาไม่ถูกต้อง'; end if;
      if not (p->'eventQuotas' ? event_id) then raise exception 'ผู้ดูแลยังไม่ได้กำหนดโควตากรีฑา'; end if;
      quota=(p->'eventQuotas'->>event_id)::integer;
      select count(*) into event_count from public.registrations where competition_id=NEW.competition_id and school_id=NEW.school_id and id<>NEW.id and roster_details->'events' ? event_id;
      if event_count+1>quota then raise exception 'รายการ % เกินโควตา % คน',event_id,quota; end if;
    end loop;
  else
    starter_limit=(r->>'starters')::integer;
    reserve_limit=coalesce((r->>'reserves')::integer,(p->>'reserves')::integer);
    if reserve_limit is null then raise exception 'ผู้ดูแลยังไม่ได้กำหนดจำนวนสำรอง'; end if;
    total_limit=starter_limit+reserve_limit;
    if total_count+1>total_limit then raise exception 'จำนวนรวมเกิน % คน',total_limit; end if;
    if pos='individual' then raise exception 'กรุณาแยกตัวจริงและสำรอง'; end if;
    if pos='starter' and starter_count+1>starter_limit then raise exception 'ตัวจริงเกิน % คน',starter_limit; end if;
    if pos='reserve' and reserve_count+1>reserve_limit then raise exception 'สำรองเกิน % คน',reserve_limit; end if;
    if p->>'ruleId'='athletics-relay' then
      if d->'events'<>'["relay"]'::jsonb then raise exception 'วิ่งผลัดต้องเลือกรายการวิ่งผลัด'; end if;
    elsif jsonb_array_length(d->'events')>0 then raise exception 'กีฬาทีมไม่รับรายการกรีฑา'; end if;
  end if;
  return NEW;
end $$;
drop trigger if exists validate_roster_registration on public.registrations;
create trigger validate_roster_registration before insert or update on public.registrations for each row execute function public.validate_roster_registration();
notify pgrst, 'reload schema';
commit;
