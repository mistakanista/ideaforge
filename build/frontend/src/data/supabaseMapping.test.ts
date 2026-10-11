import { describe, expect, it } from 'vitest';
import { RuleViolation } from './repository';
import { NO_VOTES, toAppError, toIdea, toListItem, toReviewDetails, toVoteInfo, type IdeaRow, type TransitionRow } from './supabaseMapping';

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

describe('toVoteInfo', () => {
  it('counts the embedded votes and finds the own vote by database user id', () => {
    const votes = [{ user_id: 3 }, { user_id: 9 }, { user_id: 12 }];
    expect(toVoteInfo(votes, 9)).toEqual({ vote_count: 3, voted_by_me: true });
    expect(toVoteInfo(votes, 7)).toEqual({ vote_count: 3, voted_by_me: false });
    expect(toVoteInfo(votes, null)).toEqual({ vote_count: 3, voted_by_me: false });
  });
  it('has no votes when the rows are missing', () => {
    expect(toVoteInfo(undefined, 9)).toEqual(NO_VOTES);
    expect(toVoteInfo(null, 9)).toEqual(NO_VOTES);
  });
});

describe('toListItem', () => {
  it('marks the idea as submitted by the viewer only for the own database user id', () => {
    expect(toListItem(row, NO_VOTES, row.submitter_id).submitted_by_me).toBe(true);
    expect(toListItem(row, NO_VOTES, row.submitter_id + 1).submitted_by_me).toBe(false);
    expect(toListItem(row).submitted_by_me).toBe(false);
  });
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

describe('toReviewDetails', () => {
  const idea = toListItem({ ...row, current_stage: 'DECLINED' });
  const move = (id: number, to: TransitionRow['to_stage'], at: string, extra: Partial<TransitionRow> = {}): TransitionRow => ({
    transition_id: id,
    from_stage: 'SUBMITTED',
    to_stage: to,
    changed_by: 2,
    reason: null,
    score_impact: 4,
    score_cost: 2,
    score_feasibility: 5,
    created_at: at,
    reviewer: { display_name: 'Ruth Evans' },
    ...extra,
  });
  // Given in random order on purpose
  const rows = [
    move(12, 'DECLINED', '2026-10-12T09:00:00+00:00', {
      from_stage: 'UNDER_REVIEW', changed_by: 3, reason: 'Too expensive', score_impact: null, score_cost: null,
      score_feasibility: null, reviewer: { display_name: 'Tom Hallworth' },
    }),
    move(11, 'UNDER_REVIEW', '2026-10-11T09:00:00+00:00', { reason: 'Good start' }),
  ];

  it('makes one scorecard per scored move, oldest first, with the scores by criterion', () => {
    const { scorecards } = toReviewDetails(idea, rows);
    expect(scorecards).toHaveLength(1); // the decline has no scores
    expect(scorecards[0]).toEqual({
      key: '11',
      reviewer_id: 2,
      reviewer_name: 'Ruth Evans',
      scores: { 1: 2, 2: 5, 3: 4 }, // 1 COST, 2 FEASIBILITY, 3 IMPACT (config.ts)
      to_stage: 'UNDER_REVIEW',
      reviewed_at: '2026-10-11T09:00:00+00:00',
    });
  });
  it('keeps the scores of a decline with scores', () => {
    const scored = [...rows.slice(1), { ...rows[0], score_impact: 1, score_cost: 1, score_feasibility: 2 }];
    expect(toReviewDetails(idea, scored).scorecards.map((c) => c.key)).toEqual(['11', '12']);
  });
  it('builds the history newest first and ends with the submission', () => {
    const { history } = toReviewDetails(idea, rows);
    expect(history.map((h) => [h.from_stage, h.to_stage, h.changed_by_name, h.reason])).toEqual([
      ['UNDER_REVIEW', 'DECLINED', 'Tom Hallworth', 'Too expensive'],
      ['SUBMITTED', 'UNDER_REVIEW', 'Ruth Evans', 'Good start'],
      [null, 'SUBMITTED', 'Sofia Marin', 'Idea submitted.'],
    ]);
    expect(history[2].changed_at).toBe(row.created_at);
  });
  it('shows only the submission for an idea without transitions', () => {
    const { scorecards, history } = toReviewDetails(idea, []);
    expect(scorecards).toEqual([]);
    expect(history).toHaveLength(1);
    expect(history[0].to_stage).toBe('SUBMITTED');
  });
});
