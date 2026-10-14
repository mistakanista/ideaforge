import { describe, expect, it } from 'vitest';
import { hidesSubmitter, submitterLabel } from './anonymity';

describe('submitterLabel', () => {
  it('hides the name of an anonymous idea from other users', () => {
    expect(submitterLabel(true, false, 'Sam Taylor')).toBe('Anonymous');
  });
  it('shows the name to the submitter and for normal ideas', () => {
    expect(submitterLabel(true, true, 'Sam Taylor')).toBe('Sam Taylor');
    expect(submitterLabel(false, false, 'Sam Taylor')).toBe('Sam Taylor');
  });
});

describe('hidesSubmitter', () => {
  it('is true only for anonymous ideas of someone else', () => {
    expect(hidesSubmitter({ is_anonymous: true, submitted_by_me: false })).toBe(true);
    expect(hidesSubmitter({ is_anonymous: true, submitted_by_me: true })).toBe(false);
    expect(hidesSubmitter({ is_anonymous: false, submitted_by_me: false })).toBe(false);
  });
});
