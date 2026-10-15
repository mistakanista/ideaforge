// Pure helpers for supabaseRepository: database rows -> app types, database errors -> messages.
// Kept free of the Supabase client so they can be unit tested.
import { SCORING_CRITERIA } from '../config';
import type { AppUser, Category, CommentItem, Idea, IdeaListItem, IdeaStage, OfficeCode, ReviewerScorecard, StageHistoryEntry } from '../types';
import { RuleViolation } from './repository';
import { submitterLabel } from '../lib/anonymity';

/** Columns of public.idea read by the app (see supabase/migrations/20261010192020_idea.sql). */
export const IDEA_COLUMNS =
  'idea_id, title, problem, solution, expected_impact, category_id, submitter_id, office, is_confidential, is_anonymous, current_stage, resubmission_of, created_at';

/** Columns of public.app_user read by the admin user list (no auth_user_id, no password data). */
export const USER_COLUMNS = 'user_id, email, display_name, office, role, role_changed_by, role_changed_at, is_active';

/** A public.app_user row; office is NULL until the user has chosen one (first login). */
export type UserRow = Omit<AppUser, 'office'> & { office: OfficeCode | null };

/** Office shown until the user chooses one (same fallback as lib/sessionUser.ts). */
const FALLBACK_OFFICE: OfficeCode = 'BRISTOL';

export function toAppUser(row: UserRow): AppUser {
  return { ...row, office: row.office ?? FALLBACK_OFFICE };
}

/** Row level security hides rows silently, so an update that returns no row was not allowed (or the id is unknown). */
export function roleUpdateError(updatedRows: unknown[] | null): RuleViolation | null {
  return updatedRows && updatedRows.length > 0 ? null : new RuleViolation('You are not allowed to change this role.');
}

/** Columns of public.category read by the app (see supabase/migrations/20261010192020_idea.sql). */
export const CATEGORY_COLUMNS = 'category_id, name, description, sort_order, is_active';

/** A public.category row; the description is NULL when it is empty. */
export type CategoryRow = Omit<Category, 'description'> & { description: string | null };

export function toCategory(row: CategoryRow): Category {
  return { ...row, description: row.description ?? '' };
}

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
  is_anonymous: boolean;
  current_stage: IdeaStage;
  resubmission_of: number | null;
  created_at: string;
  category?: { name: string } | null;
  submitter?: { display_name: string } | null;
  /** Embedded rows of public.vote (see 20261011135710_vote.sql); RLS returns them only for visible ideas. */
  vote?: { user_id: number }[] | null;
  /** Embedded ids of public.comment (see 20261015220429_comment.sql), only to count them; RLS returns them only for visible ideas. */
  comment?: { comment_id: number }[] | null;
  /** Embedded times of the idea's rows in public.idea_transition (for "Last reviewed first"). */
  idea_transition?: { created_at: string }[] | null;
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
    is_anonymous: row.is_anonymous,
    resubmission_of: row.resubmission_of,
    created_at: row.created_at,
  };
}

/** Time of the latest review of an idea, or null if it was never reviewed. */
export function lastReviewedAt(transitions: { created_at: string }[] | null | undefined): string | null {
  return (transitions ?? []).reduce<string | null>(
    (latest, t) => (latest === null || new Date(t.created_at) > new Date(latest) ? t.created_at : latest),
    null,
  );
}

/** ownUserId is the viewer's app_user.user_id in the database (not the mock user id). */
export function toListItem(row: IdeaRow, votes: VoteInfo = NO_VOTES, ownUserId: number | null = null): IdeaListItem {
  const submitted_by_me = ownUserId !== null && row.submitter_id === ownUserId;
  return {
    ...toIdea(row),
    category_name: row.category?.name ?? 'Unknown',
    submitter_name: submitterLabel(row.is_anonymous, submitted_by_me, row.submitter?.display_name ?? 'Unknown'),
    office: row.office,
    ...votes,
    comment_count: row.comment?.length ?? 0,
    submitted_by_me,
    last_reviewed_at: lastReviewedAt(row.idea_transition),
  };
}

/** Columns of public.comment read by the app, with the author name (see 20261015220429_comment.sql). */
export const COMMENT_COLUMNS =
  'comment_id, idea_id, author_id, parent_comment_id, body, created_at, author:app_user!comment_author_id_fkey(display_name)';

export interface CommentRow {
  comment_id: number;
  idea_id: number;
  author_id: number;
  parent_comment_id: number | null;
  body: string;
  created_at: string;
  author?: { display_name: string } | null;
}

/** ownUserId is the viewer's app_user.user_id in the database (not the mock user id). */
export function toCommentItem(row: CommentRow, ownUserId: number | null): CommentItem {
  return {
    comment_id: row.comment_id,
    idea_id: row.idea_id,
    author_id: row.author_id,
    parent_comment_id: row.parent_comment_id,
    body: row.body,
    created_at: row.created_at,
    author_name: row.author?.display_name ?? 'Unknown',
    by_me: ownUserId !== null && row.author_id === ownUserId,
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

/** Like toAppError, with the messages that fit the category form (US-5). */
export function toCategoryError(error: DatabaseError): Error {
  switch (error.code) {
    case '23505':
      return new RuleViolation('A category with this name already exists.');
    case '23514':
      return new RuleViolation('Please enter a name.');
    default:
      return toAppError(error);
  }
}
