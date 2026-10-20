-- Rule tests for the review email (US-8, step 2): public.email_log and the trigger on idea_transition.
-- Everything runs in one transaction and is rolled back at the end (queued HTTP requests too, so no mail is sent).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Start from empty tables, independent of seed.sql (rolled back at the end)
delete from public.email_log;
delete from public.comment;
delete from public.vote;
delete from public.idea_transition;
delete from public.idea;
delete from auth.users;
delete from vault.secrets where name in ('mail_function_url', 'mail_function_secret', 'app_url');
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam (staff), Ruth (reviewer), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('e0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('e0000000-0000-0000-0000-000000000003', 'priya.shah@example.com', '{"full_name": "Priya Shah"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email = 'ruth.evans@example.com';

insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, is_anonymous) values
  ('Shared car pool', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false),
  ('Bike racks', 'p', 's', 'i', 3, (select user_id from public.app_user where email = 'sam.taylor@example.com'), true),
  ('Paperless office', 'p', 's', 'i', 2, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false),
  ('Free fruit', 'p', 's', 'i', 2, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false);

-- A review by SQL (import, no signed-in user) sends no mail
insert into public.idea_transition (idea_id, to_stage, changed_by, score_impact, score_cost, score_feasibility)
values ((select idea_id from public.idea where title = 'Free fruit'), 'UNDER_REVIEW',
        (select user_id from public.app_user where email = 'ruth.evans@example.com'), 3, 3, 3);
select is((select count(*)::int from public.email_log), 0, 'an import without a signed-in user sends no mail');

-- Ruth, the reviewer, signed in through the API
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);

-- Settings missing: the mail is logged, but nothing is requested
insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility, reason)
values ((select idea_id from public.idea where title = 'Shared car pool'), 'UNDER_REVIEW', 4, 3, 5, 'Looks promising');
reset role;
select is((select count(*)::int from public.email_log), 1, 'a review creates one log row');
select is((select to_email from public.email_log), 'sam.taylor@example.com', 'the mail goes to the submitter');
select is((select status from public.email_log), 'NOT_CONFIGURED', 'without vault settings the status is NOT_CONFIGURED');
select is((select count(*)::int from net.http_request_queue), 0, 'without vault settings no request is queued');

-- Settings present: a request is queued for the Edge Function
select vault.create_secret('http://localhost/functions/v1/send-email', 'mail_function_url');
select vault.create_secret('test-secret', 'mail_function_secret');
select vault.create_secret('https://ideaforge.example.com', 'app_url');
set local role authenticated;
insert into public.idea_transition (idea_id, to_stage, reason)
values ((select idea_id from public.idea where title = 'Paperless office'), 'DECLINED', 'Too expensive for now');
reset role;
select is((select status from public.email_log order by log_id desc limit 1), 'PENDING', 'with settings the status is PENDING until the function reports');
select is((select count(*)::int from net.http_request_queue), 1, 'one request is queued');
select is((select url from net.http_request_queue), 'http://localhost/functions/v1/send-email', 'the request goes to the function URL');
select is((select convert_from(body, 'UTF8')::jsonb ->> 'to' from net.http_request_queue), 'sam.taylor@example.com', 'the request has the recipient');
select ok((select convert_from(body, 'UTF8')::jsonb ->> 'text' from net.http_request_queue) like '%Reason: Too expensive for now%',
  'a decline mail contains the reason');
select ok((select convert_from(body, 'UTF8')::jsonb ->> 'text' from net.http_request_queue) like '%https://ideaforge.example.com%',
  'the mail contains the app link');
select ok((select convert_from(body, 'UTF8')::jsonb ->> 'text' from net.http_request_queue) not like '%Ruth%',
  'the mail does not name the reviewer');
select is((select (headers ->> 'x-mail-secret') from net.http_request_queue), 'test-secret', 'the request carries the function secret');

-- An anonymous idea still notifies its submitter
set local role authenticated;
insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
values ((select idea_id from public.idea where title = 'Bike racks'), 'UNDER_REVIEW', 2, 2, 2);
reset role;
select is((select to_email from public.email_log order by log_id desc limit 1), 'sam.taylor@example.com', 'an anonymous idea notifies its submitter');

-- A broken mail log must not block the review
alter table public.email_log rename to email_log_broken;
set local role authenticated;
select lives_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Bike racks'), 'PILOTING', 3, 3, 3) $$,
  'a failing mail does not block the review');
reset role;
alter table public.email_log_broken rename to email_log;
select is((select current_stage::text from public.idea where title = 'Bike racks'), 'PILOTING', 'the stage changed although the mail failed');

-- The log is for admins only
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select is((select count(*)::int from public.email_log), 0, 'staff cannot read the email log');
select set_config('request.jwt.claims', '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select ok((select count(*) from public.email_log) > 0, 'an admin can read the email log');

select * from finish();
rollback;
