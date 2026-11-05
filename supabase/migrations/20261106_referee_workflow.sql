-- Referee assignments are additive; existing RLS policies remain in place.
begin;

do $$
declare
  profiles_id_type oid;
  competitions_id_type oid;
  matches_competition_type oid;
  registrations_competition_type oid;
  events_competition_type oid;
  events_referee_type oid;
  matches_referee_type oid;
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.competitions') is null
    or to_regclass('public.matches') is null
    or to_regclass('public.athletics_events') is null
    or to_regclass('public.athletics_results') is null
    or to_regclass('public.registrations') is null then
    raise exception 'ต้องใช้ฐานข้อมูล normalized สำหรับมอบหมายกรรมการ';
  end if;

  select atttypid into profiles_id_type from pg_attribute
    where attrelid='public.profiles'::regclass and attname='id' and not attisdropped;
  select atttypid into competitions_id_type from pg_attribute
    where attrelid='public.competitions'::regclass and attname='id' and not attisdropped;
  select atttypid into matches_competition_type from pg_attribute
    where attrelid='public.matches'::regclass and attname='competition_id' and not attisdropped;
  select atttypid into registrations_competition_type from pg_attribute
    where attrelid='public.registrations'::regclass and attname='competition_id' and not attisdropped;
  select atttypid into events_competition_type from pg_attribute
    where attrelid='public.athletics_events'::regclass and attname='competition_id' and not attisdropped;
  select atttypid into events_referee_type from pg_attribute
    where attrelid='public.athletics_events'::regclass and attname='referee_id' and not attisdropped;
  select atttypid into matches_referee_type from pg_attribute
    where attrelid='public.matches'::regclass and attname='referee_id' and not attisdropped;

  if profiles_id_type is distinct from 'uuid'::regtype
    or competitions_id_type is distinct from 'uuid'::regtype
    or matches_competition_type is distinct from competitions_id_type
    or registrations_competition_type is distinct from competitions_id_type
    or events_competition_type is distinct from competitions_id_type
    or events_referee_type is distinct from profiles_id_type then
    raise exception 'ชนิด ID ของ profiles, competitions และ referee_id ไม่ตรงตามที่ต้องใช้';
  end if;
  if matches_referee_type is not null
    and matches_referee_type is distinct from profiles_id_type then
    raise exception 'matches.referee_id ต้องเป็น UUID';
  end if;
end $$;

alter table public.matches add column if not exists referee_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.matches'::regclass
      and conname='matches_referee_id_fkey'
  ) then
    alter table public.matches
      add constraint matches_referee_id_fkey
      foreign key (referee_id) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists matches_referee_schedule_idx
  on public.matches(referee_id, starts_at);
create index if not exists athletics_events_referee_schedule_idx
  on public.athletics_events(referee_id, starts_at);

create or replace function public.referee_can_access_competition(p_competition_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.matches m
    where m.competition_id = p_competition_id and m.referee_id = auth.uid()
    union all
    select 1
    from public.athletics_events e
    where e.competition_id = p_competition_id and e.referee_id = auth.uid()
  );
$$;
revoke all on function public.referee_can_access_competition(uuid) from public;
grant execute on function public.referee_can_access_competition(uuid) to authenticated;

create or replace function public.enforce_referee_result_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  assigned_referee uuid;
begin
  if auth.uid() is null then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  select role into actor_role
  from public.profiles
  where id = auth.uid();

  if actor_role = 'admin' then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  if actor_role is null or actor_role not in ('recorder', 'referee') then
    raise exception 'บัญชีนี้ไม่มีสิทธิ์ทำงานกรรมการ';
  end if;

  if TG_TABLE_NAME = 'matches' then
    if TG_OP <> 'UPDATE'
      or OLD.referee_id is distinct from auth.uid()
      or NEW.referee_id is distinct from OLD.referee_id
      or NEW.competition_id is distinct from OLD.competition_id
      or NEW.group_name is distinct from OLD.group_name
      or NEW.home_school_id is distinct from OLD.home_school_id
      or NEW.away_school_id is distinct from OLD.away_school_id
      or NEW.starts_at is distinct from OLD.starts_at
      or NEW.venue is distinct from OLD.venue
      or NEW.status is distinct from 'finished'
      or NEW.home_score is null or NEW.home_score < 0
      or NEW.away_score is null or NEW.away_score < 0
      or NEW.revision <> OLD.revision + 1 then
      raise exception 'แก้ได้เฉพาะผลของคู่ที่ได้รับมอบหมาย';
    end if;
    return NEW;
  end if;

  if TG_TABLE_NAME = 'athletics_events' then
    if TG_OP = 'INSERT'
      and NEW.round = 'final'
      and NEW.referee_id = auth.uid()
      and exists (
        select 1 from public.athletics_events e
        where e.competition_id = NEW.competition_id
          and e.name = NEW.name
          and e.round = 'heat'
          and e.referee_id = auth.uid()
      ) then
      return NEW;
    end if;
    raise exception 'กรรมการแก้ไขรายการกรีฑาได้เฉพาะสร้างรอบชิงจากฮีตที่ได้รับมอบหมาย';
  end if;

  if TG_TABLE_NAME = 'athletics_results' then
    if TG_OP = 'DELETE' then
      raise exception 'กรรมการลบผลกรีฑาไม่ได้';
    end if;
    select referee_id into assigned_referee
    from public.athletics_events
    where id = NEW.event_id;
    if assigned_referee is distinct from auth.uid() then
      raise exception 'รายการกรีฑานี้ไม่ได้มอบหมายให้บัญชีนี้';
    end if;
    if TG_OP = 'UPDATE' and (
      NEW.event_id is distinct from OLD.event_id
      or NEW.school_id is distinct from OLD.school_id
      or NEW.bib is distinct from OLD.bib
    ) then
      raise exception 'ห้ามเปลี่ยนนักกีฬาในผลเดิม';
    end if;
    if NEW.status is null or NEW.status not in ('OK', 'DNS', 'DNF', 'DQ')
      or (NEW.status = 'OK' and (NEW.value is null or NEW.value <= 0))
      or (NEW.status <> 'OK' and NEW.value is not null) then
      raise exception 'สถานะและค่าผลกรีฑาไม่ถูกต้อง';
    end if;
    return NEW;
  end if;

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

drop trigger if exists matches_referee_result_scope on public.matches;
create trigger matches_referee_result_scope
before insert or update or delete on public.matches
for each row execute function public.enforce_referee_result_scope();

drop trigger if exists athletics_events_referee_result_scope on public.athletics_events;
create trigger athletics_events_referee_result_scope
before insert or update or delete on public.athletics_events
for each row execute function public.enforce_referee_result_scope();

drop trigger if exists athletics_results_referee_result_scope on public.athletics_results;
create trigger athletics_results_referee_result_scope
before insert or update or delete on public.athletics_results
for each row execute function public.enforce_referee_result_scope();

create policy matches_referee_scope
  on public.matches as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or referee_id = auth.uid()
  )
  with check (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or referee_id = auth.uid()
  );

create policy athletics_events_referee_scope
  on public.athletics_events as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or referee_id = auth.uid()
  )
  with check (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or referee_id = auth.uid()
  );

create policy athletics_results_referee_scope
  on public.athletics_results as restrictive for all to authenticated
  using (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.athletics_events e
      where e.id = event_id and e.referee_id = auth.uid()
    )
  )
  with check (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from public.athletics_events e
      where e.id = event_id and e.referee_id = auth.uid()
    )
  );

create policy competitions_referee_scope
  on public.competitions as restrictive for select to authenticated
  using (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or public.referee_can_access_competition(id)
  );

create policy registrations_referee_scope
  on public.registrations as restrictive for select to authenticated
  using (
    not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('recorder', 'referee')
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    or public.referee_can_access_competition(competition_id)
  );

commit;
