import { describe, expect, it } from 'vitest';
import { canVote, showsVotes, voteRuleViolation } from './voteRules';

describe('vote rules', () => {
  it('lets the viewer vote for someone else\'s idea', () => {
    const idea = { is_confidential: false, submitted_by_me: false };
    expect(canVote(idea)).toBe(true);
    expect(showsVotes(idea)).toBe(true);
    expect(voteRuleViolation(idea)).toBeNull();
  });
  it('never lets the viewer vote for their own idea, but shows its votes', () => {
    const idea = { is_confidential: false, submitted_by_me: true };
    expect(canVote(idea)).toBe(false);
    expect(showsVotes(idea)).toBe(true);
    expect(voteRuleViolation(idea)).toBe('You cannot vote for your own idea');
  });
  it('shows no votes and no vote button for confidential ideas', () => {
    for (const submitted_by_me of [false, true]) {
      const idea = { is_confidential: true, submitted_by_me };
      expect(canVote(idea)).toBe(false);
      expect(showsVotes(idea)).toBe(false);
      expect(voteRuleViolation(idea)).not.toBeNull();
    }
  });
});
