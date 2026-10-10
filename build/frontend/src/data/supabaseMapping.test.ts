import { describe, expect, it } from 'vitest';
import { RuleViolation } from './repository';
import { toAppError, toIdea, toListItem, type IdeaRow } from './supabaseMapping';

const row: IdeaRow = {
  idea_id: 61,
  title: 'Shared car pool',
  problem: 'Many single car trips',
  solution: 'A car pool board',
  expected_impact: 'Less travel cost',
  category_id: 3,
  submitter_id: 7,
  office: 'LEEDS',
  is_confidential: true,
  current_stage: 'SUBMITTED',
  resubmission_of: null,
  created_at: '2026-10-10T20:00:00+00:00',
  category: { name: 'Sustainability' },
  submitter: { display_name: 'Sofia Marin' },
};

describe('toIdea', () => {
  it('keeps the idea columns and drops the joined names', () => {
    const idea = toIdea(row);
    expect(idea).toMatchObject({ idea_id: 61, title: 'Shared car pool', is_confidential: true, current_stage: 'SUBMITTED' });
    expect(idea).not.toHaveProperty('category');
    expect(idea).not.toHaveProperty('office');
  });
});

describe('toListItem', () => {
  it('takes category name, submitter name and office from the row', () => {
    const item = toListItem(row, { vote_count: 4, voted_by_me: true });
    expect(item).toMatchObject({
      category_name: 'Sustainability',
      submitter_name: 'Sofia Marin',
      office: 'LEEDS',
      vote_count: 4,
      voted_by_me: true,
    });
  });

  it('has no votes by default and shows Unknown for missing names', () => {
    const item = toListItem({ ...row, category: null, submitter: null });
    expect(item).toMatchObject({ category_name: 'Unknown', submitter_name: 'Unknown', vote_count: 0, voted_by_me: false });
  });
});

describe('toAppError', () => {
  it('shows rule messages from the database triggers as they are', () => {
    const err = toAppError({ code: 'P0001', message: 'Please set your office in your profile before submitting an idea' });
    expect(err).toBeInstanceOf(RuleViolation);
    expect(err.message).toBe('Please set your office in your profile before submitting an idea');
  });

  it('explains failed checks, unknown categories and missing rights', () => {
    expect(toAppError({ code: '23514', message: 'check' }).message).toMatch(/title needs 3 to 200 characters/);
    expect(toAppError({ code: '23503', message: 'fk' }).message).toBe('Please choose a category from the list.');
    expect(toAppError({ code: '42501', message: 'denied' })).toBeInstanceOf(RuleViolation);
  });

  it('keeps other errors technical, so the page shows its generic message', () => {
    const err = toAppError({ code: '08006', message: 'connection failure' });
    expect(err).not.toBeInstanceOf(RuleViolation);
    expect(err.message).toBe('Database error: connection failure');
  });
});
