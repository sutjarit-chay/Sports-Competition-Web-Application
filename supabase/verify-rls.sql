-- LEGACY schema verification only. Use inspect-hosted.sql for the normalized hosted database.
-- Run after schema installation. This verifies anonymous access and RLS activation.
-- Transaction rolls back. Run as postgres in SQL editor.
begin;
do $$ begin
 if exists(select 1 from pg_class where oid in ('public.schools'::regclass,'public.profiles'::regclass,'public.athletes'::regclass,'public.matches'::regclass,'public.races'::regclass,'public.awards'::regclass) and not relrowsecurity) then raise exception 'RLS is disabled'; end if;
end $$;
set local role anon;
select count(*) as visible_schools from public.schools; -- expected 10
select count(*) from public.matches;
-- profiles access must be denied (test separately outside this transaction).
rollback;
-- Manual authenticated acceptance checks, using 3 different real JWT sessions:
-- school 1: insert/read athlete school 1 succeeds, school 2 insert denied,
-- update school_id to 2 denied; matches/races/awards writes denied.
-- recorder: all athlete reads allowed, athlete writes denied, results writes allowed.
-- admin: school and athlete writes allowed.
-- all roles: profile writes denied; self-promotion must fail.
