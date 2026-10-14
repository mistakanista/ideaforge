import type { IdeaListItem } from '../types';

export const ANONYMOUS_LABEL = 'Anonymous';

/** Anonymous ideas hide the submitter from everybody except the submitter (US-11). */
export function hidesSubmitter(idea: Pick<IdeaListItem, 'is_anonymous' | 'submitted_by_me'>): boolean {
  return !!idea.is_anonymous && !idea.submitted_by_me;
}

/** Name shown for the submitter of an idea. */
export function submitterLabel(isAnonymous: boolean, submittedByMe: boolean, name: string): string {
  return isAnonymous && !submittedByMe ? ANONYMOUS_LABEL : name;
}
