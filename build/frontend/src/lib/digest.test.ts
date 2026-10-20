import { describe, expect, it } from 'vitest';
import { digestWindow, inDigestWindow, isFirstWorkingDayOfMonth, rankDigest, type DigestCandidate } from './digest';

function candidate(idea_id: number, rating_sum: number, vote_count: number, created_at = '2026-01-01T00:00:00Z'): DigestCandidate {
  return {
    idea_id, title: `Idea ${idea_id}`, category_name: 'Sustainability', submitter_name: 'Sam', is_anonymous: false,
    review_count: 1, rating_sum, vote_count, created_at,
  };
}

describe('digest window', () => {
  it('covers the 31 days before the simulated day', () => {
    expect(digestWindow('2026-11-01')).toEqual({ from: '2026-10-01', lastDay: '2026-10-31' });
  });
  it('includes the start of the window and excludes the simulated day itself', () => {
    expect(inDigestWindow('2026-10-01T00:00:00Z', '2026-11-01')).toBe(true);
    expect(inDigestWindow('2026-09-30T23:59:00Z', '2026-11-01')).toBe(false);
    expect(inDigestWindow('2026-10-31T23:59:00Z', '2026-11-01')).toBe(true);
    expect(inDigestWindow('2026-11-01T00:00:00Z', '2026-11-01')).toBe(false);
  });
});

describe('first working day of the month', () => {
  it('is the 1st when it is a weekday', () => {
    expect(isFirstWorkingDayOfMonth('2026-10-01')).toBe(true); // Thursday
    expect(isFirstWorkingDayOfMonth('2026-10-02')).toBe(false);
  });
  it('is the Monday the 3rd when the 1st is a Saturday', () => {
    expect(isFirstWorkingDayOfMonth('2026-08-01')).toBe(false);
    expect(isFirstWorkingDayOfMonth('2026-08-02')).toBe(false);
    expect(isFirstWorkingDayOfMonth('2026-08-03')).toBe(true);
  });
  it('is the Monday the 2nd when the 1st is a Sunday', () => {
    expect(isFirstWorkingDayOfMonth('2026-11-01')).toBe(false);
    expect(isFirstWorkingDayOfMonth('2026-11-02')).toBe(true);
    expect(isFirstWorkingDayOfMonth('2026-11-03')).toBe(false);
  });
  it('rejects an empty or invalid date', () => {
    expect(isFirstWorkingDayOfMonth('')).toBe(false);
    expect(isFirstWorkingDayOfMonth('2026-11')).toBe(false);
  });
});

describe('ranking', () => {
  it('adds ratings and votes and sorts by the total', () => {
    const result = rankDigest([candidate(1, 10, 0), candidate(2, 6, 5), candidate(3, 3, 1)]);
    expect(result.map((r) => [r.idea_id, r.total])).toEqual([[2, 11], [1, 10], [3, 4]]);
  });
  it('puts the older idea first on a tie', () => {
    const result = rankDigest([candidate(1, 5, 0, '2026-03-01T00:00:00Z'), candidate(2, 5, 0, '2026-02-01T00:00:00Z')]);
    expect(result.map((r) => r.idea_id)).toEqual([2, 1]);
  });
  it('returns at most 5 ideas', () => {
    const many = [1, 2, 3, 4, 5, 6, 7].map((id) => candidate(id, id, 0));
    expect(rankDigest(many).map((r) => r.idea_id)).toEqual([7, 6, 5, 4, 3]);
  });
  it('does not return the creation time', () => {
    expect(rankDigest([candidate(1, 1, 0)])[0]).not.toHaveProperty('created_at');
  });
});
