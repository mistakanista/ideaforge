-- =====================================================================
-- IdeaForge: scores are optional when an idea is declined (US-3 Move ideas, story updated 2026-10-11)
--
-- Changes the rule of 20261011104615_idea_transition.sql:
--   - a decline needs a reason; scores are optional, but either all three or none
--     (so averages and comparisons stay consistent)
--   - every other move needs all three scores; a reason is optional (unchanged)
-- Existing rows stay valid (declines without scores are still allowed).
-- =====================================================================

alter table public.idea_transition drop constraint ck_idea_transition_decline_or_score;

alter table public.idea_transition add constraint ck_idea_transition_decline_or_score check (
  (to_stage = 'DECLINED'
     and coalesce(length(trim(reason)), 0) > 0
     and (   (score_impact is null and score_cost is null and score_feasibility is null)
          or (score_impact is not null and score_cost is not null and score_feasibility is not null)))
  or
  (to_stage <> 'DECLINED'
     and score_impact is not null and score_cost is not null and score_feasibility is not null)
);

comment on table public.idea_transition is 'One row per stage change of an idea, with the review of the reviewer (scores, and a reason when declined).';
comment on column public.idea_transition.reason is 'Required when the idea is declined (shown to the submitter); optional remark otherwise.';
comment on column public.idea_transition.score_impact is '1 (low impact) to 5 (high impact); required for moves, optional when declined (all three scores or none).';
comment on column public.idea_transition.score_cost is '1 (high cost) to 5 (least cost); required for moves, optional when declined (all three scores or none).';
comment on column public.idea_transition.score_feasibility is '1 (hard) to 5 (easy to implement); required for moves, optional when declined (all three scores or none).';
