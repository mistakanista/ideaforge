-- =====================================================================
-- IdeaForge: moving ideas through the pipeline (US-3 Move ideas)
-- Based on design/DatenModel/V2-StammdatenIntegriert, with these differences:
--   * idea_stage_history, scoring_criterion and idea_score are merged into one
--     table idea_transition (decided 2026-10-11): every move is made by exactly
--     one reviewer, who either scores the idea (impact, cost, feasibility, 1 to 5)
--     or declines it with a reason
--   * no weights for the criteria; the three criteria are fixed columns
--   * notifications follow with US-8
--
-- Rules enforced in the database:
--   - a stage change is only an INSERT into idea_transition; its trigger also sets
--     idea.current_stage. A direct update of the stage is rejected.
--   - stages: SUBMITTED -> UNDER_REVIEW -> PILOTING -> IMPLEMENTED, no skipping,
--     no way back; every open stage can be declined; IMPLEMENTED and DECLINED are final
--   - only active reviewers move ideas (admins and staff cannot)
--   - a reviewer can never review their own ideas
--   - a decline needs a reason and has no scores; every other move needs all three scores
--   - through the API, from_stage, changed_by and created_at are set by the
--     database and cannot be faked
--   - transitions are visible to everyone who can see the idea
--   - transitions cannot be changed or deleted through the API (audit trail)
-- =====================================================================

create table public.idea_transition (
  transition_id     bigint generated always as identity primary key,
  idea_id           bigint not null references public.idea (idea_id),
  from_stage        public.idea_stage not null,
  to_stage          public.idea_stage not null,
  changed_by        bigint not null references public.app_user (user_id),
  reason            text,
  score_impact      smallint check (score_impact between 1 and 5),
  score_cost        smallint check (score_cost between 1 and 5),
  score_feasibility smallint check (score_feasibility between 1 and 5),
  created_at        timestamptz not null default now(),
  constraint ck_idea_transition_decline_or_score check (
    (to_stage = 'DECLINED'
       and coalesce(length(trim(reason)), 0) > 0
       and score_impact is null and score_cost is null and score_feasibility is null)
    or
    (to_stage <> 'DECLINED'
       and score_impact is not null and score_cost is not null and score_feasibility is not null)
  )
);

-- Idea details: history of one idea in time order, latest scores
create index ix_idea_transition_idea on public.idea_transition (idea_id, created_at);
create index ix_idea_transition_changed_by on public.idea_transition (changed_by);

comment on table public.idea_transition is 'One row per stage change of an idea, with the review of the reviewer (scores, or a reason when declined).';
comment on column public.idea_transition.from_stage is 'Stage before the move, copied from idea.current_stage by trigger.';
comment on column public.idea_transition.changed_by is 'Reviewer who moved the idea; set to the signed-in user by trigger.';
comment on column public.idea_transition.reason is 'Required when the idea is declined (shown to the submitter); optional remark otherwise.';
comment on column public.idea_transition.score_impact is '1 (low impact) to 5 (high impact); NULL when declined.';
comment on column public.idea_transition.score_cost is '1 (high cost) to 5 (least cost); NULL when declined.';
comment on column public.idea_transition.score_feasibility is '1 (hard) to 5 (easy to implement); NULL when declined.';

-- ---------------------------------------------------------------------
-- Allowed stage changes (also usable by the frontend to offer the next stage)
-- ---------------------------------------------------------------------
create function public.is_valid_transition(p_from public.idea_stage, p_to public.idea_stage) returns boolean
language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (
    ('SUBMITTED'::public.idea_stage,    'UNDER_REVIEW'::public.idea_stage),
    ('UNDER_REVIEW'::public.idea_stage, 'PILOTING'::public.idea_stage),
    ('PILOTING'::public.idea_stage,     'IMPLEMENTED'::public.idea_stage),
    ('SUBMITTED'::public.idea_stage,    'DECLINED'::public.idea_stage),
    ('UNDER_REVIEW'::public.idea_stage, 'DECLINED'::public.idea_stage),
    ('PILOTING'::public.idea_stage,     'DECLINED'::public.idea_stage)
  );
$$;

-- ---------------------------------------------------------------------
-- Rules for new transitions
-- ---------------------------------------------------------------------
create function public.idea_transition_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
  v_idea public.idea%rowtype;
begin
  if via_api then
    -- The reviewer is always the signed-in user
    new.changed_by := public.current_app_user_id();
    new.created_at := now();
  end if;

  -- Lock the idea, so two reviewers cannot move it at the same time
  select * into v_idea from public.idea where idea_id = new.idea_id for update;
  if not found then
    raise exception 'Idea % does not exist', new.idea_id;
  end if;
  new.from_stage := v_idea.current_stage;
  new.reason := nullif(trim(new.reason), '');

  if not exists (
    select 1 from public.app_user where user_id = new.changed_by and role = 'REVIEWER' and is_active
  ) then
    raise exception 'Only reviewers can move ideas';
  end if;

  if v_idea.submitter_id = new.changed_by then
    raise exception 'Reviewers cannot review their own ideas';
  end if;

  if not public.is_valid_transition(new.from_stage, new.to_stage) then
    raise exception 'An idea in stage % cannot be moved to %', new.from_stage, new.to_stage;
  end if;

  -- The idea gets its new stage here and not in an AFTER trigger: AFTER row triggers run
  -- at the end of the statement, so the next row of a multi-row insert would still see
  -- the old stage. If the row fails a constraint later, the whole statement is rolled back.
  perform set_config('ideaforge.via_transition', 'on', true);
  update public.idea set current_stage = new.to_stage where idea_id = new.idea_id;
  perform set_config('ideaforge.via_transition', 'off', true);

  return new;
end $$;

create trigger trg_idea_transition_check
  before insert on public.idea_transition
  for each row execute function public.idea_transition_check();

-- ---------------------------------------------------------------------
-- idea_check(): the stage may now only change through idea_transition
-- (unchanged otherwise, see 20261010192020_idea.sql)
-- ---------------------------------------------------------------------
create or replace function public.idea_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
  v_office text;
begin
  if tg_op = 'UPDATE' then
    -- Only the stage may change, and only through a new row in idea_transition
    if (new.idea_id, new.title, new.problem, new.solution, new.expected_impact, new.category_id,
        new.submitter_id, new.office, new.is_confidential, new.resubmission_of, new.created_at)
       is distinct from
       (old.idea_id, old.title, old.problem, old.solution, old.expected_impact, old.category_id,
        old.submitter_id, old.office, old.is_confidential, old.resubmission_of, old.created_at) then
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
    if new.resubmission_of is not null then
      raise exception 'Resubmissions are not possible yet';
    end if;
    new.current_stage := 'SUBMITTED';
    new.created_at := now();
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

-- Trigger functions are not meant to be called through the API
revoke execute on function public.idea_transition_check(), public.idea_check()
  from public, anon, authenticated;
revoke execute on function public.is_valid_transition(public.idea_stage, public.idea_stage) from public, anon;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.idea_transition enable row level security;

-- Anonymous visitors see nothing; the history cannot be changed or deleted
revoke all on public.idea_transition from anon;
revoke update, delete, truncate on public.idea_transition from authenticated;

-- The subquery on idea applies the idea policies: whoever sees the idea sees its history
create policy "Active users can read the transitions of visible ideas"
  on public.idea_transition for select to authenticated
  using (exists (select 1 from public.idea i where i.idea_id = idea_transition.idea_id));

create policy "Reviewers can move ideas"
  on public.idea_transition for insert to authenticated
  with check ((select public.is_reviewer()));
