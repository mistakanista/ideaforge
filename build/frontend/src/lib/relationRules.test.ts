import { describe, expect, it } from 'vitest';
import type { IdeaListItem } from '../types';
import { canRelate, isRelatable, relationCandidates, relationLabel, relationRuleViolation, searchCandidates } from './relationRules';

const idea = (id: number, title: string, extra: Partial<IdeaListItem> = {}) =>
  ({ idea_id: id, title, is_confidential: false, current_stage: 'SUBMITTED', ...extra }) as IdeaListItem;

describe('relationLabel', () => {
  it('reads as set from the first idea and inverted from the other', () => {
    expect(relationLabel('DUPLICATES', true)).toBe('duplicates');
    expect(relationLabel('DUPLICATES', false)).toBe('is duplicated by');
    expect(relationLabel('REPLACES', true)).toBe('replaces');
    expect(relationLabel('REPLACES', false)).toBe('is replaced by');
  });
  it('is the same from both sides for "is related to"', () => {
    expect(relationLabel('RELATED_TO', true)).toBe('is related to');
    expect(relationLabel('RELATED_TO', false)).toBe('is related to');
  });
});

describe('who and what can be related', () => {
  it('lets only reviewers relate ideas', () => {
    expect(canRelate({ role: 'REVIEWER' })).toBe(true);
    expect(canRelate({ role: 'STAFF' })).toBe(false);
    expect(canRelate({ role: 'ADMIN' })).toBe(false);
  });
  it('excludes confidential and declined ideas', () => {
    expect(isRelatable(idea(1, 'a'))).toBe(true);
    expect(isRelatable(idea(1, 'a', { current_stage: 'IMPLEMENTED' }))).toBe(true);
    expect(isRelatable(idea(1, 'a', { is_confidential: true }))).toBe(false);
    expect(isRelatable(idea(1, 'a', { current_stage: 'DECLINED' }))).toBe(false);
  });
});

describe('relationRuleViolation', () => {
  const reviewer = { role: 'REVIEWER' as const };
  const a = idea(1, 'a');
  const b = idea(2, 'b');
  it('accepts a relation of two normal ideas, also if the reviewer owns one', () => {
    expect(relationRuleViolation(a, b, reviewer, false)).toBeNull();
  });
  it('uses the wording of the database', () => {
    expect(relationRuleViolation(a, b, { role: 'STAFF' }, false)).toBe('Only reviewers can relate ideas');
    expect(relationRuleViolation(a, a, reviewer, false)).toBe('An idea cannot be related to itself');
    expect(relationRuleViolation(a, idea(3, 'c', { is_confidential: true }), reviewer, false)).toBe('Confidential ideas cannot be related');
    expect(relationRuleViolation(idea(3, 'c', { is_confidential: true }), b, reviewer, false)).toBe('Confidential ideas cannot be related');
    expect(relationRuleViolation(a, idea(3, 'c', { current_stage: 'DECLINED' }), reviewer, false)).toBe('Declined ideas cannot be related');
    expect(relationRuleViolation(a, b, reviewer, true)).toBe('These ideas are already related');
  });
});

describe('relationCandidates', () => {
  const ideas = [
    idea(1, 'Shared car pool'),
    idea(2, 'bike racks'),
    idea(3, 'Salary bands', { is_confidential: true }),
    idea(4, 'Old idea', { current_stage: 'DECLINED' }),
    idea(5, 'Ride sharing'),
    idea(6, 'Free coffee'),
  ];
  it('lists the active ideas alphabetically, without the idea itself, confidential, declined and already related ones', () => {
    expect(relationCandidates(ideas, 1, [6]).map((i) => i.title)).toEqual(['bike racks', 'Ride sharing']);
  });
  it('searches the title, ignoring case', () => {
    const list = relationCandidates(ideas, 1, []);
    expect(searchCandidates(list, ' RIDE ').map((i) => i.idea_id)).toEqual([5]);
    expect(searchCandidates(list, '')).toHaveLength(3);
    expect(searchCandidates(list, 'zzz')).toEqual([]);
  });
});
