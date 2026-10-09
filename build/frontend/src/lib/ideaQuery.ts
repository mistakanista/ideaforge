// Pure functions for visibility, search, filters, sorting and paging of the dashboard.
// Kept free of React and storage so they can be unit tested and later reused or moved into SQL.
import type { AppUser, Idea, IdeaListItem, IdeaStage, OfficeCode } from '../types';

export type SortOrder = 'newest' | 'votes';

export interface IdeaFilters {
  search: string;
  categoryId: number | null;
  office: OfficeCode | null;
  stage: IdeaStage | null;
  showDeclined: boolean;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: IdeaFilters = {
  search: '',
  categoryId: null,
  office: null,
  stage: null,
  showDeclined: false,
  sort: 'newest',
};

/** Confidential ideas are only visible to the submitter and the reviewers (never to staff or admins). */
export function canSeeIdea(idea: Pick<Idea, 'is_confidential' | 'submitter_id'>, viewer: Pick<AppUser, 'user_id' | 'role'>): boolean {
  if (!idea.is_confidential) return true;
  return idea.submitter_id === viewer.user_id || viewer.role === 'REVIEWER';
}

function matchesSearch(idea: IdeaListItem, search: string): boolean {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = [idea.title, idea.problem, idea.solution, idea.expected_impact].join(' ').toLowerCase();
  return terms.every((term) => text.includes(term));
}

/** All filters except the stage filter; used for the counts on the stage chips. */
function applyBaseFilters(items: IdeaListItem[], f: IdeaFilters): IdeaListItem[] {
  return items.filter(
    (idea) =>
      (f.categoryId === null || idea.category_id === f.categoryId) &&
      (f.office === null || idea.office === f.office) &&
      matchesSearch(idea, f.search),
  );
}

export function filterIdeas(items: IdeaListItem[], f: IdeaFilters): IdeaListItem[] {
  return applyBaseFilters(items, f).filter((idea) => {
    if (f.stage !== null) return idea.current_stage === f.stage;
    return f.showDeclined || idea.current_stage !== 'DECLINED';
  });
}

export function stageCounts(items: IdeaListItem[], f: IdeaFilters): Record<IdeaStage, number> {
  const counts: Record<IdeaStage, number> = { SUBMITTED: 0, UNDER_REVIEW: 0, PILOTING: 0, IMPLEMENTED: 0, DECLINED: 0 };
  for (const idea of applyBaseFilters(items, f)) counts[idea.current_stage]++;
  return counts;
}

function newestFirst(a: IdeaListItem, b: IdeaListItem): number {
  return b.created_at.localeCompare(a.created_at) || b.idea_id - a.idea_id;
}

export function sortIdeas(items: IdeaListItem[], sort: SortOrder): IdeaListItem[] {
  const sorted = [...items];
  if (sort === 'votes') sorted.sort((a, b) => b.vote_count - a.vote_count || newestFirst(a, b));
  else sorted.sort(newestFirst);
  return sorted;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first and last item on the page, 0 when empty. */
  from: number;
  to: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    items: pageItems,
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + pageItems.length,
  };
}

/** Page numbers to show, with null for a gap: 1 … 4 5 6 … 12 */
export function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push(null);
    result.push(p);
  });
  return result;
}
