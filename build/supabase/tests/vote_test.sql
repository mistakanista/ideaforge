-- Rule tests for public.vote (US-4 Vote ideas).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Start from empty tables, independent of seed.sql (rolled back at the end)
delete from public.vote;
delete from public.idea_transition;
delete from public.idea;
delete from auth.users;
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam and Lena (staff), Ruth (reviewer), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('d0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('d0000000-0000-0000-0000-000000000003', 'lena.fischer@example.com', '{"full_name": "Lena Fischer"}'),
  ('d0000000-0000-0000-0000-000000000004', 'priya.shah@example.com', '{"full_name": "Priya Shah"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email = 'ruth.evans@example.com';

-- Ideas (created as the database owner): two by Sam (one confidential), one by Ruth
insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, is_confidential) values
  ('Shared car pool', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false),
  ('Salary bands', 'p', 's', 'i', 4, (select user_id from public.app_user where email = 'sam.taylor@example.com'), true),
  ('Bike racks', 'p', 's', 'i', 3, (select user_id from public.app_user where email = 'ruth.evans@example.com'), false);

-- Signed in as Lena (staff, through the API)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.vote (idea_id, user_id, created_at)
     values ((select idea_id from public.idea where title = 'Shared car pool'),
             (select user_id from public.app_user where email = 'priya.shah@example.com'), '2020-01-01') $$,
  'a staff member can vote for an idea');
select is((select user_id from public.vote),
  (select user_id from public.app_user where email = 'lena.fischer@example.com'), 'the voter is always the signed-in user');
select ok((select created_at > '2020-01-01' from public.vote), 'created_at is set by the database');
select throws_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Shared car pool')) $$,
  '23505', null, 'only one vote per person per idea');
select throws_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Salary bands')) $$,
  'Idea ' || (select idea_id from public.idea where title = 'Salary bands' limit 1) || ' does not exist',
  'staff cannot vote for a confidential idea of someone else');
select lives_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Bike racks')) $$,
  'a staff member can vote for a reviewer''s idea');

-- Sam, the submitter
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Shared car pool')) $$,
  'You cannot vote for your own idea', 'a user cannot vote for their own idea');
select throws_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Salary bands')) $$,
  'You cannot vote for your own idea', 'a user cannot vote for their own confidential idea');

-- Ruth, the reviewer
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Salary bands')) $$,
  'Confidential ideas cannot get votes', 'a reviewer cannot vote for a confidential idea either');
select lives_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Shared car pool')) $$,
  'a reviewer can vote for someone else''s idea');
select throws_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Bike racks')) $$,
  'You cannot vote for your own idea', 'a reviewer cannot vote for their own idea');

-- Priya, the admin
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.vote (idea_id) values ((select idea_id from public.idea where title = 'Shared car pool')) $$,
  'an admin can vote');

-- Visibility: 4 votes in total, none on the confidential idea "Salary bands"
select is((select count(*) from public.vote), 4::bigint, 'everyone sees the votes of visible ideas');
select is((select count(*) from public.vote v join public.idea i using (idea_id) where i.is_confidential), 0::bigint,
  'no confidential idea has votes');

-- Taking a vote back (Lena)
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
delete from public.vote where idea_id = (select idea_id from public.idea where title = 'Shared car pool')
  and user_id = (select user_id from public.app_user where email = 'priya.shah@example.com');
select is((select count(*) from public.vote), 4::bigint, 'a user cannot take back someone else''s vote');
delete from public.vote where idea_id = (select idea_id from public.idea where title = 'Shared car pool');
select results_eq(
  $$ select i.title from public.vote v join public.idea i using (idea_id) order by i.title $$,
  $$ values ('Bike racks'), ('Shared car pool'), ('Shared car pool') $$,
  'a user can take back their own vote, and only their own');
select throws_ok(
  $$ update public.vote set created_at = now() $$,
  '42501', null, 'votes cannot be changed through the API');

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select * from public.vote $$, '42501', null, 'anonymous visitors cannot read votes');
reset role;
select set_config('request.jwt.claims', '', true);  -- no signed-in user any more

-- Checks made as the database owner (e.g. an import script)
select throws_ok(
  $$ insert into public.vote (idea_id, user_id)
     values ((select idea_id from public.idea where title = 'Bike racks'),
             (select user_id from public.app_user where email = 'ruth.evans@example.com')) $$,
  'You cannot vote for your own idea', 'the own-idea rule also applies without the API');
select throws_ok(
  $$ insert into public.vote (idea_id, user_id)
     values ((select idea_id from public.idea where title = 'Salary bands'),
             (select user_id from public.app_user where email = 'ruth.evans@example.com')) $$,
  'Confidential ideas cannot get votes', 'the confidential rule also applies without the API');
update public.app_user set is_active = false where email = 'lena.fischer@example.com';
select throws_ok(
  $$ insert into public.vote (idea_id, user_id)
     values ((select idea_id from public.idea where title = 'Salary bands'),
             (select user_id from public.app_user where email = 'lena.fischer@example.com')) $$,
  'Only active users can vote', 'deactivated users cannot vote');

select * from finish();
rollback;
