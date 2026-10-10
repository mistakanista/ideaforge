-- Checks the local demo users created by seed.sql (US-0 step 2).
-- Run after `npx supabase db reset`. Read-only checks, rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select is((select count(*) from auth.users where email like '%@tallis.uk'), 12::bigint, '12 dummy users exist in Supabase Auth');
select is((select count(*) from public.app_user where email like '%@tallis.uk'), 12::bigint, 'each dummy user has an app_user row');
select is(
  (select count(*) from auth.users where email like '%@tallis.uk'
     and encrypted_password = extensions.crypt('tallis123', encrypted_password)),
  12::bigint, 'all dummy users have the initial password tallis123 (bcrypt)');
select is(
  (select count(*) from auth.users where email like '%@tallis.uk' and email_confirmed_at is not null),
  12::bigint, 'all dummy users are confirmed');
select is(
  (select count(*) from auth.identities i join auth.users u on u.id = i.user_id
    where u.email like '%@tallis.uk' and i.provider = 'email'),
  12::bigint, 'all dummy users have an email identity (needed for password login)');
select is(
  (select count(*) from public.app_user where email like '%@tallis.uk' and must_change_password),
  12::bigint, 'all dummy users must change their password at the first login');
select is(
  (select count(*) from public.app_user where email like '%@tallis.uk' and office is null),
  0::bigint, 'all dummy users have an office');
select is(
  (select display_name || ' / ' || office || ' / ' || role from public.app_user where email = 'priya.shah@tallis.uk'),
  'Priya Shah / BRISTOL / ADMIN', 'Priya Shah is the local admin in Bristol');
select results_eq(
  $$ select email from public.app_user where role = 'REVIEWER' order by email $$,
  $$ values ('aisha.rahman@tallis.uk'), ('ruth.evans@tallis.uk'), ('tom.hallworth@tallis.uk') $$,
  'Aisha, Ruth and Tom are reviewers');
select is(
  (select count(*) from public.app_user where email like '%@tallis.uk' and role = 'STAFF'),
  8::bigint, 'the other 8 users are staff');

select * from finish();
rollback;
