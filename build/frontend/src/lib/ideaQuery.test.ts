import { describe, expect, it } from 'vitest';
import type { AppUser, IdeaListItem, IdeaStage, OfficeCode } from '../types';
import { canSeeIdea, DEFAULT_FILTERS, filterIdeas, pageNumbers, paginate, sortIdeas, stageCounts, submitterOptions } from './ideaQuery';

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
    is_anonymous: false,
    resubmission_of: null,
    created_at: `2026-09-${String(id).padStart(2, '0')}T10:00:00.000Z`,
    category_name: 'Client delivery',
    submitter_name: 'Someone',
    office: 'BRISTOL' as OfficeCode,
    vote_count: 0,
    voted_by_me: false,
    submitted_by_me: false,
    last_reviewed_at: null,
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
  const me = 1;
  const mine = { submitter_id: me, submitter_name: 'Sofia Martins', submitted_by_me: true };
  const ideas = [
    idea(1, { title: 'Pool cars', category_id: 2, office: 'LEEDS', ...mine }),
    idea(2, { solution: 'Use reusable CUPS', current_stage: 'PILOTING', submitter_id: 20, submitter_name: 'Daniel Okafor' }),
    idea(3, { current_stage: 'DECLINED', ...mine }),
    idea(4, { office: 'GLASGOW', current_stage: 'UNDER_REVIEW', submitter_id: 20, submitter_name: 'Daniel Okafor' }),
    idea(5, { current_stage: 'IMPLEMENTED', submitter_id: 30, submitter_name: 'Ruth Evans' }),
    idea(6, { current_stage: 'UNDER_REVIEW', is_confidential: true, ...mine }),
  ];
  const ids = (f: Partial<typeof DEFAULT_FILTERS>) => filterIdeas(ideas, { ...DEFAULT_FILTERS, ...f }).map((i) => i.idea_id);

  it('hides implemented and declined ideas by default', () => {
    expect(ids({})).toEqual([1, 2, 4, 6]);
  });
  it('shows implemented or declined ideas when picked, and every stage with ALL', () => {
    expect(ids({ stage: 'IMPLEMENTED' })).toEqual([5]);
    expect(ids({ stage: 'DECLINED' })).toEqual([3]);
    expect(ids({ stage: 'ALL' })).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('searches title, texts and submitter name case-insensitively', () => {
    expect(ids({ search: 'cups' })).toEqual([2]);
    expect(ids({ search: 'pool cars' })).toEqual([1]);
    expect(ids({ search: 'okafor' })).toEqual([2, 4]);
  });
  it('filters by category, office, stage and submitter', () => {
    expect(ids({ categoryId: 2 })).toEqual([1]);
    expect(ids({ office: 'GLASGOW' })).toEqual([4]);
    expect(ids({ stage: 'PILOTING' })).toEqual([2]);
    expect(ids({ submitterId: 20 })).toEqual([2, 4]);
  });
  it('shows all own ideas, including declined and confidential ones, with "My ideas"', () => {
    expect(ids({ mine: true })).toEqual([1, 3, 6]);
    expect(ids({ mine: true, stage: 'DECLINED' })).toEqual([3]);
  });
  it('counts ideas per stage with the other filters applied', () => {
    const counts = stageCounts(ideas, { ...DEFAULT_FILTERS, office: 'BRISTOL' });
    expect(counts).toEqual({ SUBMITTED: 0, UNDER_REVIEW: 1, PILOTING: 1, IMPLEMENTED: 1, DECLINED: 1 });
  });
  it('lists each visible submitter once, sorted by name', () => {
    expect(submitterOptions(ideas)).toEqual([
      { id: 20, name: 'Daniel Okafor' },
      { id: 30, name: 'Ruth Evans' },
      { id: me, name: 'Sofia Martins' },
    ]);
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
  it('puts the oldest ideas first', () => {
    expect(sortIdeas(ideas, 'oldest').map((i) => i.idea_id)).toEqual([1, 2, 3]);
  });
  it('puts the last reviewed ideas first, then the never reviewed ones, newest first', () => {
    const mixed = [
      idea(1, { last_reviewed_at: '2026-10-01T09:00:00.000Z' }),
      idea(2),
      idea(3, { last_reviewed_at: '2026-10-05T09:00:00.000Z' }),
      idea(4),
      idea(5, { last_reviewed_at: '2026-09-20T09:00:00.000Z' }),
    ];
    expect(sortIdeas(mixed, 'reviewed').map((i) => i.idea_id)).toEqual([3, 1, 5, 4, 2]);
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

describe('anonymous ideas', () => {
  const others = idea(1, { submitter_id: 10, submitter_name: 'Anonymous', is_anonymous: true });
  const mine = idea(2, { submitter_id: 11, submitter_name: 'Me', is_anonymous: true, submitted_by_me: true });
  const normal = idea(3, { submitter_id: 10, submitter_name: 'Sam' });

  it('does not offer the submitter of an anonymous idea of someone else in the filter', () => {
    expect(submitterOptions([others, normal]).map((o) => o.name)).toEqual(['Sam']);
    expect(submitterOptions([others])).toEqual([]);
  });

  it('does not find anonymous ideas of someone else by submitter', () => {
    const result = filterIdeas([others, normal], { ...DEFAULT_FILTERS, submitterId: 10 });
    expect(result.map((i) => i.idea_id)).toEqual([3]);
  });

  it('keeps the own anonymous idea findable', () => {
    expect(filterIdeas([others, mine], { ...DEFAULT_FILTERS, mine: true }).map((i) => i.idea_id)).toEqual([2]);
  });
});
