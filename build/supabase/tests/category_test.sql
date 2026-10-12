-- Rule tests for admin changes of public.category (US-5 Admin features).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Start from an empty user table, independent of seed.sql (rolled back at the end)
delete from public.vote;
delete from public.idea_transition;
delete from public.idea;
delete from auth.users;
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam (staff), Ruth (reviewer), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('c0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('c0000000-0000-0000-0000-000000000003', 'priya.shah@example.com', '{"full_name": "Priya Shah"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email = 'ruth.evans@example.com';

-- Signed in as staff member Sam
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.category (name) values ('Staff category') $$,
  '42501', null, 'staff cannot add categories');
select results_eq(
  $$ with changed as (update public.category set name = 'Hacked' where name = 'Sustainability' returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$, 'staff cannot change categories');

-- Signed in as reviewer Ruth
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.category (name) values ('Reviewer category') $$,
  '42501', null, 'reviewers cannot add categories');
select results_eq(
  $$ with changed as (update public.category set is_active = false returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$, 'reviewers cannot change categories');

-- Signed in as admin Priya
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.category (name, description) values ('  Health and safety ', '  Keeping people safe.  ') $$,
  'an admin can add a category');
select is((select name from public.category where category_id = (select max(category_id) from public.category)),
  'Health and safety', 'the name is trimmed');
select is((select description from public.category where name = 'Health and safety'),
  'Keeping people safe.', 'the description is trimmed');
select is((select sort_order from public.category where name = 'Health and safety'),
  5::smallint, 'a new category goes to the end of the list');
select is((select is_active from public.category where name = 'Health and safety'),
  true, 'a new category is active');
select lives_ok(
  $$ insert into public.category (name, description, is_active) values ('Archive', '', false) $$,
  'an admin can add an inactive category');
select is((select description from public.category where name = 'Archive'),
  null, 'an empty description is stored as NULL');
select throws_ok(
  $$ insert into public.category (name) values ('SUSTAINABILITY') $$,
  '23505', null, 'category names are unique, ignoring case');
select throws_ok(
  $$ insert into public.category (name) values ('   ') $$,
  '23514', null, 'a category needs a name');
select lives_ok(
  $$ update public.category set name = 'Environment', description = 'Greener offices.' where name = 'Sustainability' $$,
  'an admin can edit name and description');
select is((select name from public.category where category_id = 3), 'Environment', 'the edit is stored');
select lives_ok(
  $$ update public.category set is_active = false where name = 'Environment' $$,
  'an admin can mark a category inactive');
select throws_ok(
  $$ update public.category set sort_order = 99 where name = 'Environment' $$,
  '42501', null, 'the sort order cannot be changed through the API');
select throws_ok(
  $$ update public.category set category_id = 99 where name = 'Environment' $$,
  '428C9', null, 'the category id cannot be changed');
select throws_ok(
  $$ delete from public.category where name = 'Environment' $$,
  '42501', null, 'categories cannot be deleted, only marked inactive');

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok(
  $$ insert into public.category (name) values ('Anon category') $$,
  '42501', null, 'anonymous visitors cannot add categories');
reset role;

select * from finish();
rollback;
