-- Rule tests for public.digest_top_ideas (US-12 Email digest).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Start from empty tables, independent of seed.sql (rolled back at the end)
delete from public.email_log;
delete from public.comment;
delete from public.vote;
delete from public.idea_transition;
delete from public.idea;
delete from auth.users;
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam and Lena (staff), Ruth and Tom (reviewers), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('d0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('d0000000-0000-0000-0000-000000000003', 'lena.fischer@example.com', '{"full_name": "Lena Fischer"}'),
  ('d0000000-0000-0000-0000-000000000004', 'priya.shah@example.com', '{"full_name": "Priya Shah"}'),
  ('d0000000-0000-0000-0000-000000000005', 'tom.hallworth@example.com', '{"full_name": "Tom Hallworth"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email in ('ruth.evans@example.com', 'tom.hallworth@example.com');

-- Ideas of Sam (created as the database owner)
insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, is_confidential, is_anonymous)
select t.title, 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com'),
       t.is_confidential, t.is_anonymous
from (values
  ('Car pool',        false, false),
  ('Salary bands',    true,  false),
  ('Anonymous idea',  false, true),
  ('Declined idea',   false, false),
  ('Window start',    false, false),
  ('Just before',     false, false),
  ('On the day',      false, false),
  ('Too old',         false, false),
  ('Idea I',          false, false),
  ('Idea J',          false, false),
  ('Idea K',          false, false),
  ('Only votes',      false, false)
) as t(title, is_confidential, is_anonymous);

-- Reviews: (idea, to stage, reviewer, time, impact, cost, feasibility); the database sets from_stage
create temp table review_data (title text, to_stage public.idea_stage, reviewer text, at timestamptz, a int, b int, c int, reason text);
insert into review_data values
  -- Car pool: two reviews in October = 12 + 6 = 18
  ('Car pool',       'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-10 10:00+00', 3, 4, 5, null),
  ('Car pool',       'PILOTING',     'tom.hallworth@example.com', '2026-10-15 10:00+00', 2, 2, 2, null),
  ('Salary bands',   'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-10 10:00+00', 5, 5, 5, null),
  ('Anonymous idea', 'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-11 10:00+00', 4, 4, 4, null),
  ('Declined idea',  'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-10 10:00+00', 5, 5, 5, null),
  ('Declined idea',  'DECLINED',     'tom.hallworth@example.com', '2026-10-12 10:00+00', null, null, null, 'Not feasible'),
  -- Window edges for 2026-11-01 (start 2026-10-01 00:00, end exclusive)
  ('Window start',   'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-01 00:00+00', 1, 1, 1, null),
  ('Just before',    'UNDER_REVIEW', 'ruth.evans@example.com', '2026-09-30 23:59+00', 1, 1, 2, null),
  ('On the day',     'UNDER_REVIEW', 'ruth.evans@example.com', '2026-11-01 00:00+00', 5, 5, 5, null),
  ('Too old',        'UNDER_REVIEW', 'ruth.evans@example.com', '2026-08-31 23:00+00', 5, 5, 5, null),
  ('Idea I',         'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-20 10:00+00', 2, 2, 2, null),
  ('Idea J',         'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-20 10:00+00', 3, 3, 3, null),
  ('Idea K',         'UNDER_REVIEW', 'ruth.evans@example.com', '2026-10-20 10:00+00', 2, 2, 3, null);

insert into public.idea_transition (idea_id, to_stage, changed_by, created_at, score_impact, score_cost, score_feasibility, reason)
select i.idea_id, r.to_stage, u.user_id, r.at, r.a, r.b, r.c, r.reason
from review_data r
join public.idea i on i.title = r.title
join public.app_user u on u.email = r.reviewer
order by r.at;

-- Votes: Car pool 2, Anonymous idea 2, "Only votes" 3 (no review, so not in the digest)
insert into public.vote (idea_id, user_id)
select i.idea_id, u.user_id
from (values
  ('Car pool', 'lena.fischer@example.com'), ('Car pool', 'tom.hallworth@example.com'),
  ('Anonymous idea', 'lena.fischer@example.com'), ('Anonymous idea', 'priya.shah@example.com'),
  ('Only votes', 'lena.fischer@example.com'), ('Only votes', 'priya.shah@example.com'), ('Only votes', 'ruth.evans@example.com')
) as v(title, email)
join public.idea i on i.title = v.title
join public.app_user u on u.email = v.email;

-- Sam (staff) and Ruth (reviewer) cannot call it, nor anonymous visitors
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok($$ select * from public.digest_top_ideas('2026-11-01') $$, 'Only admins can see the digest', 'staff cannot see the digest');
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select throws_ok($$ select * from public.digest_top_ideas('2026-11-01') $$, 'Only admins can see the digest', 'a reviewer cannot see the digest');
set local role anon;
select throws_ok($$ select * from public.digest_top_ideas('2026-11-01') $$, '42501', null, 'anonymous visitors cannot call the function');
set local role authenticated;

-- Priya, the admin
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);

select is((select count(*) from public.digest_top_ideas('2026-11-01')), 5::bigint, 'at most 5 ideas are returned');
select results_eq(
  $$ select title from public.digest_top_ideas('2026-11-01') $$,
  $$ values ('Car pool'), ('Anonymous idea'), ('Idea J'), ('Idea K'), ('Idea I') $$,
  'ranked by ratings plus votes; "Window start" (total 3) drops out of the top 5');
select results_eq(
  $$ select review_count, rating_sum, vote_count, total from public.digest_top_ideas('2026-11-01') where title = 'Car pool' $$,
  $$ values (2, 18, 2, 20) $$,
  'the ratings of all reviewers are added, plus the votes (18 + 2)');
select is((select count(*) from public.digest_top_ideas('2026-11-01') where title = 'Salary bands'), 0::bigint,
  'confidential ideas are left out');
select is((select count(*) from public.digest_top_ideas('2026-11-01') where title = 'Declined idea'), 0::bigint,
  'declined ideas are left out');
select is((select count(*) from public.digest_top_ideas('2026-11-01') where title = 'Only votes'), 0::bigint,
  'ideas without a review in the window are left out, even with votes');
select results_eq(
  $$ select submitter_name, is_anonymous from public.digest_top_ideas('2026-11-01') where title in ('Anonymous idea', 'Car pool') order by title $$,
  $$ values (null::text, true), ('Sam Taylor', false) $$,
  'the submitter name is hidden for anonymous ideas');

-- Window edges
select is((select count(*) from public.digest_top_ideas('2026-11-01') where title = 'On the day'), 0::bigint,
  'a review on the simulated day itself is not counted yet');
select results_eq(
  $$ select title from public.digest_top_ideas('2026-11-02') where title = 'On the day' $$,
  $$ values ('On the day') $$, 'a review of the day before is counted');
select results_eq(
  $$ select title from public.digest_top_ideas('2026-10-02') order by total desc, title $$,
  $$ values ('Just before'), ('Window start') $$,
  '31 days: 2026-09-30 and 2026-10-01 count for 2026-10-02, 2026-08-31 does not');
select results_eq(
  $$ select title from public.digest_top_ideas('2026-10-01') order by total desc $$,
  $$ values ('Too old'), ('Just before') $$,
  'for 2026-10-01 the window starts 2026-08-31 and a review at 00:00 of 2026-10-01 is not counted');

select * from finish();
rollback;
