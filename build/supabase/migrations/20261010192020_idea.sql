-- =====================================================================
-- IdeaForge: categories and ideas (US-1 Submit an idea, step 1)
-- Based on design/DatenModel/V2-StammdatenIntegriert, with these differences:
--   * idea.office: copy of the submitter's office at submit time (US-1)
--   * idea.is_confidential: visible only to the submitter and reviewers (US-1)
--   * idea.search_vector: not yet, follows with the dashboard search (US-2)
--   * no updated_at; stage changes and their history follow with US-3
--
-- Rules enforced in the database:
--   - through the API, submitter, office, stage and created_at are set by the
--     database and cannot be faked
--   - an idea needs an active category and a submitter with an office
--   - at most two attempts: an idea can be resubmitted once, and a resubmission
--     cannot be resubmitted again; resubmissions through the API follow with US-6
--   - confidential ideas are visible only to the submitter and the reviewers
--     (admins do not see them)
--   - no updates or deletes through the API yet
-- =====================================================================

-- The order of the values is the pipeline order
create type public.idea_stage as enum ('SUBMITTED', 'UNDER_REVIEW', 'PILOTING', 'IMPLEMENTED', 'DECLINED');

-- ---------------------------------------------------------------------
-- Categories (maintained by admins at runtime, admin page follows with US-5)
-- ---------------------------------------------------------------------
create table public.category (
  category_id smallint generated always as identity primary key,
  name        text not null check (length(trim(name)) > 0),
  description text,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true
);

create unique index ux_category_name on public.category (lower(name));

comment on table public.category is 'Idea categories; inactive categories cannot be chosen for new ideas.';

insert into public.category (name, description, sort_order) values
  ('Client delivery', 'How we serve and deliver work for our clients.', 1),
  ('Internal tools and processes', 'Software, workflows and admin that make daily work easier.', 2),
  ('Sustainability', 'Reducing waste, travel and energy across our offices.', 3),
  ('People and culture', 'Wellbeing, learning and how we work together.', 4);

-- ---------------------------------------------------------------------
-- Ideas
-- ---------------------------------------------------------------------
create table public.idea (
  idea_id         bigint generated always as identity primary key,
  title           text not null check (length(trim(title)) between 3 and 200),
  problem         text not null check (length(trim(problem)) > 0),
  solution        text not null check (length(trim(solution)) > 0),
  expected_impact text not null check (length(trim(expected_impact)) > 0),
  category_id     smallint not null references public.category (category_id),
  submitter_id    bigint not null references public.app_user (user_id),
  office          text not null check (office ~ '^[A-Z0-9_]+$'),
  is_confidential boolean not null default false,
  current_stage   public.idea_stage not null default 'SUBMITTED',
  resubmission_of bigint unique references public.idea (idea_id),  -- unique: only one second chance
  created_at      timestamptz not null default now()
);

-- Dashboard: open stages first, declined and implemented ideas per category on demand
create index ix_idea_stage_category on public.idea (current_stage, category_id);
create index ix_idea_submitter on public.idea (submitter_id);
create index ix_idea_created on public.idea (created_at desc);

comment on table public.idea is 'Submitted ideas. The idea_id is the unique identifier shown to users.';
comment on column public.idea.office is 'Office code of the submitter at submit time, copied by trigger.';
comment on column public.idea.is_confidential is 'Confidential ideas are visible only to the submitter and the reviewers.';
comment on column public.idea.resubmission_of is 'Declined original idea for a second attempt (US-6); NULL for first attempts. Replaces attempt_no of data model V2.';

-- ---------------------------------------------------------------------
-- Helper function for RLS (security definer avoids RLS recursion)
-- ---------------------------------------------------------------------
create function public.is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_user
    where auth_user_id = auth.uid() and role = 'REVIEWER' and is_active
  );
$$;

-- ---------------------------------------------------------------------
-- Rules for inserts and updates of idea
-- ---------------------------------------------------------------------
create function public.idea_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
  v_office text;
begin
  if tg_op = 'UPDATE' then
    -- Only the stage may change; who may change it follows with US-3
    if (new.idea_id, new.title, new.problem, new.solution, new.expected_impact, new.category_id,
        new.submitter_id, new.office, new.is_confidential, new.resubmission_of, new.created_at)
       is distinct from
       (old.idea_id, old.title, old.problem, old.solution, old.expected_impact, old.category_id,
        old.submitter_id, old.office, old.is_confidential, old.resubmission_of, old.created_at) then
      raise exception 'Only the stage of an idea can be changed';
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

create trigger trg_idea_check
  before insert or update on public.idea
  for each row execute function public.idea_check();

-- Trigger functions are not meant to be called through the API
revoke execute on function public.idea_check() from public, anon, authenticated;
revoke execute on function public.is_reviewer() from public, anon;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.category enable row level security;
alter table public.idea enable row level security;

-- Anonymous visitors see nothing
revoke all on public.category, public.idea from anon;
-- Category changes follow with the admin page (US-5); idea changes with US-3
revoke insert, update, delete, truncate on public.category from authenticated;
revoke update, delete, truncate on public.idea from authenticated;

create policy "Signed-in users can read categories"
  on public.category for select to authenticated
  using (true);

create policy "Active users can read visible ideas"
  on public.idea for select to authenticated
  using (
    (select public.current_app_user_id()) is not null
    and (
      not is_confidential
      or submitter_id = (select public.current_app_user_id())
      or (select public.is_reviewer())
    )
  );

create policy "Active users can submit their own ideas"
  on public.idea for insert to authenticated
  with check (submitter_id = (select public.current_app_user_id()));
