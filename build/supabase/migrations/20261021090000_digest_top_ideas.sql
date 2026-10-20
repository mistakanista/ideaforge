-- =====================================================================
-- IdeaForge: top ideas of the last 31 days (US-12 Email digest, CR-1)
--
-- digest_top_ideas(as_of) returns the 5 best ideas for the digest page and the
-- digest test email. Decided 2026-10-20 (maintenance/CR-1-changeImpactNote.md):
--   * window: reviews from (as_of - 31 days) up to, but not including, as_of
--   * rating: sum of impact, cost and feasibility of ALL scored reviews of the
--     idea in the window (every reviewer, every stage change)
--   * votes: the current votes of the idea (a withdrawn vote leaves no trace)
--   * total = rating + votes; ties: the older idea first
--   * left out: ideas that are DECLINED now, confidential ideas, and ideas
--     without a scored review in the window (scores of a decline do not count)
--   * the submitter name is NULL for anonymous ideas
--   * only admins can call it; it is SECURITY DEFINER because admins cannot
--     see confidential ideas through row level security, and it leaves them out
-- =====================================================================

create function public.digest_top_ideas(p_as_of date)
returns table (
  idea_id        bigint,
  title          text,
  category_name  text,
  submitter_name text,
  is_anonymous   boolean,
  review_count   integer,
  rating_sum     integer,
  vote_count     integer,
  total          integer
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the digest';
  end if;

  return query
  with reviews as (
    select t.idea_id,
           count(*)::integer as review_count,
           sum(t.score_impact + t.score_cost + t.score_feasibility)::integer as rating_sum
    from public.idea_transition t
    where t.to_stage <> 'DECLINED'
      and t.score_impact is not null
      and t.created_at >= (p_as_of - 31)::timestamptz
      and t.created_at <  p_as_of::timestamptz
    group by t.idea_id
  ),
  votes as (
    select v.idea_id, count(*)::integer as vote_count
    from public.vote v
    group by v.idea_id
  )
  select i.idea_id,
         i.title,
         c.name,
         case when i.is_anonymous then null else u.display_name end,
         i.is_anonymous,
         r.review_count,
         r.rating_sum,
         coalesce(v.vote_count, 0),
         r.rating_sum + coalesce(v.vote_count, 0)
  from reviews r
  join public.idea i on i.idea_id = r.idea_id
  join public.category c on c.category_id = i.category_id
  join public.app_user u on u.user_id = i.submitter_id
  left join votes v on v.idea_id = i.idea_id
  where not i.is_confidential
    and i.current_stage <> 'DECLINED'
  order by r.rating_sum + coalesce(v.vote_count, 0) desc, i.created_at, i.idea_id
  limit 5;
end $$;

comment on function public.digest_top_ideas(date) is 'Top 5 ideas of the 31 days before p_as_of: all review scores plus current votes (US-12). Admins only; no confidential ideas; no submitter name for anonymous ideas.';

revoke execute on function public.digest_top_ideas(date) from public, anon;
grant execute on function public.digest_top_ideas(date) to authenticated;
