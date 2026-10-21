-- Rule tests for public.idea_relation (US-13 Relate ideas).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Start from empty tables, independent of seed.sql (rolled back at the end)
delete from public.comment;
delete from public.vote;
delete from public.idea_transition;
delete from public.idea_relation;
delete from public.idea;
delete from auth.users;
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam and Lena (staff), Ruth (reviewer), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('e0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('e0000000-0000-0000-0000-000000000003', 'lena.fischer@example.com', '{"full_name": "Lena Fischer"}'),
  ('e0000000-0000-0000-0000-000000000004', 'priya.shah@example.com', '{"full_name": "Priya Shah"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email = 'ruth.evans@example.com';

-- Ideas (created as the database owner): Sam's car pool, Lena's ride sharing, Ruth's bike racks,
-- Sam's confidential salary bands, Lena's declined idea
insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, is_confidential) values
  ('Shared car pool', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false),
  ('Ride sharing', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'lena.fischer@example.com'), false),
  ('Bike racks', 'p', 's', 'i', 3, (select user_id from public.app_user where email = 'ruth.evans@example.com'), false),
  ('Salary bands', 'p', 's', 'i', 4, (select user_id from public.app_user where email = 'sam.taylor@example.com'), true),
  ('Old idea', 'p', 's', 'i', 2, (select user_id from public.app_user where email = 'lena.fischer@example.com'), false);
alter table public.idea disable trigger trg_idea_check;
update public.idea set current_stage = 'DECLINED' where title = 'Old idea';
alter table public.idea enable trigger trg_idea_check;

-- Lena (staff, through the API)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Ride sharing'),
             (select idea_id from public.idea where title = 'Shared car pool'), 'DUPLICATES') $$,
  'Only reviewers can relate ideas', 'staff cannot relate ideas');

-- Priya (admin)
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Ride sharing'),
             (select idea_id from public.idea where title = 'Shared car pool'), 'DUPLICATES') $$,
  'Only reviewers can relate ideas', 'admins cannot relate ideas');

-- Ruth (reviewer)
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type, created_by, created_at)
     values ((select idea_id from public.idea where title = 'Ride sharing'),
             (select idea_id from public.idea where title = 'Shared car pool'), 'DUPLICATES',
             (select user_id from public.app_user where email = 'sam.taylor@example.com'), '2020-01-01') $$,
  'a reviewer can relate two ideas');
select is((select created_by from public.idea_relation),
  (select user_id from public.app_user where email = 'ruth.evans@example.com'), 'created_by is always the signed-in reviewer');
select ok((select created_at > '2020-01-01' from public.idea_relation), 'created_at is set by the database');
select lives_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Bike racks'),
             (select idea_id from public.idea where title = 'Shared car pool'), 'RELATED_TO') $$,
  'a reviewer can relate their own idea');
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Shared car pool'),
             (select idea_id from public.idea where title = 'Shared car pool'), 'RELATED_TO') $$,
  '23514', null, 'an idea cannot be related to itself');
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Ride sharing'),
             (select idea_id from public.idea where title = 'Shared car pool'), 'REPLACES') $$,
  '23505', null, 'a pair of ideas has only one relation');
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Shared car pool'),
             (select idea_id from public.idea where title = 'Ride sharing'), 'REPLACES') $$,
  '23505', null, 'the opposite direction counts as the same pair');
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Salary bands'),
             (select idea_id from public.idea where title = 'Ride sharing'), 'RELATED_TO') $$,
  'Confidential ideas cannot be related', 'a confidential idea cannot be the first idea');
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Ride sharing'),
             (select idea_id from public.idea where title = 'Salary bands'), 'RELATED_TO') $$,
  'Confidential ideas cannot be related', 'a confidential idea cannot be the second idea');
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Ride sharing'),
             (select idea_id from public.idea where title = 'Old idea'), 'REPLACES') $$,
  'Declined ideas cannot be related', 'a declined idea cannot be related');
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type)
     values ((select idea_id from public.idea where title = 'Ride sharing'), 999999, 'RELATED_TO') $$,
  'Idea 999999 does not exist', 'the other idea must exist');
select throws_ok(
  $$ update public.idea_relation set relation_type = 'RELATED_TO' $$,
  '42501', null, 'relations cannot be changed through the API');
select throws_ok(
  $$ delete from public.idea_relation $$,
  '42501', null, 'relations cannot be removed through the API');

-- Everybody sees all relations (Lena, staff)
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select is((select count(*) from public.idea_relation), 2::bigint, 'staff see all relations');
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select is((select count(*) from public.idea_relation), 2::bigint, 'admins see all relations');

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select * from public.idea_relation $$, '42501', null, 'anonymous visitors cannot read relations');
reset role;
select set_config('request.jwt.claims', '', true);  -- no signed-in user any more

-- Checks made as the database owner (e.g. an import script): created_by must be a reviewer
select throws_ok(
  $$ insert into public.idea_relation (idea_id, related_idea_id, relation_type, created_by)
     values ((select idea_id from public.idea where title = 'Bike racks'),
             (select idea_id from public.idea where title = 'Ride sharing'), 'RELATED_TO',
             (select user_id from public.app_user where email = 'lena.fischer@example.com')) $$,
  'Only reviewers can relate ideas', 'the reviewer rule also applies without the API');

select * from finish();
rollback;
