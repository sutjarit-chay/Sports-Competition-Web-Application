-- Read-only inspection of the user's normalized schema. No migration or data changes.
select t.relname as table_name, t.relrowsecurity as rls_enabled
from pg_class t join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public' and t.relname in
('schools','profiles','competitions','registrations','matches','athletics_events','athletics_results','medals','team_files')
order by t.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname='public'
order by tablename, policyname;

select t.relname as table_name, c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c join pg_class t on t.oid=c.conrelid
join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public' and t.relname in
('schools','profiles','competitions','registrations','matches','athletics_events','athletics_results','medals')
order by t.relname,c.conname;
