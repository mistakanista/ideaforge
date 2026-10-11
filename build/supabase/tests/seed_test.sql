-- Checks the local demo data: the users created by seed.sql (US-0 step 2: 12 dummy users and the
-- client admin Dev Anand) the 60 demo ideas from scripts/import_demo_ideas.sql (US-1) and their review history
-- from scripts/import_demo_transitions.sql (US-3) and their votes from scripts/import_demo_votes.sql (US-4).
-- Run after `npx supabase db reset`. Read-only checks, rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

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
-- Review history (US-3)
select is((select count(*) from public.idea_transition), 75::bigint, '75 demo transitions exist (69 moves, 6 declines)');
select is(
  (select count(*) from public.idea_transition
   where to_stage = 'DECLINED' and reason is not null and score_impact is null),
  6::bigint, 'the 6 declines have a reason and no scores');
select is(
  (select count(*) from public.idea i
   where i.current_stage is distinct from coalesce(
     (select t.to_stage from public.idea_transition t where t.idea_id = i.idea_id
      order by t.created_at desc, t.transition_id desc limit 1), 'SUBMITTED')),
  0::bigint, 'the last transition of every idea leads to its current stage');
select is(
  (select count(*) from public.idea_transition t join public.idea i using (idea_id) where t.changed_by = i.submitter_id),
  0::bigint, 'no reviewer moved their own idea');
select is(
  (select count(*) from public.idea_transition t join public.idea i using (idea_id) where t.created_at <= i.created_at),
  0::bigint, 'every transition happened after the idea was submitted');
-- Votes (US-4)
select is((select count(*) from public.vote), 239::bigint, '239 demo votes exist');
select is((select count(distinct idea_id) from public.vote), 50::bigint, 'the demo votes are on 50 ideas');
select is(
  (select count(*) from public.vote v join public.idea i using (idea_id) where v.user_id = i.submitter_id),
  0::bigint, 'nobody voted for their own idea');
select is(
  (select count(*) from public.vote v join public.idea i using (idea_id) where i.is_confidential),
  0::bigint, 'no confidential idea has votes');
select results_eq(
  $$ select count(*) from public.vote where idea_id = 1 $$,
  $$ values (9::bigint) $$, 'idea 1 has the 10 votes of the mock data minus the own vote of its submitter');
select results_eq(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id)
     values ('New idea', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'daniel.okafor@tallis.uk'))
     returning idea_id $$,
  $$ values (61::bigint) $$, 'a new idea continues with id 61');

select * from finish();
rollback;
