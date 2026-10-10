-- Checks the local demo users created by seed.sql (US-0 step 2): 12 dummy users and the client admin Dev Anand.
-- Run after `npx supabase db reset`. Read-only checks, rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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

select * from finish();
rollback;
