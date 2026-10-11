-- =====================================================================
-- IdeaForge: import the review history of the demo ideas (US-3).
-- Local: loaded automatically after import_demo_ideas.sql on "npx supabase db reset" (see config.toml).
-- Cloud: run once in the Supabase dashboard (SQL Editor -> paste this file -> Run),
--        after the idea_transition migration has been applied and import_demo_ideas.sql has run.
-- Safe to run again: nothing is imported if idea_transition already contains rows.
--
-- Generated once from createSeed() in build/frontend/src/data/seed.ts with a throwaway script.
-- Mapping of the mock data to idea_transition:
--   * every stage history entry with a from_stage becomes one transition (75 rows: 69 moves, 6 declines);
--     the "Idea submitted." entries are not transitions and are skipped
--   * reviewer, reason and time are taken from the history entry; reviewers are looked up by email
--   * forward moves get the scores of the reviewer who moved the idea (58 moves); if that
--     reviewer did not score the idea in the mock data, the scores of another reviewer of the
--     same idea are used (11 moves)
--   * declines get no scores (rule of idea_transition); the mock scores of declined ideas are dropped
--
-- The demo ideas were imported directly in their final stage. To replay the history through
-- the rules of idea_transition, the moved ideas are first set back to SUBMITTED; every insert
-- then moves them one stage further. At the end every idea must be in its original stage again,
-- otherwise the whole import is rolled back.
-- =====================================================================

do $$
declare
  v_missing text;
  v_count   int;
  r         record;
begin
  if exists (select 1 from public.idea_transition) then
    raise notice 'The idea_transition table is not empty, nothing imported.';
    return;
  end if;

  select string_agg(e.email, ', ') into v_missing
  from (values ('aisha.rahman@tallis.uk'), ('ruth.evans@tallis.uk'), ('tom.hallworth@tallis.uk')) as e (email)
  where not exists (
    select 1 from public.app_user u where lower(u.email) = e.email and u.role = 'REVIEWER' and u.is_active
  );
  if v_missing is not null then
    raise exception 'Demo reviewers missing or not REVIEWER (run import_dummy_users.sql first): %', v_missing;
  end if;

  create temp table tmp_demo_idea (idea_id bigint primary key, title text, stage public.idea_stage) on commit drop;
  insert into tmp_demo_idea values
      (1, 'Snap expense receipts with your phone', 'PILOTING'),
      (2, 'Shared pool cars between offices', 'PILOTING'),
      (4, 'Reusable cups at every coffee point', 'UNDER_REVIEW'),
      (5, 'Book quiet rooms from the intranet', 'UNDER_REVIEW'),
      (6, 'Monthly cross-office lunch-and-learn', 'UNDER_REVIEW'),
      (7, 'Retire the fax line for court filings', 'DECLINED'),
      (8, 'Client feedback after every matter', 'UNDER_REVIEW'),
      (9, 'Onboarding buddy for new starters', 'IMPLEMENTED'),
      (10, 'Paperless onboarding pack for new starters', 'UNDER_REVIEW'),
      (11, 'Solar panels on the Bristol office roof', 'PILOTING'),
      (12, 'Template library for client letters', 'UNDER_REVIEW'),
      (13, 'Mental health first aiders in every office', 'IMPLEMENTED'),
      (14, 'Automatic conflict check on new matters', 'IMPLEMENTED'),
      (15, 'Cycle-to-work storage and showers', 'IMPLEMENTED'),
      (16, 'One-click screen sharing in meeting rooms', 'DECLINED'),
      (19, 'Switch to a green energy tariff', 'IMPLEMENTED'),
      (21, 'Matter dashboards for clients', 'PILOTING'),
      (23, 'Digital signatures for internal approvals', 'IMPLEMENTED'),
      (24, 'Food waste composting', 'IMPLEMENTED'),
      (25, 'Mentoring across offices', 'DECLINED'),
      (26, 'Shared calendar of client events', 'PILOTING'),
      (27, 'Smarter printing by default', 'UNDER_REVIEW'),
      (28, 'Knowledge base for recurring questions', 'PILOTING'),
      (29, 'Quarterly team volunteering day', 'PILOTING'),
      (30, 'Video calls instead of client travel', 'PILOTING'),
      (31, 'Standard project kick-off checklist', 'PILOTING'),
      (33, 'Central contract renewal reminders', 'PILOTING'),
      (34, 'Plant-based catering by default', 'DECLINED'),
      (36, 'Learning budget per person', 'PILOTING'),
      (37, 'Retire unused software licences', 'PILOTING'),
      (38, 'LED lighting with motion sensors', 'UNDER_REVIEW'),
      (39, 'Lessons-learned review after big projects', 'PILOTING'),
      (40, 'Wellbeing hour each week', 'UNDER_REVIEW'),
      (41, 'Electronic timesheets on mobile', 'UNDER_REVIEW'),
      (42, 'Office plant and air quality programme', 'UNDER_REVIEW'),
      (43, 'Client newsletter on regulatory changes', 'DECLINED'),
      (45, 'Single sign-on for all tools', 'UNDER_REVIEW'),
      (46, 'Rainwater for office toilets', 'UNDER_REVIEW'),
      (48, 'Automatic matter closure reminders', 'UNDER_REVIEW'),
      (49, 'Second-hand office furniture first', 'UNDER_REVIEW'),
      (50, 'Bring your own device policy', 'UNDER_REVIEW'),
      (52, 'Language classes for staff', 'DECLINED'),
      (53, 'Digital visitor sign-in', 'UNDER_REVIEW');

  -- The demo ideas must exist unchanged (same title and stage as in the mock data)
  select string_agg(t.idea_id::text, ', ') into v_missing
  from tmp_demo_idea t
  where not exists (
    select 1 from public.idea i where i.idea_id = t.idea_id and i.title = t.title and i.current_stage = t.stage
  );
  if v_missing is not null then
    raise exception 'Demo ideas missing or changed (run import_demo_ideas.sql first): %', v_missing;
  end if;

  -- Set the moved ideas back to SUBMITTED (allowed for the database owner with this flag only)
  perform set_config('ideaforge.via_transition', 'on', true);
  update public.idea i set current_stage = 'SUBMITTED' from tmp_demo_idea t where i.idea_id = t.idea_id;
  perform set_config('ideaforge.via_transition', 'off', true);

  -- Replay the history in time order; the trigger checks every move and sets the stage
  v_count := 0;
  for r in
    select v.idea_id, v.to_stage, u.user_id, v.reason, v.score_impact, v.score_cost, v.score_feasibility, v.created_at
    from (values
      (1, 1, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 5, 3, '2026-03-24T16:23:48.573Z'),
      (2, 1, 'PILOTING', 'tom.hallworth@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 5, 4, 3, '2026-04-02T04:18:26.990Z'),
      (3, 2, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 3, '2026-03-11T22:10:18.839Z'),
      (4, 2, 'PILOTING', 'tom.hallworth@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 4, 3, 3, '2026-04-02T18:39:43.920Z'),
      (5, 4, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 5, 3, '2026-04-01T21:37:45.848Z'),
      (6, 5, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 5, '2026-03-31T07:38:20.692Z'),
      (7, 6, 'UNDER_REVIEW', 'tom.hallworth@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 3, 4, '2026-03-28T23:52:41.409Z'),
      (8, 7, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 1, 1, '2026-04-02T06:04:42.398Z'),
      (9, 7, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 1, 1, 2, '2026-04-21T08:44:35.890Z'),
      (10, 7, 'DECLINED', 'ruth.evans@tallis.uk', 'A similar initiative is already running; please support that one instead.', null, null, null, '2026-04-30T17:40:49.672Z'),
      (11, 8, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 3, 3, '2026-04-08T00:29:21.821Z'),
      (12, 9, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 4, 5, '2026-04-15T00:08:01.844Z'),
      (13, 9, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 3, 3, 3, '2026-05-02T09:07:51.782Z'),
      (14, 9, 'IMPLEMENTED', 'tom.hallworth@tallis.uk', 'The pilot met its goals. The idea is rolled out to all offices.', 5, 5, 5, '2026-05-11T13:10:03.669Z'),
      (15, 10, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 3, '2026-04-28T07:56:13.581Z'),
      (16, 11, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 4, 3, '2026-04-24T09:59:54.576Z'),
      (17, 11, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 3, 4, 3, '2026-05-15T06:54:46.035Z'),
      (18, 12, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 3, 4, '2026-04-27T00:52:53.578Z'),
      (19, 13, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 5, '2026-05-01T00:34:18.277Z'),
      (20, 13, 'PILOTING', 'ruth.evans@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 4, 5, 5, '2026-05-07T14:03:11.134Z'),
      (21, 13, 'IMPLEMENTED', 'ruth.evans@tallis.uk', 'The pilot met its goals. The idea is rolled out to all offices.', 4, 5, 5, '2026-05-13T18:38:55.331Z'),
      (22, 14, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 5, 3, '2026-05-05T02:32:52.503Z'),
      (23, 14, 'PILOTING', 'tom.hallworth@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 4, 5, 5, '2026-05-21T04:36:20.066Z'),
      (24, 14, 'IMPLEMENTED', 'aisha.rahman@tallis.uk', 'The pilot met its goals. The idea is rolled out to all offices.', 5, 5, 3, '2026-06-14T12:45:07.039Z'),
      (25, 15, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 5, '2026-05-12T14:27:10.764Z'),
      (26, 15, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 4, 5, 5, '2026-05-21T07:40:48.300Z'),
      (27, 15, 'IMPLEMENTED', 'aisha.rahman@tallis.uk', 'The pilot met its goals. The idea is rolled out to all offices.', 4, 5, 5, '2026-06-13T08:54:29.797Z'),
      (28, 16, 'DECLINED', 'aisha.rahman@tallis.uk', 'The costs are too high compared with the expected benefit at the moment.', null, null, null, '2026-05-05T06:33:49.183Z'),
      (29, 19, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 5, 4, '2026-05-16T13:16:29.767Z'),
      (30, 19, 'PILOTING', 'ruth.evans@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 5, 4, 3, '2026-05-26T09:05:52.091Z'),
      (31, 19, 'IMPLEMENTED', 'tom.hallworth@tallis.uk', 'The pilot met its goals. The idea is rolled out to all offices.', 3, 4, 5, '2026-06-13T13:50:36.728Z'),
      (32, 21, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 4, 3, '2026-05-29T09:40:51.967Z'),
      (33, 21, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 4, 4, 3, '2026-06-06T13:41:35.799Z'),
      (34, 23, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 4, 4, '2026-06-14T13:51:58.871Z'),
      (35, 23, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 5, 5, 4, '2026-07-01T22:33:22.500Z'),
      (36, 23, 'IMPLEMENTED', 'ruth.evans@tallis.uk', 'The pilot met its goals. The idea is rolled out to all offices.', 4, 4, 4, '2026-07-16T04:22:26.835Z'),
      (37, 24, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 3, 5, '2026-06-19T06:16:47.799Z'),
      (38, 24, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 4, 3, 5, '2026-07-13T09:50:42.713Z'),
      (39, 24, 'IMPLEMENTED', 'ruth.evans@tallis.uk', 'The pilot met its goals. The idea is rolled out to all offices.', 4, 5, 3, '2026-07-21T14:18:54.472Z'),
      (40, 25, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 2, 2, 3, '2026-06-19T10:07:07.088Z'),
      (41, 25, 'DECLINED', 'aisha.rahman@tallis.uk', 'Not feasible with our current systems. Worth revisiting after the IT upgrade.', null, null, null, '2026-06-24T15:53:27.388Z'),
      (42, 26, 'UNDER_REVIEW', 'tom.hallworth@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 4, '2026-06-23T15:39:48.015Z'),
      (43, 26, 'PILOTING', 'ruth.evans@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 5, 5, 3, '2026-07-10T10:18:24.361Z'),
      (44, 27, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 4, '2026-06-14T18:34:19.491Z'),
      (45, 28, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 5, 4, '2026-07-03T19:09:10.354Z'),
      (46, 28, 'PILOTING', 'tom.hallworth@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 3, 3, 3, '2026-07-22T15:52:34.652Z'),
      (47, 29, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 4, 4, '2026-06-22T07:28:14.626Z'),
      (48, 29, 'PILOTING', 'tom.hallworth@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 3, 5, 4, '2026-07-03T10:28:42.914Z'),
      (49, 30, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 4, 3, '2026-06-29T20:52:37.712Z'),
      (50, 30, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 5, 3, 4, '2026-07-04T23:28:31.263Z'),
      (51, 31, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 3, 5, '2026-07-12T08:43:34.387Z'),
      (52, 31, 'PILOTING', 'ruth.evans@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 5, 4, 4, '2026-07-26T16:18:03.337Z'),
      (53, 33, 'UNDER_REVIEW', 'tom.hallworth@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 4, 3, '2026-07-12T07:15:20.555Z'),
      (54, 33, 'PILOTING', 'tom.hallworth@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 3, 4, 3, '2026-07-31T21:06:01.713Z'),
      (55, 34, 'UNDER_REVIEW', 'tom.hallworth@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 1, 2, 3, '2026-07-13T14:28:20.256Z'),
      (56, 34, 'PILOTING', 'tom.hallworth@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 1, 2, 3, '2026-08-06T13:39:13.444Z'),
      (57, 34, 'DECLINED', 'aisha.rahman@tallis.uk', 'The costs are too high compared with the expected benefit at the moment.', null, null, null, '2026-08-22T20:29:32.119Z'),
      (58, 36, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 5, 4, '2026-07-18T06:52:40.543Z'),
      (59, 36, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 3, 3, 5, '2026-07-23T12:02:27.905Z'),
      (60, 37, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 3, 5, '2026-07-28T13:03:16.313Z'),
      (61, 37, 'PILOTING', 'aisha.rahman@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 3, 3, 4, '2026-08-03T05:12:55.290Z'),
      (62, 38, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 3, 4, '2026-07-22T18:42:37.988Z'),
      (63, 39, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 3, 5, '2026-07-27T10:49:06.893Z'),
      (64, 39, 'PILOTING', 'ruth.evans@tallis.uk', 'Scores are convincing. We start a three-month pilot in one office.', 5, 3, 5, '2026-08-14T12:19:48.511Z'),
      (65, 40, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 3, 3, '2026-08-03T05:34:51.251Z'),
      (66, 41, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 4, 4, '2026-08-18T04:28:14.958Z'),
      (67, 42, 'UNDER_REVIEW', 'ruth.evans@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 4, 3, '2026-08-21T14:17:04.391Z'),
      (68, 43, 'DECLINED', 'aisha.rahman@tallis.uk', 'Not feasible with our current systems. Worth revisiting after the IT upgrade.', null, null, null, '2026-08-08T22:58:32.556Z'),
      (69, 45, 'UNDER_REVIEW', 'tom.hallworth@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 3, 5, '2026-08-22T23:27:45.853Z'),
      (70, 46, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 5, 3, '2026-09-07T17:49:00.075Z'),
      (71, 48, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 5, 3, 5, '2026-09-12T05:47:41.386Z'),
      (72, 49, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 3, 4, 3, '2026-09-17T07:37:45.677Z'),
      (73, 50, 'UNDER_REVIEW', 'aisha.rahman@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 4, 5, '2026-09-22T17:49:26.915Z'),
      (74, 52, 'DECLINED', 'ruth.evans@tallis.uk', 'Not feasible with our current systems. Worth revisiting after the IT upgrade.', null, null, null, '2026-09-16T02:29:22.658Z'),
      (75, 53, 'UNDER_REVIEW', 'tom.hallworth@tallis.uk', 'Strong support from colleagues. We are checking costs and effort before deciding on a pilot.', 4, 4, 3, '2026-10-01T07:13:42.501Z')
    ) as v (seq, idea_id, to_stage, email, reason, score_impact, score_cost, score_feasibility, created_at)
    join public.app_user u on lower(u.email) = v.email
    order by v.seq
  loop
    insert into public.idea_transition (idea_id, to_stage, changed_by, reason,
                                        score_impact, score_cost, score_feasibility, created_at)
    values (r.idea_id, r.to_stage::public.idea_stage, r.user_id, r.reason,
            r.score_impact, r.score_cost, r.score_feasibility, r.created_at::timestamptz);
    v_count := v_count + 1;
  end loop;

  if v_count <> 75 then
    raise exception 'Only % of 75 transitions could be imported (reviewer not found)', v_count;
  end if;

  select string_agg(t.idea_id::text, ', ') into v_missing
  from tmp_demo_idea t join public.idea i using (idea_id)
  where i.current_stage <> t.stage;
  if v_missing is not null then
    raise exception 'Ideas not in their original stage after the import: %', v_missing;
  end if;

  raise notice '% demo transitions imported.', v_count;
end $$;
