// Pure helpers for supabaseRepository: database rows -> app types, database errors -> messages.
// Kept free of the Supabase client so they can be unit tested.
import { SCORING_CRITERIA } from '../config';
import type { Idea, IdeaListItem, IdeaStage, OfficeCode, ReviewerScorecard, StageHistoryEntry } from '../types';
import { RuleViolation } from './repository';

/** Columns of public.idea read by the app (see supabase/migrations/20261010192020_idea.sql). */
export const IDEA_COLUMNS =
  'idea_id, title, problem, solution, expected_impact, category_id, submitter_id, office, is_confidential, current_stage, resubmission_of, created_at';

/** An idea row with the joined category name and submitter name. */
export interface IdeaRow {
  idea_id: number;
  title: string;
  problem: string;
  solution: string;
  expected_impact: string;
  category_id: number;
  submitter_id: number;
  office: OfficeCode;
  is_confidential: boolean;
  current_stage: IdeaStage;
  resubmission_of: number | null;
  created_at: string;
  category?: { name: string } | null;
  submitter?: { display_name: string } | null;
  /** Embedded rows of public.vote (see 20261011135710_vote.sql); RLS returns them only for visible ideas. */
  vote?: { user_id: number }[] | null;
}

export interface VoteInfo {
  vote_count: number;
  voted_by_me: boolean;
}

export const NO_VOTES: VoteInfo = { vote_count: 0, voted_by_me: false };

/** Vote count of an idea and whether the viewer (own app_user.user_id) voted for it. */
export function toVoteInfo(votes: { user_id: number }[] | null | undefined, ownUserId: number | null): VoteInfo {
  const rows = votes ?? [];
  return {
    vote_count: rows.length,
    voted_by_me: ownUserId !== null && rows.some((v) => v.user_id === ownUserId),
  };
}

export function toIdea(row: IdeaRow): Idea {
  return {
    idea_id: row.idea_id,
    title: row.title,
    problem: row.problem,
    solution: row.solution,
    expected_impact: row.expected_impact,
    category_id: row.category_id,
    submitter_id: row.submitter_id,
    current_stage: row.current_stage,
    is_confidential: row.is_confidential,
    resubmission_of: row.resubmission_of,
    created_at: row.created_at,
  };
}

/** ownUserId is the viewer's app_user.user_id in the database (not the mock user id). */
export function toListItem(row: IdeaRow, votes: VoteInfo = NO_VOTES, ownUserId: number | null = null): IdeaListItem {
  return {
    ...toIdea(row),
    category_name: row.category?.name ?? 'Unknown',
    submitter_name: row.submitter?.display_name ?? 'Unknown',
    office: row.office,
    ...votes,
    submitted_by_me: ownUserId !== null && row.submitter_id === ownUserId,
  };
}

/** Columns of public.idea_transition read by the app, with the reviewer name (see 20261011104615_idea_transition.sql). */
export const TRANSITION_COLUMNS =
  'transition_id, from_stage, to_stage, changed_by, reason, score_impact, score_cost, score_feasibility, created_at, ' +
  'reviewer:app_user!idea_transition_changed_by_fkey(display_name)';

/** A stage change of one idea; scores are NULL only for declines without scores. */
export interface TransitionRow {
  transition_id: number;
  from_stage: IdeaStage;
  to_stage: IdeaStage;
  changed_by: number;
  reason: string | null;
  score_impact: number | null;
  score_cost: number | null;
  score_feasibility: number | null;
  created_at: string;
  reviewer?: { display_name: string } | null;
}

const CRITERION_ID = Object.fromEntries(SCORING_CRITERIA.map((c) => [c.code, c.criterion_id])) as Record<
  (typeof SCORING_CRITERIA)[number]['code'],
  number
>;

/**
 * Review scores and stage history of an idea from its idea_transition rows.
 * Scorecards: one per scored move, oldest first. History: newest first, ending with the submission
 * (which is not a transition, so it is built from the idea itself).
 */
export function toReviewDetails(
  idea: IdeaListItem,
  rows: TransitionRow[],
): { scorecards: ReviewerScorecard[]; history: StageHistoryEntry[] } {
  const byTime = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.transition_id - b.transition_id);
  const reviewerName = (row: TransitionRow) => row.reviewer?.display_name ?? 'Unknown';

  const scorecards = byTime
    .filter((row) => row.score_impact !== null && row.score_cost !== null && row.score_feasibility !== null)
    .map((row) => ({
      key: String(row.transition_id),
      reviewer_id: row.changed_by,
      reviewer_name: reviewerName(row),
      scores: {
        [CRITERION_ID.IMPACT]: row.score_impact as number,
        [CRITERION_ID.COST]: row.score_cost as number,
        [CRITERION_ID.FEASIBILITY]: row.score_feasibility as number,
      },
      to_stage: row.to_stage,
      reviewed_at: row.created_at,
    }));

  const submitted: StageHistoryEntry = {
    history_id: 0,
    idea_id: idea.idea_id,
    from_stage: null,
    to_stage: 'SUBMITTED',
    changed_by: idea.submitter_id,
    changed_by_name: idea.submitter_name,
    reason: 'Idea submitted.',
    changed_at: idea.created_at,
  };
  const moves = byTime.map((row) => ({
    history_id: row.transition_id,
    idea_id: idea.idea_id,
    from_stage: row.from_stage,
    to_stage: row.to_stage,
    changed_by: row.changed_by,
    changed_by_name: reviewerName(row),
    reason: row.reason ?? '',
    changed_at: row.created_at,
  }));

  return { scorecards, history: [submitted, ...moves].reverse() };
}

/** The parts of a PostgrestError the app looks at. */
export interface DatabaseError {
  code?: string;
  message: string;
}

/**
 * Turns a database error into an error the pages can show.
 * Rule messages raised by our triggers (code P0001) are written for users and shown as they are.
 */
export function toAppError(error: DatabaseError): Error {
  switch (error.code) {
    case 'P0001':
      return new RuleViolation(error.message);
    case '23514':
      return new RuleViolation('Please fill in all required fields. The title needs 3 to 200 characters.');
    case '23503':
      return new RuleViolation('Please choose a category from the list.');
    case '42501':
      return new RuleViolation('You are not allowed to do this.');
    default:
      return new Error(`Database error: ${error.message}`);
  }
}
