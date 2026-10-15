// Rules and helpers for comments (US-7). The rules are the same as in the database trigger comment_check().
import type { CommentItem, IdeaListItem } from '../types';
import { ANONYMOUS_LABEL } from './anonymity';

/** Longest comment text (same limit as the database). */
export const MAX_COMMENT_LENGTH = 2000;

/** Top-level comments per page; their answers are shown below them on the same page. */
export const COMMENTS_PER_PAGE = 10;

/** Confidential ideas get no comments at all, so they have no comments button. */
export function allowsComments(idea: Pick<IdeaListItem, 'is_confidential'>): boolean {
  return !idea.is_confidential;
}

/** The button that opens the comments is only shown when there is something to show. */
export function showsCommentsButton(idea: Pick<IdeaListItem, 'is_confidential' | 'comment_count'>): boolean {
  return allowsComments(idea) && idea.comment_count > 0;
}

/** Label of the button that opens or closes the comments, with the number of all comments and answers. */
export function commentsButtonLabel(open: boolean, count: number): string {
  return `${open ? 'Hide' : 'Show'} comments (${count})`;
}

export interface CommentNode {
  comment: CommentItem;
  /** Answers to this comment, oldest first. */
  replies: CommentNode[];
}

const oldestFirst = (a: CommentItem, b: CommentItem) =>
  a.created_at.localeCompare(b.created_at) || a.comment_id - b.comment_id;

/**
 * Comments with their answers as a tree: top-level comments newest first, answers below
 * their comment, oldest first. An answer whose comment is missing is shown as a top-level comment.
 */
export function buildThreads(items: CommentItem[]): CommentNode[] {
  const nodes = new Map<number, CommentNode>(items.map((c) => [c.comment_id, { comment: c, replies: [] }]));
  const roots: CommentNode[] = [];
  for (const c of [...items].sort(oldestFirst)) {
    const node = nodes.get(c.comment_id)!;
    const parent = c.parent_comment_id === null ? undefined : nodes.get(c.parent_comment_id);
    (parent ? parent.replies : roots).push(node);
  }
  return roots.reverse();
}

/** Name shown for the author of a comment: the submitter of an anonymous idea stays anonymous (US-11). */
export function commentAuthorLabel(
  comment: Pick<CommentItem, 'author_id' | 'author_name' | 'by_me'>,
  idea: Pick<IdeaListItem, 'submitter_id' | 'is_anonymous'>,
): string {
  return idea.is_anonymous && comment.author_id === idea.submitter_id && !comment.by_me ? ANONYMOUS_LABEL : comment.author_name;
}

/** Number of comments and answers in a tree. */
export function countNodes(nodes: CommentNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.replies), 0);
}

/** Message for a comment text that breaks a rule of the database (empty or too long), otherwise null. */
export function commentTextError(body: string): string | null {
  const length = body.trim().length;
  if (length === 0) return 'Please write a comment.';
  if (length > MAX_COMMENT_LENGTH) return `A comment can have at most ${MAX_COMMENT_LENGTH} characters.`;
  return null;
}

/**
 * Message for a new comment that breaks a rule of the database trigger comment_check(), otherwise null.
 * parent is the comment that is answered, if any.
 */
export function commentRuleViolation(
  idea: Pick<IdeaListItem, 'is_confidential'>,
  parent: Pick<CommentItem, 'idea_id'> | null,
  ideaId: number,
  body: string,
): string | null {
  if (!allowsComments(idea)) return 'Confidential ideas cannot get comments';
  if (parent && parent.idea_id !== ideaId) return 'The comment you answer does not belong to this idea';
  return commentTextError(body);
}

export const COMMENT_HAS_ANSWERS = 'This comment has answers and cannot be deleted.';

/** The author can delete a comment only as long as nobody has answered it. */
export function canDeleteComment(comment: Pick<CommentItem, 'by_me'>, answerCount: number): boolean {
  return comment.by_me && answerCount === 0;
}
