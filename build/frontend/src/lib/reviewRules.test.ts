import { describe, expect, it } from 'vitest';
import type { AppUser } from '../types';
import { canReview, isFinalStage, nextStage, validateReview, type ReviewDraft } from './reviewRules';

const reviewer: AppUser = {
  user_id: 2,
  email: 'ruth.evans@tallis.uk',
  display_name: 'Ruth Evans',
  office: 'LEEDS',
  role: 'REVIEWER',
  role_changed_by: 1,
  role_changed_at: null,
  is_active: true,
};

const draft = (values: Partial<ReviewDraft>): ReviewDraft => ({
  decision: 'MOVE',
  impact: 4,
  cost: 3,
  feasibility: 5,
  reason: '',
  ...values,
});

describe('nextStage', () => {
  it('follows the pipeline order without skipping a stage', () => {
    expect(nextStage('SUBMITTED')).toBe('UNDER_REVIEW');
    expect(nextStage('UNDER_REVIEW')).toBe('PILOTING');
    expect(nextStage('PILOTING')).toBe('IMPLEMENTED');
  });
  it('has no next stage for implemented and declined ideas', () => {
    expect(nextStage('IMPLEMENTED')).toBeNull();
    expect(nextStage('DECLINED')).toBeNull();
    expect(isFinalStage('IMPLEMENTED')).toBe(true);
    expect(isFinalStage('DECLINED')).toBe(true);
    expect(isFinalStage('PILOTING')).toBe(false);
  });
});

describe('canReview', () => {
  const open = { current_stage: 'SUBMITTED' as const, submitted_by_me: false };
  it('allows active reviewers on open ideas of others', () => {
    expect(canReview(reviewer, open)).toBe(true);
  });
  it('never allows staff, admins, own ideas, final stages or deactivated reviewers', () => {
    expect(canReview({ ...reviewer, role: 'STAFF' }, open)).toBe(false);
    expect(canReview({ ...reviewer, role: 'ADMIN' }, open)).toBe(false);
    expect(canReview(reviewer, { ...open, submitted_by_me: true })).toBe(false);
    expect(canReview(reviewer, { ...open, current_stage: 'IMPLEMENTED' })).toBe(false);
    expect(canReview(reviewer, { ...open, current_stage: 'DECLINED' })).toBe(false);
    expect(canReview({ ...reviewer, is_active: false }, open)).toBe(false);
  });
});

describe('validateReview', () => {
  it('moves to the next stage with all three scores and an optional, trimmed reason', () => {
    expect(validateReview('UNDER_REVIEW', draft({ reason: '  Looks good ' }))).toEqual({
      input: { to_stage: 'PILOTING', reason: 'Looks good', scores: { impact: 4, cost: 3, feasibility: 5 } },
    });
    expect(validateReview('SUBMITTED', draft({})).input?.reason).toBe('');
  });
  it('needs a decision', () => {
    expect(validateReview('SUBMITTED', draft({ decision: null })).errors?.to_stage).toBeDefined();
  });
  it('needs all three scores for a move', () => {
    expect(validateReview('SUBMITTED', draft({ cost: null })).errors?.scores).toBe('Please score impact, cost and feasibility.');
  });
  it('needs a reason for a decline, scores are optional', () => {
    const none = { impact: null, cost: null, feasibility: null };
    expect(validateReview('PILOTING', draft({ decision: 'DECLINE', ...none, reason: '  ' })).errors?.reason).toBeDefined();
    expect(validateReview('PILOTING', draft({ decision: 'DECLINE', ...none, reason: 'Too expensive' }))).toEqual({
      input: { to_stage: 'DECLINED', reason: 'Too expensive', scores: null },
    });
    expect(validateReview('PILOTING', draft({ decision: 'DECLINE', reason: 'Too expensive' })).input?.scores).toEqual({
      impact: 4,
      cost: 3,
      feasibility: 5,
    });
  });
  it('accepts all three scores or none for a decline', () => {
    expect(validateReview('SUBMITTED', draft({ decision: 'DECLINE', feasibility: null, reason: 'No' })).errors?.scores).toBe(
      'Please give all three scores or none.',
    );
  });
  it('rejects scores outside 1 to 5', () => {
    expect(validateReview('SUBMITTED', draft({ impact: 0 })).errors?.scores).toBeDefined();
    expect(validateReview('SUBMITTED', draft({ cost: 6 })).errors?.scores).toBeDefined();
  });
  it('rejects reviews of implemented or declined ideas', () => {
    expect(validateReview('IMPLEMENTED', draft({})).errors?.to_stage).toBe('This idea cannot be reviewed any more.');
    expect(validateReview('DECLINED', draft({ decision: 'DECLINE', reason: 'x' })).errors?.to_stage).toBeDefined();
  });
});
