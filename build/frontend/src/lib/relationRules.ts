// Rules and helpers for relating ideas (US-13). The rules are the same as in the database trigger
// idea_relation_check(); the database enforces them anyway.
import type { AppUser, Idea, IdeaListItem, IdeaRelationType } from '../types';

export const RELATION_OPTIONS: { type: IdeaRelationType; label: string }[] = [
  { type: 'DUPLICATES', label: 'duplicates' },
  { type: 'REPLACES', label: 'replaces' },
  { type: 'RELATED_TO', label: 'is related to' },
];

const INVERSE_LABEL: Record<IdeaRelationType, string> = {
  DUPLICATES: 'is duplicated by',
  REPLACES: 'is replaced by',
  RELATED_TO: 'is related to',
};

/** Label of a relation seen from one of its ideas: `first` is the idea the relation was set on. */
export function relationLabel(type: IdeaRelationType, first: boolean): string {
  const option = RELATION_OPTIONS.find((o) => o.type === type);
  return first ? (option?.label ?? type) : INVERSE_LABEL[type];
}

/** Only reviewers relate ideas (admins and staff do not). */
export function canRelate(user: Pick<AppUser, 'role'>): boolean {
  return user.role === 'REVIEWER';
}

type Relatable = Pick<Idea, 'is_confidential' | 'current_stage'>;

/** Confidential and declined ideas cannot be related. */
export function isRelatable(idea: Relatable): boolean {
  return !idea.is_confidential && idea.current_stage !== 'DECLINED';
}

/** Message for a relation that breaks a rule (same wording as the database), or null. */
export function relationRuleViolation(
  first: Relatable & Pick<Idea, 'idea_id'>,
  second: Relatable & Pick<Idea, 'idea_id'>,
  user: Pick<AppUser, 'role'>,
  alreadyRelated: boolean,
): string | null {
  if (!canRelate(user)) return 'Only reviewers can relate ideas';
  if (first.idea_id === second.idea_id) return 'An idea cannot be related to itself';
  for (const idea of [first, second]) {
    if (idea.is_confidential) return 'Confidential ideas cannot be related';
    if (idea.current_stage === 'DECLINED') return 'Declined ideas cannot be related';
  }
  if (alreadyRelated) return 'These ideas are already related';
  return null;
}

/** Ideas offered in the dropdown: relatable, not the idea itself, not yet related to it; by title. */
export function relationCandidates(ideas: IdeaListItem[], ideaId: number, relatedIds: number[]): IdeaListItem[] {
  return ideas
    .filter((i) => i.idea_id !== ideaId && isRelatable(i) && !relatedIds.includes(i.idea_id))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.idea_id - b.idea_id);
}

/** Search of the dropdown: the text is part of the title, ignoring case. */
export function searchCandidates(candidates: IdeaListItem[], query: string): IdeaListItem[] {
  const q = query.trim().toLowerCase();
  return q ? candidates.filter((i) => i.title.toLowerCase().includes(q)) : candidates;
}
