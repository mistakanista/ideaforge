import { describe, expect, it } from 'vitest';
import { RuleViolation } from './repository';
import { lastActivityAt, lastReviewedAt, NO_VOTES, toAppError, toIdea, toListItem, toReviewDetails, toVoteInfo, toAppUser, roleUpdateError, toCategory, toCategoryError, toCommentError, toRelatedIdeas, toRelationError, type IdeaRow, type RelationRow, type TransitionRow } from './supabaseMapping';

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
  is_anonymous: false,
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

describe('lastActivityAt', () => {
  const created = '2026-09-01T10:00:00+00:00';
  it('is the creation time without reviews and comments', () => {
    expect(lastActivityAt(created, [], undefined)).toBe(created);
  });
  it('is the latest of creation, reviews and comments', () => {
    const reviews = [{ created_at: '2026-09-10T10:00:00+00:00' }];
    const comments = [{ created_at: '2026-09-20T10:00:00+00:00' }, { created_at: '2026-09-15T10:00:00+00:00' }];
    expect(lastActivityAt(created, reviews, comments)).toBe('2026-09-20T10:00:00+00:00');
    expect(lastActivityAt(created, reviews, [])).toBe('2026-09-10T10:00:00+00:00');
  });
});

describe('lastReviewedAt', () => {
  it('takes the latest review time, whatever the order of the rows', () => {
    const rows = [
      { created_at: '2026-10-02T08:00:00+00:00' },
      { created_at: '2026-10-09T14:30:00+00:00' },
      { created_at: '2026-10-05T10:00:00+00:00' },
    ];
    expect(lastReviewedAt(rows)).toBe('2026-10-09T14:30:00+00:00');
  });
  it('is null for an idea that was never reviewed', () => {
    expect(lastReviewedAt([])).toBeNull();
    expect(lastReviewedAt(undefined)).toBeNull();
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
  it('hides the submitter of an anonymous idea from other users but not from the submitter', () => {
    const anonymous = { ...row, is_anonymous: true };
    expect(toListItem(anonymous, NO_VOTES, row.submitter_id + 1).submitter_name).toBe('Anonymous');
    expect(toListItem(anonymous, NO_VOTES, row.submitter_id).submitter_name).toBe(row.submitter?.display_name);
  });

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

describe('toAppUser', () => {
  const user = {
    user_id: 14,
    email: 'ruth.evans@tallis.uk',
    display_name: 'Ruth Evans',
    office: 'LEEDS' as const,
    role: 'REVIEWER' as const,
    role_changed_by: 1,
    role_changed_at: '2026-10-10T09:00:00+00:00',
    is_active: true,
  };
  it('keeps the database id and all columns', () => {
    expect(toAppUser(user)).toEqual(user);
  });
  it('shows a fallback office while the user has not chosen one', () => {
    expect(toAppUser({ ...user, office: null }).office).toBe('BRISTOL');
  });
});

describe('roleUpdateError', () => {
  it('accepts an update that changed a row', () => {
    expect(roleUpdateError([{ user_id: 5 }])).toBeNull();
  });
  it('rejects an update that changed no row (row level security or unknown user)', () => {
    expect(roleUpdateError([])).toBeInstanceOf(RuleViolation);
    expect(roleUpdateError(null)).toBeInstanceOf(RuleViolation);
  });
});

describe('categories', () => {
  it('shows an empty description as an empty text', () => {
    const category = toCategory({ category_id: 1, name: 'Health', description: null, sort_order: 5, is_active: true });
    expect(category.description).toBe('');
    expect(category.name).toBe('Health');
  });
  it('explains a duplicate name and a blank name', () => {
    expect(toCategoryError({ code: '23505', message: 'unique' }).message).toBe('A category with this name already exists.');
    expect(toCategoryError({ code: '23514', message: 'check' }).message).toBe('Please enter a name.');
  });
  it('falls back to the general messages', () => {
    expect(toCategoryError({ code: '42501', message: 'denied' }).message).toBe('You are not allowed to do this.');
  });
});

describe('toCommentError', () => {
  it('explains a comment text that breaks the length rule and a missing comment', () => {
    expect(toCommentError({ code: '23514', message: 'check' }, 'add').message).toBe('Please write a comment of 1 to 2000 characters.');
    expect(toCommentError({ code: '23503', message: 'fk' }, 'add').message).toBe('The comment you answer does not exist.');
  });
  it('explains that a comment with answers cannot be deleted', () => {
    expect(toCommentError({ code: '23503', message: 'fk' }, 'delete').message).toBe('This comment has answers and cannot be deleted.');
  });
  it('keeps the messages of the database rules and falls back to the general ones', () => {
    expect(toCommentError({ code: 'P0001', message: 'Confidential ideas cannot get comments' }, 'add').message).toBe('Confidential ideas cannot get comments');
    expect(toCommentError({ code: '42501', message: 'denied' }, 'add').message).toBe('You are not allowed to do this.');
  });
});

describe('toRelatedIdeas', () => {
  const other = (id: number, title: string, extra = {}) => ({
    idea_id: id, title, current_stage: 'PILOTING' as const, submitter_id: 9, is_anonymous: false,
    submitter: { display_name: 'Lena Fischer' }, vote: [{ user_id: 1 }, { user_id: 2 }], ...extra,
  });
  const rows: RelationRow[] = [
    { relation_id: 1, idea_id: 10, related_idea_id: 20, relation_type: 'DUPLICATES', first: other(10, 'Car pool'), second: other(20, 'Ride sharing') },
    { relation_id: 2, idea_id: 30, related_idea_id: 10, relation_type: 'REPLACES', first: other(30, 'Bike racks', { vote: null }), second: other(10, 'Car pool') },
  ];
  it('shows the other idea of each relation with the label seen from the viewed idea, by title', () => {
    const related = toRelatedIdeas(rows, 10, null);
    expect(related.map((r) => [r.title, r.label, r.vote_count, r.submitter_name])).toEqual([
      ['Bike racks', 'is replaced by', 0, 'Lena Fischer'],
      ['Ride sharing', 'duplicates', 2, 'Lena Fischer'],
    ]);
  });
  it('hides the owner of an anonymous idea, except from the owner', () => {
    const anon: RelationRow[] = [{ ...rows[0], second: other(20, 'Ride sharing', { is_anonymous: true }) }];
    expect(toRelatedIdeas(anon, 10, 1)[0].submitter_name).toBe('Anonymous');
    expect(toRelatedIdeas(anon, 10, 9)[0].submitter_name).toBe('Lena Fischer');
  });
  it('skips a relation whose other idea is not visible', () => {
    expect(toRelatedIdeas([{ ...rows[0], second: null }], 10, null)).toEqual([]);
  });
});

describe('toRelationError', () => {
  it('explains the pair, self and missing idea errors and keeps the rule messages', () => {
    expect(toRelationError({ code: '23505', message: 'unique' }).message).toBe('These ideas are already related');
    expect(toRelationError({ code: '23514', message: 'check' }).message).toBe('An idea cannot be related to itself');
    expect(toRelationError({ code: 'P0001', message: 'Confidential ideas cannot be related' }).message).toBe('Confidential ideas cannot be related');
    expect(toRelationError({ code: '42501', message: 'denied' })).toBeInstanceOf(RuleViolation);
  });
});
