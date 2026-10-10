-- Checks the local demo data: the users created by seed.sql (US-0 step 2: 12 dummy users and the
-- client admin Dev Anand) and the 60 demo ideas from scripts/import_demo_ideas.sql (US-1).
-- Run after `npx supabase db reset`. Read-only checks, rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select is((select count(*) from auth.users where email like '%@tallis.uk'), 13::bigint, '13 demo users exist in Supabase Auth');
select is((select count(*) from public.app_user where email like '%@tallis.uk'), 13::bigint, 'each demo user has an app_user row');
select is(
  (select count(*) from auth.users where email like '%@tallis.uk'
     and encrypted_password = extensions.crypt('tallis123', encrypted_password)),
  13::bigint, 'all demo users have the initial password tallis123 (bcrypt)');
select is(
  (select count(*) from auth.users where email like '%@tallis.uk' and email_confirmed_at is not null),
  13::bigint, 'all demo users are confirmed');
select is(
  (select count(*) from auth.identities i join auth.users u on u.id = i.user_id
    where u.email like '%@tallis.uk' and i.provider = 'email'),
  13::bigint, 'all demo users have an email identity (needed for password login)');
select is(
  (select count(*) from public.app_user where email like '%@tallis.uk' and must_change_password),
  13::bigint, 'all demo users must change their password at the first login');
select is(
  (select count(*) from public.app_user where email like '%@tallis.uk' and office is null),
  0::bigint, 'all demo users have an office');
select results_eq(
  $$ select display_name || ' / ' || office from public.app_user where role = 'ADMIN' order by email $$,
  $$ values ('Dev Anand / BRISTOL'), ('Priya Shah / BRISTOL') $$,
  'Dev Anand and Priya Shah are the local admins in Bristol');
select is(
  (select a.email from public.app_user d join public.app_user a on a.user_id = d.role_changed_by
    where d.email = 'dev.anand@tallis.uk'),
  'priya.shah@tallis.uk', 'Dev Anand was made admin by Priya Shah');
select results_eq(
  $$ select email from public.app_user where role = 'REVIEWER' order by email $$,
  $$ values ('aisha.rahman@tallis.uk'), ('ruth.evans@tallis.uk'), ('tom.hallworth@tallis.uk') $$,
  'Aisha, Ruth and Tom are reviewers');
select is(
  (select count(*) from public.app_user where email like '%@tallis.uk' and role = 'STAFF'),
  8::bigint, 'the other 8 users are staff');

-- Demo ideas (same as the mock data in build/frontend/src/data/seed.ts)
select is((select count(*) from public.idea), 60::bigint, '60 demo ideas exist');
select results_eq(
  $$ select min(idea_id), max(idea_id) from public.idea $$,
  $$ values (1::bigint, 60::bigint) $$, 'the demo ideas keep the mock ids 1 to 60');
select results_eq(
  $$ select i.current_stage::text, count(*) from public.idea i group by i.current_stage order by i.current_stage $$,
  $$ values ('SUBMITTED', 17::bigint), ('UNDER_REVIEW', 17::bigint), ('PILOTING', 13::bigint),
            ('IMPLEMENTED', 7::bigint), ('DECLINED', 6::bigint) $$,
  'the stages are the same as in the mock data');
select is((select count(*) from public.idea where is_confidential), 8::bigint, '8 demo ideas are confidential');
select is(
  (select count(*) from public.idea i join public.app_user u on u.user_id = i.submitter_id where i.office <> u.office),
  0::bigint, 'every idea has the office of its submitter');
select results_eq(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id)
     values ('New idea', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'daniel.okafor@tallis.uk'))
     returning idea_id $$,
  $$ values (61::bigint) $$, 'a new idea continues with id 61');

select * from finish();
rollback;
