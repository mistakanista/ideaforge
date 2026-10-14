-- Rule tests for public.category and public.idea (US-1 Submit an idea).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Start from an empty user table, independent of seed.sql (rolled back at the end)
delete from public.vote;  -- votes reference ideas and users (demo votes from scripts/import_demo_votes.sql)
delete from public.idea_transition;  -- transitions reference ideas (demo history from scripts/import_demo_transitions.sql)
delete from public.idea;  -- ideas reference their submitters (demo ideas from scripts/import_demo_ideas.sql)
delete from auth.users;
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam and Olivia (staff), Ruth (reviewer), Priya (admin), Noah (staff without office)
insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('b0000000-0000-0000-0000-000000000002', 'olivia.brown@example.com', '{"full_name": "Olivia Brown"}'),
  ('b0000000-0000-0000-0000-000000000003', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('b0000000-0000-0000-0000-000000000004', 'priya.shah@example.com', '{"full_name": "Priya Shah"}'),
  ('b0000000-0000-0000-0000-000000000005', 'noah.wilson@example.com', '{"full_name": "Noah Wilson"}');
update public.app_user set office = 'BRISTOL' where email = 'sam.taylor@example.com';
update public.app_user set office = 'LEEDS' where email in ('olivia.brown@example.com', 'ruth.evans@example.com', 'priya.shah@example.com');
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email = 'ruth.evans@example.com';

-- Categories
select results_eq(
  $$ select name from public.category order by sort_order $$,
  $$ values ('Client delivery'), ('Internal tools and processes'), ('Sustainability'), ('People and culture') $$,
  'the four categories exist in the right order');
update public.category set is_active = false where name = 'Sustainability';

-- Signed in as staff member Sam (through the API)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, office, current_stage, created_at)
     values ('Shared car pool', 'Many single car trips', 'A car pool board', 'Less travel cost', 1,
             (select user_id from public.app_user where email = 'olivia.brown@example.com'), 'GLASGOW', 'PILOTING', '2020-01-01') $$,
  'staff can submit an idea');
select is((select submitter_id from public.idea where title = 'Shared car pool'),
  (select user_id from public.app_user where email = 'sam.taylor@example.com'), 'the submitter is always the signed-in user');
select is((select office from public.idea where title = 'Shared car pool'), 'BRISTOL', 'the office is copied from the submitter');
select is((select current_stage from public.idea where title = 'Shared car pool'), 'SUBMITTED'::public.idea_stage, 'a new idea starts as SUBMITTED');
select ok((select created_at > '2020-01-01' from public.idea where title = 'Shared car pool'), 'created_at is set by the database');
select lives_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, is_confidential)
     values ('Salary bands', 'Pay is unclear', 'Publish salary bands', 'More trust', 4, true) $$,
  'staff can submit a confidential idea');
select is((select count(distinct idea_id) from public.idea), 2::bigint, 'every idea gets its own id');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id) values ('  ', 'p', 's', 'i', 1) $$,
  '23514', null, 'the title cannot be empty');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id) values ('Some idea', 'p', ' ', 'i', 1) $$,
  '23514', null, 'the proposed solution cannot be empty');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id)
     values ('Solar panels', 'p', 's', 'i', (select category_id from public.category where name = 'Sustainability')) $$,
  'Please choose an active category', 'an inactive category cannot be chosen');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, resubmission_of)
     values ('Shared car pool 2', 'p', 's', 'i', 1, (select idea_id from public.idea where title = 'Shared car pool')) $$,
  'Only a declined idea can get a second chance', 'an idea that is not declined cannot get a second chance');
select throws_ok(
  $$ update public.idea set title = 'Changed' where title = 'Shared car pool' $$,
  '42501', null, 'ideas cannot be changed through the API');
select throws_ok(
  $$ delete from public.idea where title = 'Shared car pool' $$,
  '42501', null, 'ideas cannot be deleted through the API');
select throws_ok(
  $$ insert into public.category (name) values ('New category') $$,
  '42501', null, 'staff cannot add categories');
select is((select count(*) from public.idea), 2::bigint, 'the submitter sees their own confidential idea');

-- Signed in as Noah (no office yet)
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000005", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id) values ('Some idea', 'p', 's', 'i', 1) $$,
  'Please set your office in your profile before submitting an idea', 'users without an office cannot submit');

-- Visibility of the confidential idea
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select results_eq($$ select title from public.idea $$, $$ values ('Shared car pool') $$,
  'other staff see normal ideas but not confidential ones');
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select is((select count(*) from public.idea), 2::bigint, 'reviewers see confidential ideas');
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select results_eq($$ select title from public.idea $$, $$ values ('Shared car pool') $$,
  'admins do not see confidential ideas');

-- Second chance through the API (US-6): own declined ideas only, once
reset role;
select set_config('request.jwt.claims', '', true);  -- the owner inserts for fixed submitters, no signed-in user
insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id) values
  ('Declined by Sam', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com')),
  ('Declined by Olivia', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'olivia.brown@example.com'));
select set_config('ideaforge.via_transition', 'on', true);  -- stage changes are only allowed through idea_transition; test setup shortcut
update public.idea set current_stage = 'DECLINED' where title like 'Declined by %';
select set_config('ideaforge.via_transition', 'off', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, resubmission_of)
     values ('Declined by Sam, improved', 'p', 's', 'i', 1, (select idea_id from public.idea where title = 'Declined by Sam')) $$,
  'the submitter can give their declined idea a second chance');
select is((select current_stage from public.idea where title = 'Declined by Sam, improved'), 'SUBMITTED'::public.idea_stage,
  'the second attempt starts as SUBMITTED');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, resubmission_of)
     values ('Declined by Sam, again', 'p', 's', 'i', 1, (select idea_id from public.idea where title = 'Declined by Sam')) $$,
  'This idea has already had its second chance', 'a second chance can be used only once');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, resubmission_of)
     values ('Olivia''s idea, improved by Sam', 'p', 's', 'i', 1, (select idea_id from public.idea where title = 'Declined by Olivia')) $$,
  'You can only give your own declined ideas a second chance', 'nobody else can resubmit a declined idea');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, resubmission_of)
     values ('Idea of nobody', 'p', 's', 'i', 1, 999999) $$,
  'You can only give your own declined ideas a second chance', 'an unknown original idea is rejected');

-- Anonymous ideas (US-11): a flag, set at submit time, never changed afterwards
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, is_anonymous)
     values ('Anonymous tip', 'p', 's', 'i', 1, true) $$,
  'staff can submit an anonymous idea');
select lives_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, is_anonymous, is_confidential)
     values ('Anonymous and confidential tip', 'p', 's', 'i', 1, true, true) $$,
  'an idea can be anonymous and confidential at the same time');
select is((select is_anonymous from public.idea where title = 'Shared car pool'), false, 'ideas are not anonymous by default');
select is((select submitter_id from public.idea where title = 'Anonymous tip'),
  (select user_id from public.app_user where email = 'sam.taylor@example.com'), 'the database still stores the submitter of an anonymous idea');
reset role;
select throws_ok(
  $$ update public.idea set is_anonymous = false where title = 'Anonymous tip' $$,
  'Only the stage of an idea can be changed', 'the anonymous flag cannot be changed afterwards');
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);  -- back to Priya (admin), needed for the deactivation below

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select * from public.idea $$, '42501', null, 'anonymous visitors cannot read ideas');
select throws_ok($$ select * from public.category $$, '42501', null, 'anonymous visitors cannot read categories');
reset role;

-- Deactivated users see nothing
update public.app_user set is_active = false where email = 'olivia.brown@example.com';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select is((select count(*) from public.idea), 0::bigint, 'deactivated users cannot read ideas');
reset role;
select set_config('request.jwt.claims', '', true);  -- no signed-in user any more

-- Checks made as the database owner (second chance, data integrity)
select lives_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, resubmission_of)
     values ('Shared car pool v2', 'p', 's', 'i', 1, (select submitter_id from public.idea where title = 'Shared car pool'),
             (select idea_id from public.idea where title = 'Shared car pool')) $$,
  'a second attempt can be stored');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, resubmission_of)
     values ('Shared car pool v3', 'p', 's', 'i', 1, (select submitter_id from public.idea where title = 'Shared car pool'),
             (select idea_id from public.idea where title = 'Shared car pool')) $$,
  '23505', null, 'an idea can be resubmitted only once');
select throws_ok(
  $$ insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, resubmission_of)
     values ('Shared car pool v3', 'p', 's', 'i', 1, (select submitter_id from public.idea where title = 'Shared car pool'),
             (select idea_id from public.idea where title = 'Shared car pool v2')) $$,
  'An idea can get only one second chance', 'there is no third attempt');
select throws_ok(
  $$ update public.idea set office = 'GLASGOW' where title = 'Shared car pool' $$,
  'Only the stage of an idea can be changed', 'only the stage of an idea can be changed');

select * from finish();
rollback;
