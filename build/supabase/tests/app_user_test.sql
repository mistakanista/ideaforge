-- Rule tests for public.app_user. Run with: npx supabase test db
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Start from an empty user table, independent of seed.sql (rolled back at the end)
delete from public.idea;  -- ideas reference their submitters (demo ideas from scripts/import_demo_ideas.sql)
delete from auth.users;

-- The test users use @example.com, which has to be on the sign-in allowlist (see 20261010083657_login.sql)
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Four Google logins: Priya (becomes admin), Ruth (becomes reviewer), Daniel (staff), one without a name
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'priya.shah@example.com', '{"full_name": "Priya Shah"}'),
  ('22222222-2222-2222-2222-222222222222', 'ruth.evans@example.com', '{"name": "Ruth Evans"}'),
  ('33333333-3333-3333-3333-333333333333', 'daniel.okafor@example.com', '{"full_name": "Daniel Okafor"}'),
  ('44444444-4444-4444-4444-444444444444', 'no.name@example.com', '{}');

-- Sign-up creates app_user rows
select is((select count(*) from public.app_user), 4::bigint, 'every Google login creates an app_user row');
select is((select role from public.app_user where email = 'daniel.okafor@example.com'), 'STAFF'::public.user_role, 'new users start as STAFF');
select is((select display_name from public.app_user where email = 'priya.shah@example.com'), 'Priya Shah', 'display name taken from full_name');
select is((select display_name from public.app_user where email = 'ruth.evans@example.com'), 'Ruth Evans', 'display name taken from name');
select is((select display_name from public.app_user where email = 'no.name@example.com'), 'no.name', 'display name falls back to the email prefix');
select is((select office from public.app_user where email = 'daniel.okafor@example.com'), null, 'office is empty after the first login');
select throws_ok(
  $$ insert into public.app_user (auth_user_id, email, display_name, role) values (gen_random_uuid(), 'x@example.com', 'X', 'REVIEWER') $$,
  'New users always start as STAFF', 'a user cannot be created directly as reviewer');

-- Roles set in the SQL editor (no signed-in app user)
select lives_ok(
  $$ update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com' $$,
  'bootstrap: the first admin can be set without role_changed_by');
select throws_ok(
  $$ update public.app_user set role = 'ADMIN' where email = 'daniel.okafor@example.com' $$,
  'Role ADMIN can only be granted by an admin', 'a second admin needs a granting admin');
select throws_like(
  $$ update public.app_user set role = 'REVIEWER',
       role_changed_by = (select user_id from public.app_user where email = 'daniel.okafor@example.com')
     where email = 'no.name@example.com' $$,
  '%is not an active admin%', 'a staff member cannot grant roles');
select lives_ok(
  $$ update public.app_user set role = 'REVIEWER',
       role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
     where email = 'ruth.evans@example.com' $$,
  'an admin can make a user reviewer');
select isnt((select role_changed_at from public.app_user where email = 'ruth.evans@example.com'), null, 'role_changed_at is set');
select throws_ok(
  $$ update public.app_user set office = 'bristol office' where email = 'ruth.evans@example.com' $$,
  '23514', null, 'office codes must be upper case letters, digits or _');

-- Signed in as staff member Daniel (through the API)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is((select count(*) from public.app_user), 4::bigint, 'signed-in users can read all users');
select lives_ok(
  $$ update public.app_user set office = 'BRISTOL', display_name = 'Dan Okafor' where email = 'daniel.okafor@example.com' $$,
  'users can change their own office and name');
select throws_ok(
  $$ update public.app_user set role = 'ADMIN' where email = 'daniel.okafor@example.com' $$,
  'Only admins can change roles or deactivate users', 'users cannot change their own role');
select results_eq(
  $$ with changed as (update public.app_user set display_name = 'Hacked' where email = 'priya.shah@example.com' returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$, 'users cannot change other users');
select throws_ok(
  $$ insert into public.app_user (auth_user_id, email, display_name) values (gen_random_uuid(), 'y@example.com', 'Y') $$,
  '42501', null, 'users cannot insert app_user rows');

-- Signed in as reviewer Ruth
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select results_eq(
  $$ with changed as (update public.app_user set role = 'REVIEWER' where email = 'no.name@example.com' returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$, 'reviewers cannot change roles of other users');

-- Signed in as admin Priya
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ update public.app_user set role = 'REVIEWER' where email = 'daniel.okafor@example.com' $$,
  'admins can change roles through the API');
select throws_ok(
  $$ update public.app_user set role = 'STAFF' where email = 'priya.shah@example.com' $$,
  'The last active admin cannot be downgraded or deactivated', 'the last admin cannot be downgraded');
select throws_ok(
  $$ update public.app_user set is_active = false where email = 'priya.shah@example.com' $$,
  'The last active admin cannot be downgraded or deactivated', 'the last admin cannot be deactivated');

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select * from public.app_user $$, '42501', null, 'anonymous visitors cannot read users');
reset role;

-- Checks made as the database owner again
select is(
  (select role_changed_by from public.app_user where email = 'daniel.okafor@example.com'),
  (select user_id from public.app_user where email = 'priya.shah@example.com'),
  'role_changed_by is set to the signed-in admin automatically');

select * from finish();
rollback;
