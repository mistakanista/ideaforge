-- =====================================================================
-- IdeaForge: votes for ideas (US-4 Vote ideas)
-- Based on design/DataModel/V2-StammdatenIntegriert (table vote, unchanged).
-- Decided 2026-10-11:
--   * all roles can vote (staff, reviewers, admins), but never for their own idea
--   * a vote can be taken back (deleted) by the voter
--   * votes are possible in every stage, also on implemented and declined ideas
--
-- Rules enforced in the database:
--   - one vote per person per idea (primary key)
--   - a user can never vote for their own idea
--   - only active users vote, and only on ideas they may see (confidential ideas:
--     reviewers only, because the submitter cannot vote for their own idea)
--   - through the API, user_id and created_at are set by the database and cannot be faked
--   - votes are visible to everyone who can see the idea
--   - users delete only their own votes; votes cannot be changed
-- =====================================================================

create table public.vote (
  idea_id    bigint      not null references public.idea (idea_id),
  user_id    bigint      not null references public.app_user (user_id),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- "My votes" and the user lookup of the foreign key; idea lookups use the primary key
create index ix_vote_user on public.vote (user_id);

comment on table public.vote is 'One vote per person and idea (US-4). Deleting the row takes the vote back.';
comment on column public.vote.user_id is 'Voter; set to the signed-in user by trigger. Never the submitter of the idea.';

-- ---------------------------------------------------------------------
-- Rules for new votes
-- ---------------------------------------------------------------------
create function public.vote_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
  v_idea public.idea%rowtype;
begin
  if via_api then
    -- The voter is always the signed-in user
    new.user_id := public.current_app_user_id();
    new.created_at := now();
  end if;

  if not exists (select 1 from public.app_user where user_id = new.user_id and is_active) then
    raise exception 'Only active users can vote';
  end if;

  select * into v_idea from public.idea where idea_id = new.idea_id;
  if not found then
    raise exception 'Idea % does not exist', new.idea_id;
  end if;

  if v_idea.submitter_id = new.user_id then
    raise exception 'You cannot vote for your own idea';
  end if;

  -- Same visibility as the idea policy: a confidential idea is only visible to the
  -- submitter (excluded above) and the reviewers
  if v_idea.is_confidential and not exists (
    select 1 from public.app_user where user_id = new.user_id and role = 'REVIEWER'
  ) then
    raise exception 'Idea % does not exist', new.idea_id;
  end if;

  return new;
end $$;

create trigger trg_vote_check
  before insert on public.vote
  for each row execute function public.vote_check();

-- Trigger functions are not meant to be called through the API
revoke execute on function public.vote_check() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.vote enable row level security;

-- Anonymous visitors see nothing; votes cannot be changed, only taken back
revoke all on public.vote from anon;
revoke update, truncate on public.vote from authenticated;

-- The subquery on idea applies the idea policies: whoever sees the idea sees its votes
create policy "Active users can read the votes of visible ideas"
  on public.vote for select to authenticated
  using (exists (select 1 from public.idea i where i.idea_id = vote.idea_id));

create policy "Active users can vote"
  on public.vote for insert to authenticated
  with check (user_id = (select public.current_app_user_id()));

create policy "Users can take back their own votes"
  on public.vote for delete to authenticated
  using (user_id = (select public.current_app_user_id()));
