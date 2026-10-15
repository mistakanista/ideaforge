-- =====================================================================
-- IdeaForge: demo comments on the demo ideas (US-7).
-- Local: loaded automatically after import_demo_votes.sql on "npx supabase db reset" (see config.toml).
-- Cloud: run once in the Supabase dashboard (SQL Editor -> paste this file -> Run),
--        after the comment migration has been applied and import_demo_ideas.sql has run.
-- Safe to run again: nothing is imported if comment already contains rows.
--
-- Hand-written, 22 comments on the ideas 1, 2, 3, 5, 8, 9 and 11 (none confidential or anonymous),
-- including answers and answers to answers. The same list is in COMMENTS in
-- build/frontend/src/data/seed.ts (mock data); keep both in sync.
-- Authors are looked up by email; created_at is fixed. Every comment goes through the trigger
-- comment_check(), so a comment that breaks a rule stops the import; the whole import is one
-- DO block and is rolled back on any error.
-- =====================================================================

do $$
declare
  v_missing text;
  v_ids     bigint[] := '{}';
  v_id      bigint;
  r         record;
begin
  if exists (select 1 from public.comment) then
    raise notice 'The comment table is not empty, nothing imported.';
    return;
  end if;

  select string_agg(e.email, ', ') into v_missing
  from (values
      ('aisha.rahman@tallis.uk'),
      ('chloe.bennett@tallis.uk'),
      ('daniel.okafor@tallis.uk'),
      ('gareth.lowe@tallis.uk'),
      ('lena.fischer@tallis.uk'),
      ('marcus.reid@tallis.uk'),
      ('morgan.hughes@tallis.uk'),
      ('priya.shah@tallis.uk'),
      ('ruth.evans@tallis.uk'),
      ('sam.patel@tallis.uk'),
      ('sofia.marin@tallis.uk'),
      ('tom.hallworth@tallis.uk')
  ) as e (email)
  where not exists (select 1 from public.app_user u where lower(u.email) = e.email and u.is_active);
  if v_missing is not null then
    raise exception 'Demo users missing or inactive (run import_dummy_users.sql first): %', v_missing;
  end if;

  select string_agg(i::text, ', ') into v_missing
  from unnest(array[1, 2, 3, 5, 8, 9, 11]) as i
  where not exists (select 1 from public.idea where idea_id = i and not is_confidential);
  if v_missing is not null then
    raise exception 'Demo ideas missing or confidential (run import_demo_ideas.sql first): %', v_missing;
  end if;

  -- (position, idea_id, author email, position of the answered comment, text, created_at);
  -- answers come after the comment they answer
  for r in
    select * from (values
      (0, 1, 'sofia.marin@tallis.uk', null, 'Would this also work for foreign currency receipts? I travel to Dublin a lot.', '2026-04-12T09:14:00Z'),
      (1, 1, 'daniel.okafor@tallis.uk', 0, 'Yes, the plan is to read the currency from the receipt and convert at the monthly rate Finance already uses.', '2026-04-12T11:02:00Z'),
      (2, 1, 'sofia.marin@tallis.uk', 1, 'Great, that would remove my biggest monthly headache.', '2026-04-12T13:40:00Z'),
      (3, 1, 'ruth.evans@tallis.uk', null, 'Please include how long receipts must be kept. Our audit rules ask for seven years.', '2026-04-20T10:30:00Z'),
      (4, 1, 'chloe.bennett@tallis.uk', null, '+1 from me. Finance chases me every month.', '2026-05-03T15:05:00Z'),
      (5, 2, 'tom.hallworth@tallis.uk', null, 'Insurance for pool cars needs a look: do we cover all staff drivers?', '2026-04-15T08:45:00Z'),
      (6, 2, 'chloe.bennett@tallis.uk', 5, 'Good point. I will ask our broker and add the answer here.', '2026-04-15T16:20:00Z'),
      (7, 2, 'gareth.lowe@tallis.uk', null, 'Glasgow to Leeds is the route I drive most. Could an electric car cover it?', '2026-04-22T12:10:00Z'),
      (8, 2, 'marcus.reid@tallis.uk', 7, 'Range is fine for that route, but charging at the Leeds office would be needed.', '2026-04-23T09:00:00Z'),
      (9, 2, 'gareth.lowe@tallis.uk', 8, 'Then charging points should be part of the proposal.', '2026-04-23T10:25:00Z'),
      (10, 3, 'aisha.rahman@tallis.uk', null, 'Which clients would use it first? A pilot with two or three clients would be enough.', '2026-04-18T14:00:00Z'),
      (11, 3, 'priya.shah@tallis.uk', null, 'IT security should review the expiring links before we promise anything to clients.', '2026-04-25T09:30:00Z'),
      (12, 3, 'tom.hallworth@tallis.uk', 11, 'Agreed, I have asked IT for a short review.', '2026-04-25T17:15:00Z'),
      (13, 5, 'morgan.hughes@tallis.uk', null, 'Two hours may be too short for deep work. Could we allow a second booking?', '2026-05-02T11:20:00Z'),
      (14, 5, 'sam.patel@tallis.uk', 13, 'Or four hours with a check-in, so unused rooms are released.', '2026-05-02T14:50:00Z'),
      (15, 9, 'sofia.marin@tallis.uk', null, 'My buddy made my first weeks much easier. Thank you for suggesting it!', '2026-06-10T09:05:00Z'),
      (16, 9, 'gareth.lowe@tallis.uk', 15, 'Great to hear, thanks Sofia!', '2026-06-10T10:30:00Z'),
      (17, 9, 'lena.fischer@tallis.uk', null, 'Could buddies get a short guide with ideas for the first coffee chat?', '2026-06-18T13:45:00Z'),
      (18, 11, 'aisha.rahman@tallis.uk', null, 'What is the expected payback time compared with the power purchase agreement?', '2026-05-12T10:00:00Z'),
      (19, 11, 'lena.fischer@tallis.uk', 18, 'With the agreement there is no upfront cost; the roof survey will show the exact saving.', '2026-05-12T15:30:00Z'),
      (20, 11, 'daniel.okafor@tallis.uk', null, 'Does the roof need reinforcement first?', '2026-05-20T08:40:00Z'),
      (21, 8, 'chloe.bennett@tallis.uk', null, 'Three questions are a good limit. Please keep one free-text question.', '2026-04-30T12:00:00Z')
    ) as c (pos, idea_id, email, parent_pos, body, created_at) order by pos
  loop
    insert into public.comment (idea_id, author_id, parent_comment_id, body, created_at)
    values (
      r.idea_id,
      (select user_id from public.app_user where lower(email) = r.email),
      case when r.parent_pos is null then null else v_ids[r.parent_pos + 1] end,
      r.body,
      r.created_at::timestamptz
    )
    returning comment_id into v_id;
    v_ids := v_ids || v_id;
  end loop;

  raise notice '% demo comments imported.', array_length(v_ids, 1);
end $$;
