// Rules for the second chance of a declined idea (US-6), the same as in the database (trigger
// idea_check). The database enforces them anyway; checking them here hides the "Improve idea"
// button where it cannot work and lets the mock data source behave like the database.
import type { IdeaStage } from '../types';

type Original = { current_stage: IdeaStage; submitted_by_me: boolean; resubmission_of: number | null };

/** Whether the viewer may resubmit this idea: own, declined, itself a first attempt, not yet resubmitted. */
export function canImprove(idea: Original, alreadyResubmitted: boolean): boolean {
  return idea.submitted_by_me && idea.current_stage === 'DECLINED' && idea.resubmission_of === null && !alreadyResubmitted;
}

/** Message for a resubmission that breaks a rule (same wording as the database), or null. */
export function resubmitRuleViolation(
  original: (Omit<Original, 'submitted_by_me'> & { submitter_id: number }) | undefined,
  submitterId: number,
  alreadyResubmitted: boolean,
): string | null {
  if (!original || original.submitter_id !== submitterId) return 'You can only give your own declined ideas a second chance';
  if (original.current_stage !== 'DECLINED') return 'Only a declined idea can get a second chance';
  if (alreadyResubmitted) return 'This idea has already had its second chance';
  if (original.resubmission_of !== null) return 'An idea can get only one second chance';
  return null;
}
