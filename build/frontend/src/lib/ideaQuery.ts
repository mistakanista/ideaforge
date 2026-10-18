// Pure functions for visibility, search, filters, sorting and paging of the dashboard.
// Kept free of React and storage so they can be unit tested and later reused or moved into SQL.
import { hidesSubmitter } from './anonymity';
import type { AppUser, Idea, IdeaListItem, IdeaStage, OfficeCode } from '../types';

export type SortOrder = 'newest' | 'oldest' | 'votes' | 'reviewed' | 'changed';

export const SORT_ORDERS: readonly SortOrder[] = ['newest', 'oldest', 'votes', 'reviewed', 'changed'];

/** null = active ideas only (the default list), 'ALL' = every stage. */
export type StageFilter = IdeaStage | 'ALL' | null;

export interface IdeaFilters {
  search: string;
  categoryId: number | null;
  office: OfficeCode | null;
  stage: StageFilter;
  submitterId: number | null;
  /** Only the ideas of the signed-in user, in every stage. */
  mine: boolean;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: IdeaFilters = {
  search: '',
  categoryId: null,
  office: null,
  stage: null,
  submitterId: null,
  mine: false,
  sort: 'newest',
};

/** Stages left out of the default list; they are shown when picked in the stage filter or with "My ideas". */
export const HIDDEN_BY_DEFAULT: readonly IdeaStage[] = ['IMPLEMENTED', 'DECLINED'];

/** Confidential ideas are only visible to the submitter and the reviewers (never to staff or admins). */
export function canSeeIdea(idea: Pick<Idea, 'is_confidential' | 'submitter_id'>, viewer: Pick<AppUser, 'user_id' | 'role'>): boolean {
  if (!idea.is_confidential) return true;
  return idea.submitter_id === viewer.user_id || viewer.role === 'REVIEWER';
}

function matchesSearch(idea: IdeaListItem, search: string): boolean {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = [idea.title, idea.problem, idea.solution, idea.expected_impact, idea.submitter_name].join(' ').toLowerCase();
  return terms.every((term) => text.includes(term));
}

/** All filters except the stage filter; used for the counts on the stage chips. */
function applyBaseFilters(items: IdeaListItem[], f: IdeaFilters): IdeaListItem[] {
  return items.filter(
    (idea) =>
      (f.categoryId === null || idea.category_id === f.categoryId) &&
      (f.office === null || idea.office === f.office) &&
      (f.submitterId === null || (!hidesSubmitter(idea) && idea.submitter_id === f.submitterId)) &&
      (!f.mine || idea.submitted_by_me) &&
      matchesSearch(idea, f.search),
  );
}

export function filterIdeas(items: IdeaListItem[], f: IdeaFilters): IdeaListItem[] {
  return applyBaseFilters(items, f).filter((idea) => {
    if (f.stage === 'ALL') return true;
    if (f.stage !== null) return idea.current_stage === f.stage;
    return f.mine || !HIDDEN_BY_DEFAULT.includes(idea.current_stage);
  });
}

export function stageCounts(items: IdeaListItem[], f: IdeaFilters): Record<IdeaStage, number> {
  const counts: Record<IdeaStage, number> = { SUBMITTED: 0, UNDER_REVIEW: 0, PILOTING: 0, IMPLEMENTED: 0, DECLINED: 0 };
  for (const idea of applyBaseFilters(items, f)) counts[idea.current_stage]++;
  return counts;
}

export interface SubmitterOption {
  id: number;
  name: string;
}

/** People for the "Submitted by" filter, taken only from the ideas the viewer may see, sorted by name. */
export function submitterOptions(items: IdeaListItem[]): SubmitterOption[] {
  const byId = new Map<number, string>();
  for (const idea of items.filter((i) => !hidesSubmitter(i))) byId.set(idea.submitter_id, idea.submitter_name);
  return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

function newestFirst(a: IdeaListItem, b: IdeaListItem): number {
  return b.created_at.localeCompare(a.created_at) || b.idea_id - a.idea_id;
}

/** Latest review first; ideas that were never reviewed follow, newest first. */
function lastReviewedFirst(a: IdeaListItem, b: IdeaListItem): number {
  if (a.last_reviewed_at === b.last_reviewed_at) return newestFirst(a, b);
  if (a.last_reviewed_at === null) return 1;
  if (b.last_reviewed_at === null) return -1;
  return b.last_reviewed_at.localeCompare(a.last_reviewed_at);
}

/** Latest activity first (new idea, review or comment); ties newest first. */
function lastChangedFirst(a: IdeaListItem, b: IdeaListItem): number {
  return b.last_activity_at.localeCompare(a.last_activity_at) || newestFirst(a, b);
}

export function sortIdeas(items: IdeaListItem[], sort: SortOrder): IdeaListItem[] {
  const sorted = [...items];
  if (sort === 'votes') sorted.sort((a, b) => b.vote_count - a.vote_count || newestFirst(a, b));
  else if (sort === 'reviewed') sorted.sort(lastReviewedFirst);
  else if (sort === 'changed') sorted.sort(lastChangedFirst);
  else if (sort === 'oldest') sorted.sort((a, b) => newestFirst(b, a));
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
