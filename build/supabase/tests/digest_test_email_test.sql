-- Rule tests for the digest test email (US-12): public.is_first_working_day and public.send_digest_test.
-- Everything runs in one transaction and is rolled back at the end (queued HTTP requests too, so no mail is sent).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Start from empty tables, independent of seed.sql (rolled back at the end)
delete from public.email_log;
delete from public.comment;
delete from public.vote;
delete from public.idea_transition;
delete from public.idea;
delete from auth.users;
delete from vault.secrets where name in ('mail_function_url', 'mail_function_secret', 'app_url', 'digest_test_recipient');
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam (staff), Ruth (reviewer), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('f0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('f0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('f0000000-0000-0000-0000-000000000003', 'priya.shah@example.com', '{"full_name": "Priya Shah"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email = 'ruth.evans@example.com';

-- One reviewed idea in October 2026 (created as the database owner, so the time can be set)
insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id)
values ('Shared car pool', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com'));
insert into public.idea_transition (idea_id, to_stage, changed_by, created_at, score_impact, score_cost, score_feasibility)
values ((select idea_id from public.idea), 'UNDER_REVIEW',
        (select user_id from public.app_user where email = 'ruth.evans@example.com'), '2026-10-10 10:00+00', 3, 4, 5);

-- First working day: Monday to Friday only
select is(public.is_first_working_day('2026-10-01'), true, '2026-10-01 (Thursday) is the first working day of October');
select is(public.is_first_working_day('2026-10-02'), false, '2026-10-02 is not');
select is(public.is_first_working_day('2026-08-01'), false, '2026-08-01 is a Saturday');
select is(public.is_first_working_day('2026-08-02'), false, '2026-08-02 is a Sunday');
select is(public.is_first_working_day('2026-08-03'), true, 'a month that starts on a Saturday: the Monday the 3rd');
select is(public.is_first_working_day('2026-11-01'), false, '2026-11-01 is a Sunday');
select is(public.is_first_working_day('2026-11-02'), true, 'a month that starts on a Sunday: the Monday the 2nd');
select is(public.is_first_working_day('2026-11-03'), false, 'the day after the first working day is not');

-- Staff and anonymous visitors cannot call it
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "f0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select public.send_digest_test('2026-11-02') $$, 'Only admins can send the digest test', 'staff cannot send the test mail');
set local role anon;
select throws_ok($$ select public.send_digest_test('2026-11-02') $$, '42501', null, 'anonymous visitors cannot call the function');
set local role authenticated;

-- Priya, the admin
select set_config('request.jwt.claims', '{"sub": "f0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select is(public.send_digest_test('2026-11-01'), 'NOT_FIRST_WORKING_DAY', 'on a Sunday 1st nothing is sent');
select is(public.send_digest_test('2026-10-15'), 'NOT_FIRST_WORKING_DAY', 'in the middle of the month nothing is sent');
select is(public.send_digest_test('2026-11-02'), 'NOT_CONFIGURED', 'without the recipient setting nothing is sent');
reset role;
select is((select count(*)::int from public.email_log), 0, 'no mail and no log row so far');

-- Recipient set, function settings missing: logged, not requested
select vault.create_secret('digest.test@example.com', 'digest_test_recipient');
set local role authenticated;
select is(public.send_digest_test('2026-11-02'), 'NOT_CONFIGURED', 'without the function settings the result is NOT_CONFIGURED');
reset role;
select is((select status from public.email_log), 'NOT_CONFIGURED', 'the log row says NOT_CONFIGURED');

-- All settings present: a request is queued
select vault.create_secret('http://localhost/functions/v1/send-email', 'mail_function_url');
select vault.create_secret('test-secret', 'mail_function_secret');
set local role authenticated;
select is(public.send_digest_test('2026-11-02'), 'QUEUED', 'on the first working day the mail is queued');
reset role;
select is((select to_email || ' / ' || status from public.email_log order by log_id desc limit 1),
  'digest.test@example.com / PENDING', 'the recipient comes from the vault setting; the status is PENDING');
select ok((select convert_from(body, 'UTF8')::jsonb ->> 'text' from net.http_request_queue) like '%1. Shared car pool%Total 12: 12 rating points from 1 review(s) + 0 vote(s)%',
  'the mail lists the top ideas with their total');

select * from finish();
rollback;
