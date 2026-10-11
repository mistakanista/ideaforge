// Rules for reviews (US-3), the same as in the database (trigger idea_transition_check and the check
// ck_idea_transition_decline_or_score). The database enforces them anyway; checking them here gives
// early, readable messages and lets the mock data source behave like the database.
import { MAX_SCORE, MIN_SCORE, STAGES } from '../config';
import type { AppUser, IdeaStage, ReviewInput } from '../types';

const PIPELINE: IdeaStage[] = STAGES.map((s) => s.code).filter((code) => code !== 'DECLINED');

/** The stage after the given one, or null when the idea cannot move on (implemented or declined). */
export function nextStage(stage: IdeaStage): IdeaStage | null {
  const index = PIPELINE.indexOf(stage);
  return index >= 0 && index < PIPELINE.length - 1 ? PIPELINE[index + 1] : null;
}

/** Implemented and declined ideas are final. */
export function isFinalStage(stage: IdeaStage): boolean {
  return stage === 'DECLINED' || nextStage(stage) === null;
}

/** Whether the viewer may review an idea: an active reviewer, not the submitter, idea still open. */
export function canReview(viewer: AppUser, idea: { current_stage: IdeaStage; submitted_by_me: boolean }): boolean {
  return viewer.role === 'REVIEWER' && viewer.is_active && !idea.submitted_by_me && !isFinalStage(idea.current_stage);
}

export type ReviewField = 'to_stage' | 'scores' | 'reason';

/** Form values: a score is null until it is chosen. */
export interface ReviewDraft {
  decision: 'MOVE' | 'DECLINE' | null;
  impact: number | null;
  cost: number | null;
  feasibility: number | null;
  reason: string;
}

function validScore(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE;
}

/**
 * Checks a review of an idea in stage `from`. Returns either the input for the repository
 * or the messages per field.
 */
export function validateReview(
  from: IdeaStage,
  draft: ReviewDraft,
): { input: ReviewInput; errors?: undefined } | { input?: undefined; errors: Partial<Record<ReviewField, string>> } {
  const errors: Partial<Record<ReviewField, string>> = {};
  const values = [draft.impact, draft.cost, draft.feasibility];
  const chosen = values.filter((v) => v !== null).length;
  const reason = draft.reason.trim();
  const next = nextStage(from);

  if (isFinalStage(from)) errors.to_stage = 'This idea cannot be reviewed any more.';
  else if (draft.decision === null) errors.to_stage = 'Please choose whether to move or decline the idea.';

  if (draft.decision === 'MOVE' && chosen < 3) {
    errors.scores = 'Please score impact, cost and feasibility.';
  } else if (draft.decision === 'DECLINE' && chosen > 0 && chosen < 3) {
    errors.scores = 'Please give all three scores or none.';
  } else if (chosen > 0 && !values.every(validScore)) {
    errors.scores = `Scores must be between ${MIN_SCORE} and ${MAX_SCORE}.`;
  }

  if (draft.decision === 'DECLINE' && !reason) errors.reason = 'Please give a reason for declining the idea.';

  if (Object.keys(errors).length > 0 || draft.decision === null) return { errors };
  return {
    input: {
      to_stage: draft.decision === 'DECLINE' ? 'DECLINED' : (next as IdeaStage),
      reason,
      scores: chosen === 3 ? { impact: draft.impact!, cost: draft.cost!, feasibility: draft.feasibility! } : null,
    },
  };
}
