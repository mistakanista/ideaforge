import { describe, expect, it } from 'vitest';
import { canImprove, resubmitRuleViolation } from './resubmitRules';

const declined = { current_stage: 'DECLINED', submitted_by_me: true, resubmission_of: null, submitter_id: 1 } as const;

describe('resubmit rules', () => {
  it('lets the submitter improve their declined first attempt once', () => {
    expect(canImprove(declined, false)).toBe(true);
    expect(canImprove(declined, true)).toBe(false);
  });
  it('does not offer it for other stages, other people or second attempts', () => {
    expect(canImprove({ ...declined, current_stage: 'UNDER_REVIEW' }, false)).toBe(false);
    expect(canImprove({ ...declined, submitted_by_me: false }, false)).toBe(false);
    expect(canImprove({ ...declined, resubmission_of: 5 }, false)).toBe(false);
  });
  it('words the violations like the database', () => {
    expect(resubmitRuleViolation(declined, 1, false)).toBeNull();
    expect(resubmitRuleViolation(undefined, 1, false)).toBe('You can only give your own declined ideas a second chance');
    expect(resubmitRuleViolation(declined, 2, false)).toBe('You can only give your own declined ideas a second chance');
    expect(resubmitRuleViolation({ ...declined, current_stage: 'PILOTING' }, 1, false)).toBe('Only a declined idea can get a second chance');
    expect(resubmitRuleViolation(declined, 1, true)).toBe('This idea has already had its second chance');
    expect(resubmitRuleViolation({ ...declined, resubmission_of: 5 }, 1, false)).toBe('An idea can get only one second chance');
  });
});
