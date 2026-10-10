// Pure helpers for supabaseRepository: database rows -> app types, database errors -> messages.
// Kept free of the Supabase client so they can be unit tested.
import type { Idea, IdeaListItem, IdeaStage, OfficeCode } from '../types';
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
}

/** Votes still come from the mock data until the vote table exists (US-4). */
export interface VoteInfo {
  vote_count: number;
  voted_by_me: boolean;
}

export const NO_VOTES: VoteInfo = { vote_count: 0, voted_by_me: false };

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

export function toListItem(row: IdeaRow, votes: VoteInfo = NO_VOTES): IdeaListItem {
  return {
    ...toIdea(row),
    category_name: row.category?.name ?? 'Unknown',
    submitter_name: row.submitter?.display_name ?? 'Unknown',
    office: row.office,
    ...votes,
  };
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
