-- =====================================================================
-- IdeaForge: anonymous ideas (US-11, step 1)
-- Based on 20261013200312_idea_resubmission.sql (last version of idea_check()).
--
-- New column idea.is_anonymous (default false). The database still stores the
-- submitter; hiding the name from other users is a rule of the app (decided
-- 2026-10-14, see "Known limitations" in supabase/README.md).
-- The flag is set when the idea is submitted and cannot be changed afterwards.
-- It can be combined with is_confidential. No change to RLS or grants.
-- =====================================================================
alter table public.idea add column is_anonymous boolean not null default false;

comment on column public.idea.is_anonymous is 'The app does not show the submitter to other users; the submitter still sees the idea as their own (US-11). Cannot be changed after submitting.';

create or replace function public.idea_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
  v_office text;
  v_original public.idea;
begin
  if tg_op = 'UPDATE' then
    -- Only the stage may change, and only through a new row in idea_transition
    if (new.idea_id, new.title, new.problem, new.solution, new.expected_impact, new.category_id,
        new.submitter_id, new.office, new.is_confidential, new.is_anonymous, new.resubmission_of, new.created_at)
       is distinct from
       (old.idea_id, old.title, old.problem, old.solution, old.expected_impact, old.category_id,
        old.submitter_id, old.office, old.is_confidential, old.is_anonymous, old.resubmission_of, old.created_at) then
      raise exception 'Only the stage of an idea can be changed';
    end if;
    if new.current_stage is distinct from old.current_stage
       and coalesce(current_setting('ideaforge.via_transition', true), 'off') <> 'on' then
      raise exception 'The stage of an idea can only be changed by a review in idea_transition';
    end if;
    return new;
  end if;

  if via_api then
    -- The submitter is always the signed-in user; a new idea always starts as SUBMITTED
    new.submitter_id := public.current_app_user_id();
    if new.submitter_id is null then
      raise exception 'Only active users can submit ideas';
    end if;
    new.current_stage := 'SUBMITTED';
    new.created_at := now();

    if new.resubmission_of is not null then
      select * into v_original from public.idea where idea_id = new.resubmission_of;
      -- One message for "missing" and "not yours": it must not reveal other people's ideas
      if v_original.idea_id is null or v_original.submitter_id <> new.submitter_id then
        raise exception 'You can only give your own declined ideas a second chance';
      end if;
      if v_original.current_stage <> 'DECLINED' then
        raise exception 'Only a declined idea can get a second chance';
      end if;
      if exists (select 1 from public.idea where resubmission_of = new.resubmission_of) then
        raise exception 'This idea has already had its second chance';
      end if;
    end if;
  end if;

  -- The office is always taken from the submitter
  select office into v_office from public.app_user where user_id = new.submitter_id;
  if v_office is null then
    raise exception 'Please set your office in your profile before submitting an idea';
  end if;
  new.office := v_office;

  -- No third attempt: a second attempt cannot be resubmitted again
  if exists (select 1 from public.idea where idea_id = new.resubmission_of and resubmission_of is not null) then
    raise exception 'An idea can get only one second chance';
  end if;

  if not exists (select 1 from public.category where category_id = new.category_id and is_active) then
    raise exception 'Please choose an active category';
  end if;

  return new;
end $$;

-- create or replace keeps the grants of the existing function
