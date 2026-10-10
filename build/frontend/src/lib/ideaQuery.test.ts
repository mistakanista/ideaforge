import { describe, expect, it } from 'vitest';
import type { AppUser, IdeaListItem, IdeaStage, OfficeCode } from '../types';
import { canSeeIdea, DEFAULT_FILTERS, filterIdeas, pageNumbers, paginate, sortIdeas, stageCounts } from './ideaQuery';

function idea(id: number, overrides: Partial<IdeaListItem> = {}): IdeaListItem {
  return {
    idea_id: id,
    title: `Idea ${id}`,
    problem: 'Some problem',
    solution: 'Some solution',
    expected_impact: 'Some impact',
    category_id: 1,
    submitter_id: 10,
    current_stage: 'SUBMITTED' as IdeaStage,
    is_confidential: false,
    resubmission_of: null,
    created_at: `2026-09-${String(id).padStart(2, '0')}T10:00:00.000Z`,
    category_name: 'Client delivery',
    submitter_name: 'Someone',
    office: 'BRISTOL' as OfficeCode,
    vote_count: 0,
    voted_by_me: false,
    ...overrides,
  };
}

const staff = { user_id: 1, role: 'STAFF' } as AppUser;
const reviewer = { user_id: 2, role: 'REVIEWER' } as AppUser;
const admin = { user_id: 3, role: 'ADMIN' } as AppUser;

describe('canSeeIdea', () => {
  const confidential = { is_confidential: true, submitter_id: 1 };
  it('shows confidential ideas only to the submitter and reviewers', () => {
    expect(canSeeIdea(confidential, staff)).toBe(true);
    expect(canSeeIdea(confidential, reviewer)).toBe(true);
    expect(canSeeIdea(confidential, admin)).toBe(false);
    expect(canSeeIdea(confidential, { user_id: 9, role: 'STAFF' })).toBe(false);
  });
  it('shows normal ideas to everyone', () => {
    expect(canSeeIdea({ is_confidential: false, submitter_id: 1 }, admin)).toBe(true);
  });
});

describe('filterIdeas', () => {
  const ideas = [
    idea(1, { title: 'Pool cars', category_id: 2, office: 'LEEDS' }),
    idea(2, { solution: 'Use reusable CUPS', current_stage: 'PILOTING' }),
    idea(3, { current_stage: 'DECLINED' }),
    idea(4, { office: 'GLASGOW', current_stage: 'UNDER_REVIEW' }),
  ];

  it('hides declined ideas by default', () => {
    expect(filterIdeas(ideas, DEFAULT_FILTERS).map((i) => i.idea_id)).toEqual([1, 2, 4]);
  });
  it('shows declined ideas when asked', () => {
    expect(filterIdeas(ideas, { ...DEFAULT_FILTERS, showDeclined: true })).toHaveLength(4);
  });
  it('searches title and texts case-insensitively', () => {
    expect(filterIdeas(ideas, { ...DEFAULT_FILTERS, search: 'cups' }).map((i) => i.idea_id)).toEqual([2]);
    expect(filterIdeas(ideas, { ...DEFAULT_FILTERS, search: 'pool cars' }).map((i) => i.idea_id)).toEqual([1]);
  });
  it('filters by category, office and stage', () => {
    expect(filterIdeas(ideas, { ...DEFAULT_FILTERS, categoryId: 2 }).map((i) => i.idea_id)).toEqual([1]);
    expect(filterIdeas(ideas, { ...DEFAULT_FILTERS, office: 'GLASGOW' }).map((i) => i.idea_id)).toEqual([4]);
    expect(filterIdeas(ideas, { ...DEFAULT_FILTERS, stage: 'PILOTING' }).map((i) => i.idea_id)).toEqual([2]);
  });
  it('counts ideas per stage with the other filters applied', () => {
    const counts = stageCounts(ideas, { ...DEFAULT_FILTERS, office: 'BRISTOL' });
    expect(counts).toEqual({ SUBMITTED: 0, UNDER_REVIEW: 0, PILOTING: 1, IMPLEMENTED: 0, DECLINED: 1 });
  });
});

describe('sortIdeas', () => {
  const ideas = [idea(1, { vote_count: 5 }), idea(3, { vote_count: 1 }), idea(2, { vote_count: 5 })];
  it('puts the newest ideas first by default', () => {
    expect(sortIdeas(ideas, 'newest').map((i) => i.idea_id)).toEqual([3, 2, 1]);
  });
  it('sorts by votes, newest first on a tie', () => {
    expect(sortIdeas(ideas, 'votes').map((i) => i.idea_id)).toEqual([2, 1, 3]);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 57 }, (_, i) => i + 1);
  it.each([
    [10, 6],
    [20, 3],
    [50, 2],
  ])('splits 57 items into pages of %i', (size, pageCount) => {
    const page = paginate(items, 1, size);
    expect(page.pageCount).toBe(pageCount);
    expect(page.items).toHaveLength(size);
  });
  it('shows the right range on the last page', () => {
    const page = paginate(items, 6, 10);
    expect([page.from, page.to, page.items.length]).toEqual([51, 57, 7]);
  });
  it('clamps page numbers that are out of range', () => {
    expect(paginate(items, 99, 20).page).toBe(3);
    expect(paginate(items, 0, 20).page).toBe(1);
    expect(paginate([], 1, 10)).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0 });
  });
  it('builds page numbers with gaps', () => {
    expect(pageNumbers(5, 12)).toEqual([1, null, 4, 5, 6, null, 12]);
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
  });
});
