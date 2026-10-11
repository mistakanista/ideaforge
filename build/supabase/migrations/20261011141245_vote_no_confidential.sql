-- =====================================================================
-- IdeaForge: confidential ideas get no votes (US-4 Vote ideas, story updated 2026-10-11:
-- "no votes are displayed for confidential ideas"; decided with the user: no voting at all)
--
-- Changes the rules of 20261011135710_vote.sql:
--   - vote_check() rejects every vote on a confidential idea, also from reviewers
--   - users who cannot see the idea still get "Idea … does not exist"; the submitter
--     still gets "You cannot vote for your own idea"
--   - existing votes on confidential ideas are deleted (only possible between the two
--     migrations, through a reviewer; the frontend did not use the vote table yet)
-- If is_confidential is ever changed later, a new rule must decide what happens to existing votes.
-- =====================================================================

create or replace function public.vote_check() returns trigger
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

  -- Same visibility as the idea policy: a confidential idea is only visible to the
  -- submitter and the reviewers; for everyone else it does not exist
  if v_idea.is_confidential and v_idea.submitter_id <> new.user_id and not exists (
    select 1 from public.app_user where user_id = new.user_id and role = 'REVIEWER'
  ) then
    raise exception 'Idea % does not exist', new.idea_id;
  end if;

  if v_idea.submitter_id = new.user_id then
    raise exception 'You cannot vote for your own idea';
  end if;

  if v_idea.is_confidential then
    raise exception 'Confidential ideas cannot get votes';
  end if;

  return new;
end $$;

-- create or replace keeps the grants; repeated to be explicit
revoke execute on function public.vote_check() from public, anon, authenticated;

delete from public.vote v
using public.idea i
where i.idea_id = v.idea_id and i.is_confidential;

comment on table public.vote is 'One vote per person and idea (US-4), never on confidential ideas. Deleting the row takes the vote back.';
