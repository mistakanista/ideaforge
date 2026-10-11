// Rules for votes (US-4), the same as in the database (trigger vote_check). The database enforces
// them anyway; checking them here hides the vote button where a vote is not possible and lets the
// mock data source behave like the database.

type VoteTarget = { is_confidential: boolean; submitted_by_me: boolean };

/** Confidential ideas get no votes, so no vote count is shown for them either. */
export function showsVotes(idea: Pick<VoteTarget, 'is_confidential'>): boolean {
  return !idea.is_confidential;
}

/** Whether the viewer may vote for an idea: not on confidential ideas, never on their own idea. */
export function canVote(idea: VoteTarget): boolean {
  return showsVotes(idea) && !idea.submitted_by_me;
}

/** Message for a vote that breaks a rule (same wording as the database). */
export function voteRuleViolation(idea: VoteTarget): string | null {
  if (idea.submitted_by_me) return 'You cannot vote for your own idea';
  if (idea.is_confidential) return 'Confidential ideas cannot get votes';
  return null;
}
