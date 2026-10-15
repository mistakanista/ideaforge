-- Rule tests for public.idea_transition (US-3 Move ideas).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

-- Start from empty tables, independent of seed.sql (rolled back at the end)
delete from public.comment;  -- comments reference ideas and users (demo comments)
delete from public.vote;
delete from public.idea_transition;
delete from public.idea;
delete from auth.users;
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam (staff), Ruth and Tom (reviewers), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('c0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('c0000000-0000-0000-0000-000000000003', 'tom.hallworth@example.com', '{"full_name": "Tom Hallworth"}'),
  ('c0000000-0000-0000-0000-000000000004', 'priya.shah@example.com', '{"full_name": "Priya Shah"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email in ('ruth.evans@example.com', 'tom.hallworth@example.com');

-- Ideas (created as the database owner): three by Sam (one confidential), one by Tom
insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, is_confidential) values
  ('Shared car pool', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false),
  ('Salary bands', 'p', 's', 'i', 4, (select user_id from public.app_user where email = 'sam.taylor@example.com'), true),
  ('Bike racks', 'p', 's', 'i', 3, (select user_id from public.app_user where email = 'tom.hallworth@example.com'), false),
  ('Paperless office', 'p', 's', 'i', 2, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false);

-- Transition rules
select ok(public.is_valid_transition('SUBMITTED', 'UNDER_REVIEW'), 'SUBMITTED -> UNDER_REVIEW is allowed');
select ok(public.is_valid_transition('PILOTING', 'DECLINED'), 'an open idea can be declined');
select ok(not public.is_valid_transition('SUBMITTED', 'PILOTING'), 'a stage cannot be skipped');
select ok(not public.is_valid_transition('PILOTING', 'UNDER_REVIEW'), 'an idea cannot go back');
select ok(not public.is_valid_transition('IMPLEMENTED', 'DECLINED'), 'an implemented idea cannot be declined');

-- Signed in as reviewer Ruth (through the API)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility, reason,
                                         from_stage, changed_by, created_at)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'UNDER_REVIEW', 4, 3, 5, 'Good start',
             'PILOTING', (select user_id from public.app_user where email = 'tom.hallworth@example.com'), '2020-01-01') $$,
  'a reviewer can move an idea to the next stage with scores');
select is((select current_stage from public.idea where title = 'Shared car pool'), 'UNDER_REVIEW'::public.idea_stage,
  'the idea gets the new stage');
select is((select from_stage from public.idea_transition), 'SUBMITTED'::public.idea_stage,
  'from_stage is taken from the idea');
select is((select changed_by from public.idea_transition),
  (select user_id from public.app_user where email = 'ruth.evans@example.com'), 'the reviewer is always the signed-in user');
select ok((select created_at > '2020-01-01' from public.idea_transition), 'created_at is set by the database');
select is((select reason from public.idea_transition), 'Good start', 'a move can have a reason besides the scores');

-- Stages
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'IMPLEMENTED', 4, 4, 4) $$,
  'An idea in stage UNDER_REVIEW cannot be moved to IMPLEMENTED', 'a stage cannot be skipped');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'SUBMITTED', 4, 4, 4) $$,
  'An idea in stage UNDER_REVIEW cannot be moved to SUBMITTED', 'an idea cannot go back');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'UNDER_REVIEW', 4, 4, 4) $$,
  'An idea in stage UNDER_REVIEW cannot be moved to UNDER_REVIEW', 'an idea cannot be moved to its own stage');

-- Scores and reasons
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'PILOTING', 4, 4) $$,
  '23514', null, 'a move needs all three scores');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'PILOTING', 0, 4, 4) $$,
  '23514', null, 'a score cannot be 0');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'PILOTING', 4, 6, 4) $$,
  '23514', null, 'a score cannot be 6');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'DECLINED') $$,
  '23514', null, 'a decline needs a reason');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, reason)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'DECLINED', '   ') $$,
  '23514', null, 'a blank reason is not a reason');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, reason, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'DECLINED', 'Too expensive', 1, 1, null) $$,
  '23514', null, 'a decline has all three scores or none');
select is((select current_stage from public.idea where title = 'Shared car pool'), 'UNDER_REVIEW'::public.idea_stage,
  'rejected moves do not change the stage');

-- The full pipeline
select lives_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'PILOTING', 4, 3, 4),
            ((select idea_id from public.idea where title = 'Shared car pool'), 'IMPLEMENTED', 5, 3, 4) $$,
  'an idea can go through all stages');
select results_eq(
  $$ select from_stage::text, to_stage::text from public.idea_transition
     where idea_id = (select idea_id from public.idea where title = 'Shared car pool') order by transition_id $$,
  $$ values ('SUBMITTED', 'UNDER_REVIEW'), ('UNDER_REVIEW', 'PILOTING'), ('PILOTING', 'IMPLEMENTED') $$,
  'the history shows every move in order');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, reason)
     values ((select idea_id from public.idea where title = 'Shared car pool'), 'DECLINED', 'Changed my mind') $$,
  'An idea in stage IMPLEMENTED cannot be moved to DECLINED', 'an implemented idea is final');

-- Decline
select lives_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, reason)
     values ((select idea_id from public.idea where title = 'Salary bands'), 'DECLINED', '  Not in our control  ') $$,
  'a reviewer can decline an idea with a reason');
select is((select reason from public.idea_transition where to_stage = 'DECLINED'), 'Not in our control',
  'the reason is stored trimmed');
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Salary bands'), 'UNDER_REVIEW', 3, 3, 3) $$,
  'An idea in stage DECLINED cannot be moved to UNDER_REVIEW', 'a declined idea is final');
select lives_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, reason, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Paperless office'), 'DECLINED', 'Too expensive for now', 3, 1, 2) $$,
  'a reviewer can decline an idea with a reason and scores');
select results_eq(
  $$ select score_impact, score_cost, score_feasibility from public.idea_transition
     where idea_id = (select idea_id from public.idea where title = 'Paperless office') $$,
  $$ values (3::smallint, 1::smallint, 2::smallint) $$,
  'the scores of a decline are stored');

-- Who may move ideas
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Bike racks'), 'UNDER_REVIEW', 5, 5, 5) $$,
  'Reviewers cannot review their own ideas', 'a reviewer cannot review their own idea');
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Bike racks'), 'UNDER_REVIEW', 5, 5, 5) $$,
  'Only reviewers can move ideas', 'staff cannot move ideas');
select throws_ok(
  $$ update public.idea set current_stage = 'UNDER_REVIEW' where title = 'Bike racks' $$,
  '42501', null, 'the stage cannot be updated directly through the API');
select throws_ok(
  $$ update public.idea_transition set reason = 'changed' $$,
  '42501', null, 'transitions cannot be changed through the API');
select throws_ok(
  $$ delete from public.idea_transition $$,
  '42501', null, 'transitions cannot be deleted through the API');
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000004", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.idea_transition (idea_id, to_stage, score_impact, score_cost, score_feasibility)
     values ((select idea_id from public.idea where title = 'Bike racks'), 'UNDER_REVIEW', 5, 5, 5) $$,
  'Only reviewers can move ideas', 'admins cannot move ideas');

-- Visibility (the history of the confidential idea "Salary bands" has one row)
select is((select count(*) from public.idea_transition), 4::bigint,
  'admins see the history of normal ideas but not of confidential ones');
select set_config('request.jwt.claims', '{"sub": "c0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select is((select count(*) from public.idea_transition), 5::bigint, 'reviewers see the history of all ideas');

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select * from public.idea_transition $$, '42501', null, 'anonymous visitors cannot read transitions');
reset role;
select set_config('request.jwt.claims', '', true);  -- no signed-in user any more

-- Checks made as the database owner
select throws_ok(
  $$ update public.idea set current_stage = 'PILOTING' where title = 'Bike racks' $$,
  'The stage of an idea can only be changed by a review in idea_transition',
  'the stage cannot be changed without a transition');

select * from finish();
rollback;
