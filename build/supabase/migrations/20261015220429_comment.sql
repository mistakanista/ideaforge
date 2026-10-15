-- =====================================================================
-- IdeaForge: comments on ideas (US-7 Comments on ideas)
-- Based on design/DataModel/V2-StammdatenIntegriert (table comment). Differences:
--   * no deleted_at: a comment is really deleted (decided 2026-10-15)
--   * body length is limited (1-2000 characters)
-- Decided 2026-10-15:
--   * answers to answers are allowed (thread of any depth)
--   * confidential ideas get no comments at all (same as votes)
--
-- Rules enforced in the database:
--   - every active user can comment on every visible, non-confidential idea, in every stage
--   - an answer belongs to the same idea as the comment it answers
--   - through the API, author_id and created_at are set by the database and cannot be faked
--   - comments are visible to everyone who can see the idea
--   - comments cannot be changed
--   - users delete only their own comments, and only while nobody has answered:
--     the foreign key on parent_comment_id has no cascade, so deleting a comment
--     with answers fails with error 23503
-- =====================================================================

create table public.comment (
  comment_id        bigint      generated always as identity primary key,
  idea_id           bigint      not null references public.idea (idea_id),
  author_id         bigint      not null references public.app_user (user_id),
  parent_comment_id bigint      references public.comment (comment_id),
  body              text        not null check (length(body) between 1 and 2000),
  created_at        timestamptz not null default now()
);

-- Listing of an idea, newest first; answers of a comment; "my comments" and the author foreign key
create index ix_comment_idea on public.comment (idea_id, created_at desc);
create index ix_comment_parent on public.comment (parent_comment_id);
create index ix_comment_author on public.comment (author_id);

comment on table public.comment is 'Comment on an idea or answer to another comment (US-7). Deleting the row removes the comment, which the foreign key only allows while nobody has answered.';
comment on column public.comment.author_id is 'Set to the signed-in user by trigger.';
comment on column public.comment.parent_comment_id is 'The comment this one answers; NULL for a comment directly on the idea.';

-- ---------------------------------------------------------------------
-- Rules for new comments
-- ---------------------------------------------------------------------
create function public.comment_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  via_api constant boolean := auth.uid() is not null;  -- request from a signed-in app user
  v_idea public.idea%rowtype;
  v_parent_idea_id bigint;
begin
  if via_api then
    -- The author is always the signed-in user
    new.author_id := public.current_app_user_id();
    new.created_at := now();
  end if;

  new.body := btrim(new.body);

  if not exists (select 1 from public.app_user where user_id = new.author_id and is_active) then
    raise exception 'Only active users can comment';
  end if;

  select * into v_idea from public.idea where idea_id = new.idea_id;
  if not found then
    raise exception 'Idea % does not exist', new.idea_id;
  end if;

  -- Same visibility as the idea policy: a confidential idea is only visible to the
  -- submitter and the reviewers; for everyone else it does not exist
  if v_idea.is_confidential and v_idea.submitter_id <> new.author_id and not exists (
    select 1 from public.app_user where user_id = new.author_id and role = 'REVIEWER'
  ) then
    raise exception 'Idea % does not exist', new.idea_id;
  end if;

  if v_idea.is_confidential then
    raise exception 'Confidential ideas cannot get comments';
  end if;

  if new.parent_comment_id is not null then
    select idea_id into v_parent_idea_id from public.comment where comment_id = new.parent_comment_id;
    if v_parent_idea_id is distinct from new.idea_id then
      raise exception 'The comment you answer does not belong to this idea';
    end if;
  end if;

  return new;
end $$;

create trigger trg_comment_check
  before insert on public.comment
  for each row execute function public.comment_check();

-- Trigger functions are not meant to be called through the API
revoke execute on function public.comment_check() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.comment enable row level security;

-- Anonymous visitors see nothing; comments cannot be changed, only deleted by their author
revoke all on public.comment from anon;
revoke update, truncate on public.comment from authenticated;

-- The subquery on idea applies the idea policies: whoever sees the idea sees its comments
create policy "Active users can read the comments of visible ideas"
  on public.comment for select to authenticated
  using (exists (select 1 from public.idea i where i.idea_id = comment.idea_id));

create policy "Active users can comment"
  on public.comment for insert to authenticated
  with check (author_id = (select public.current_app_user_id()));

-- A comment with answers is refused by the foreign key (23503), not by this policy
create policy "Users can delete their own comments"
  on public.comment for delete to authenticated
  using (author_id = (select public.current_app_user_id()));
