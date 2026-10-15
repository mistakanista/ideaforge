-- Rule tests for public.comment (US-7 Comments on ideas).
-- Everything runs in one transaction and is rolled back at the end.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Start from empty tables, independent of seed.sql (rolled back at the end)
delete from public.comment;
delete from public.vote;
delete from public.idea_transition;
delete from public.idea;
delete from auth.users;
insert into public.login_allowlist (entry, note) values ('@example.com', 'test data');

-- Sam and Lena (staff), Ruth (reviewer), Priya (admin)
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-000000000001', 'sam.taylor@example.com', '{"full_name": "Sam Taylor"}'),
  ('d0000000-0000-0000-0000-000000000002', 'ruth.evans@example.com', '{"full_name": "Ruth Evans"}'),
  ('d0000000-0000-0000-0000-000000000003', 'lena.fischer@example.com', '{"full_name": "Lena Fischer"}'),
  ('d0000000-0000-0000-0000-000000000004', 'priya.shah@example.com', '{"full_name": "Priya Shah"}');
update public.app_user set office = 'BRISTOL';
update public.app_user set role = 'ADMIN' where email = 'priya.shah@example.com';
update public.app_user set role = 'REVIEWER',
  role_changed_by = (select user_id from public.app_user where email = 'priya.shah@example.com')
  where email = 'ruth.evans@example.com';

-- Ideas (created as the database owner): two by Sam (one confidential), one by Ruth
insert into public.idea (title, problem, solution, expected_impact, category_id, submitter_id, is_confidential) values
  ('Shared car pool', 'p', 's', 'i', 1, (select user_id from public.app_user where email = 'sam.taylor@example.com'), false),
  ('Salary bands', 'p', 's', 'i', 4, (select user_id from public.app_user where email = 'sam.taylor@example.com'), true),
  ('Bike racks', 'p', 's', 'i', 3, (select user_id from public.app_user where email = 'ruth.evans@example.com'), false);

-- Signed in as Lena (staff, through the API)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.comment (idea_id, author_id, body, created_at)
     values ((select idea_id from public.idea where title = 'Shared car pool'),
             (select user_id from public.app_user where email = 'priya.shah@example.com'), '  Great idea!  ', '2020-01-01') $$,
  'a staff member can comment on an idea');
select is((select author_id from public.comment),
  (select user_id from public.app_user where email = 'lena.fischer@example.com'), 'the author is always the signed-in user');
select ok((select created_at > '2020-01-01' from public.comment), 'created_at is set by the database');
select is((select body from public.comment), 'Great idea!', 'the text is trimmed');
select throws_ok(
  $$ insert into public.comment (idea_id, body) values ((select idea_id from public.idea where title = 'Shared car pool'), '   ') $$,
  '23514', null, 'a comment cannot be empty');
select throws_ok(
  $$ insert into public.comment (idea_id, body) values ((select idea_id from public.idea where title = 'Shared car pool'), repeat('x', 2001)) $$,
  '23514', null, 'a comment is limited to 2000 characters');
select throws_ok(
  $$ insert into public.comment (idea_id, body) values ((select idea_id from public.idea where title = 'Salary bands'), 'Hi') $$,
  'Idea ' || (select idea_id from public.idea where title = 'Salary bands' limit 1) || ' does not exist',
  'staff cannot comment on a confidential idea of someone else');

-- Sam answers Lena, then Lena answers the answer (thread of three levels)
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.comment (idea_id, parent_comment_id, body)
     values ((select idea_id from public.idea where title = 'Shared car pool'),
             (select comment_id from public.comment where body = 'Great idea!'), 'Thanks!') $$,
  'the submitter can answer a comment');
select throws_ok(
  $$ insert into public.comment (idea_id, body) values ((select idea_id from public.idea where title = 'Salary bands'), 'Hi') $$,
  'Confidential ideas cannot get comments', 'not even the submitter can comment on a confidential idea');
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.comment (idea_id, parent_comment_id, body)
     values ((select idea_id from public.idea where title = 'Shared car pool'),
             (select comment_id from public.comment where body = 'Thanks!'), 'You are welcome') $$,
  'an answer can be answered');

-- Ruth, the reviewer
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.comment (idea_id, body) values ((select idea_id from public.idea where title = 'Salary bands'), 'Hi') $$,
  'Confidential ideas cannot get comments', 'a reviewer cannot comment on a confidential idea either');
select throws_ok(
  $$ insert into public.comment (idea_id, parent_comment_id, body)
     values ((select idea_id from public.idea where title = 'Bike racks'),
             (select comment_id from public.comment where body = 'Thanks!'), 'Wrong idea') $$,
  'The comment you answer does not belong to this idea', 'an answer must be on the same idea as the comment');
select lives_ok(
  $$ insert into public.comment (idea_id, body) values ((select idea_id from public.idea where title = 'Bike racks'), 'My own idea') $$,
  'anyone can comment on their own idea');

-- Visibility: 4 comments, none on the confidential idea
select is((select count(*) from public.comment), 4::bigint, 'everyone sees the comments of visible ideas');

-- Deleting
select set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000003", "role": "authenticated"}', true);
delete from public.comment where body = 'My own idea';
select is((select count(*) from public.comment), 4::bigint, 'a user cannot delete someone else''s comment');
select throws_ok(
  $$ delete from public.comment where body = 'Great idea!' $$,
  '23503', null, 'a comment with answers cannot be deleted');
delete from public.comment where body = 'You are welcome';
select is((select count(*) from public.comment), 3::bigint, 'the author can delete a comment without answers');
select throws_ok(
  $$ delete from public.comment where body = 'Great idea!' $$,
  '23503', null, 'the parent is still protected while one answer is left');
select throws_ok(
  $$ update public.comment set body = 'Changed' $$,
  '42501', null, 'comments cannot be changed through the API');

-- Anonymous visitors
reset role;
set local role anon;
select throws_ok($$ select * from public.comment $$, '42501', null, 'anonymous visitors cannot read comments');
reset role;
select set_config('request.jwt.claims', '', true);  -- no signed-in user any more

-- Checks made as the database owner (e.g. an import script)
update public.app_user set is_active = false where email = 'lena.fischer@example.com';
select throws_ok(
  $$ insert into public.comment (idea_id, author_id, body)
     values ((select idea_id from public.idea where title = 'Shared car pool'),
             (select user_id from public.app_user where email = 'lena.fischer@example.com'), 'Hi') $$,
  'Only active users can comment', 'deactivated users cannot comment');

select * from finish();
rollback;
