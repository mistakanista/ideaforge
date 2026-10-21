-- =====================================================================
-- IdeaForge: relate ideas (US-13, CR-2, step 1)
-- Ideas are related, not merged: both ideas stay untouched, each keeps its
-- owner, votes and reviews.
-- Decided 2026-10-21:
--   * relation types: DUPLICATES, REPLACES, RELATED_TO
--   * one row per relation; the other idea sees the inverse label ("is duplicated
--     by", "is replaced by") - the app derives it, nothing is stored twice
--   * confidential ideas cannot be related, so relations are visible to everyone
--   * a reviewer can also relate their own ideas
--   * "active" idea = not DECLINED (open question for the client)
--   * relations cannot be changed or removed (not in the criteria)
--
-- Rules enforced in the database:
--   - only active reviewers can relate ideas
--   - an idea cannot be related to itself; a pair of ideas has only one relation,
--     whatever the direction
--   - neither idea may be confidential or declined
--   - through the API, created_by and created_at are set by the database
--   - every signed-in active user can read all relations
-- =====================================================================

create type public.idea_relation_type as enum ('DUPLICATES', 'REPLACES', 'RELATED_TO');

create table public.idea_relation (
  relation_id      bigint generated always as identity primary key,
  idea_id          bigint not null references public.idea (idea_id) on delete cascade,
  related_idea_id  bigint not null references public.idea (idea_id) on delete cascade,
  relation_type    public.idea_relation_type not null,
  created_by       bigint not null references public.app_user (user_id),
  created_at       timestamptz not null default now(),
  check (idea_id <> related_idea_id)
);

-- One relation per pair of ideas, in either direction
create unique index ux_idea_relation_pair
  on public.idea_relation (least(idea_id, related_idea_id), greatest(idea_id, related_idea_id));
-- Lookup from the other side (the idea_id side is covered by the pair index only for least())
create index ix_idea_relation_idea on public.idea_relation (idea_id);
create index ix_idea_relation_related on public.idea_relation (related_idea_id);
create index ix_idea_relation_created_by on public.idea_relation (created_by);

comment on table public.idea_relation is 'A reviewer relates two ideas (US-13). Read idea_id -> related_idea_id: "idea_id duplicates / replaces / is related to related_idea_id".';
comment on column public.idea_relation.created_by is 'Reviewer who set the relation; set to the signed-in user by trigger.';

-- ---------------------------------------------------------------------
-- Rules for new relations
-- ---------------------------------------------------------------------
create function public.idea_relation_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
  v_idea public.idea%rowtype;
  v_id bigint;
begin
  if via_api then
    new.created_by := public.current_app_user_id();
    new.created_at := now();
  end if;

  if not exists (
    select 1 from public.app_user where user_id = new.created_by and role = 'REVIEWER' and is_active
  ) then
    raise exception 'Only reviewers can relate ideas';
  end if;

  foreach v_id in array array[new.idea_id, new.related_idea_id] loop
    select * into v_idea from public.idea where idea_id = v_id;
    if not found then
      raise exception 'Idea % does not exist', v_id;
    end if;
    if v_idea.is_confidential then
      raise exception 'Confidential ideas cannot be related';
    end if;
    if v_idea.current_stage = 'DECLINED' then
      raise exception 'Declined ideas cannot be related';
    end if;
  end loop;

  return new;
end $$;

create trigger trg_idea_relation_check
  before insert on public.idea_relation
  for each row execute function public.idea_relation_check();

-- Trigger functions are not meant to be called through the API
revoke execute on function public.idea_relation_check() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.idea_relation enable row level security;

-- Anonymous visitors see nothing; relations cannot be changed or removed
revoke all on public.idea_relation from anon;
revoke update, delete, truncate on public.idea_relation from authenticated;

-- Confidential ideas cannot be related, so every relation is visible to every active user
create policy "Active users can read relations"
  on public.idea_relation for select to authenticated
  using ((select public.current_app_user_id()) is not null);

create policy "Reviewers can relate ideas"
  on public.idea_relation for insert to authenticated
  with check (created_by = (select public.current_app_user_id()) and (select public.is_reviewer()));
