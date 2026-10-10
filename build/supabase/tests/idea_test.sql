-- Rule tests for public.category and public.idea (US-1 Submit an idea).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Start from an empty user table, independent of seed.sql (rolled back at the end)
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
  'Resubmissions are not possible yet', 'resubmissions are not possible through the API yet');
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
