-- Rule tests for US-0 step 1: sign-in allowlist and must_change_password.
-- Run against the local Supabase (see README / build log). Everything is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Start from an empty user table, independent of seed.sql (rolled back at the end)
delete from auth.users;

-- ---------------------------------------------------------------------
-- Sign-in allowlist
-- ---------------------------------------------------------------------
select is((select count(*) from public.login_allowlist where entry = '@tallis.uk'), 1::bigint, '@tallis.uk is on the allowlist');

select lives_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data) values
       ('a0000000-0000-0000-0000-000000000001', 'priya.shah@tallis.uk', '{"full_name": "Priya Shah"}') $$,
  'a @tallis.uk user can sign up');
select is((select count(*) from public.app_user where email = 'priya.shah@tallis.uk'), 1::bigint, 'the @tallis.uk user gets an app_user row');
select lives_ok(
  $$ insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000002', 'Daniel.Okafor@TALLIS.UK') $$,
  'the domain check ignores upper and lower case');
select throws_ok(
  $$ insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000003', 'someone@gmail.com') $$,
  'Access is restricted to Tallis & Reeve staff', 'other Google accounts are rejected');
select throws_ok(
  $$ insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000004', 'fake@nottallis.uk') $$,
  'Access is restricted to Tallis & Reeve staff', 'look-alike domains are rejected');
select throws_ok(
  $$ insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000005', 'fake@tallis.uk.evil.com') $$,
  'Access is restricted to Tallis & Reeve staff', 'domains that only start with tallis.uk are rejected');
select throws_ok(
  $$ insert into auth.users (id, phone) values ('a0000000-0000-0000-0000-000000000006', '+4400000000') $$,
  'Access is restricted to Tallis & Reeve staff', 'users without an email are rejected');

insert into public.login_allowlist (entry, note) values ('dev.colleague@gmail.com', 'developer test account');
select lives_ok(
  $$ insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000007', 'dev.colleague@gmail.com') $$,
  'a single allowlisted email can sign up');
select throws_ok(
  $$ insert into auth.users (id, email) values ('a0000000-0000-0000-0000-000000000008', 'another.dev@gmail.com') $$,
  'Access is restricted to Tallis & Reeve staff', 'other addresses of the same domain stay blocked');
select throws_ok(
  $$ insert into public.login_allowlist (entry) values ('Upper@Gmail.com') $$,
  '23514', null, 'allowlist entries must be lower case');

-- ---------------------------------------------------------------------
-- must_change_password
-- ---------------------------------------------------------------------
select is((select must_change_password from public.app_user where auth_user_id = 'a0000000-0000-0000-0000-000000000002'), false, 'the flag is false by default');

-- Priya becomes admin (bootstrap), Daniel gets an initial password that must be changed
update public.app_user set role = 'ADMIN' where email = 'priya.shah@tallis.uk';
update public.app_user set must_change_password = true where auth_user_id = 'a0000000-0000-0000-0000-000000000002';

update auth.users set last_sign_in_at = now() where id = 'a0000000-0000-0000-0000-000000000002';
select is((select must_change_password from public.app_user where auth_user_id = 'a0000000-0000-0000-0000-000000000002'), true, 'a login without password change keeps the flag');

-- Signed in as Daniel (through the API)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ update public.app_user set must_change_password = false where auth_user_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'Only admins can change must_change_password', 'users cannot clear the flag without changing the password');
select throws_ok($$ select * from public.login_allowlist $$, '42501', null, 'users cannot read the allowlist');
select throws_ok($$ select public.is_login_allowed('x@tallis.uk') $$, '42501', null, 'users cannot call the allowlist check');
reset role;

-- Daniel changes his password in Supabase Auth (the request still carries his JWT)
update auth.users set encrypted_password = 'new-bcrypt-hash' where id = 'a0000000-0000-0000-0000-000000000002';
select is((select must_change_password from public.app_user where auth_user_id = 'a0000000-0000-0000-0000-000000000002'), false, 'a real password change clears the flag');

-- Signed in as admin Priya
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select lives_ok(
  $$ update public.app_user set must_change_password = true where auth_user_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'admins can require a password change');
reset role;
select is((select must_change_password from public.app_user where auth_user_id = 'a0000000-0000-0000-0000-000000000002'), true, 'the flag is set again by the admin');

select * from finish();
rollback;
