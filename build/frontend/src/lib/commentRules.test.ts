import { describe, expect, it } from 'vitest';
import type { CommentItem } from '../types';
import { allowsComments, buildThreads, commentAuthorLabel, canDeleteComment, commentRuleViolation, commentsButtonLabel, commentTextError, countNodes, showsCommentsButton } from './commentRules';

function comment(id: number, parent: number | null, at: string, extra: Partial<CommentItem> = {}): CommentItem {
  return { comment_id: id, idea_id: 1, author_id: 5, parent_comment_id: parent, body: `c${id}`, created_at: at, author_name: 'Sam', by_me: false, ...extra };
}

describe('allowsComments / showsCommentsButton', () => {
  it('confidential ideas get no comments', () => {
    expect(allowsComments({ is_confidential: true })).toBe(false);
    expect(allowsComments({ is_confidential: false })).toBe(true);
  });
  it('the button is only shown when there are comments', () => {
    expect(showsCommentsButton({ is_confidential: false, comment_count: 0 })).toBe(false);
    expect(showsCommentsButton({ is_confidential: false, comment_count: 2 })).toBe(true);
    expect(showsCommentsButton({ is_confidential: true, comment_count: 2 })).toBe(false);
  });
});

describe('commentsButtonLabel', () => {
  it('shows the number of comments in brackets', () => {
    expect(commentsButtonLabel(false, 12)).toBe('Show comments (12)');
    expect(commentsButtonLabel(true, 3)).toBe('Hide comments (3)');
  });
});

describe('buildThreads', () => {
  const items = [
    comment(1, null, '2026-04-01T10:00:00Z'),
    comment(2, 1, '2026-04-01T11:00:00Z'),
    comment(3, null, '2026-04-02T10:00:00Z'),
    comment(4, 1, '2026-04-01T12:00:00Z'),
    comment(5, 2, '2026-04-01T13:00:00Z'),
  ];
  it('puts the newest top-level comment first', () => {
    expect(buildThreads(items).map((n) => n.comment.comment_id)).toEqual([3, 1]);
  });
  it('puts answers below their comment, oldest first, to any depth', () => {
    const first = buildThreads(items)[1];
    expect(first.replies.map((n) => n.comment.comment_id)).toEqual([2, 4]);
    expect(first.replies[0].replies.map((n) => n.comment.comment_id)).toEqual([5]);
    expect(countNodes(buildThreads(items))).toBe(5);
  });
  it('shows an answer without its comment as a top-level comment', () => {
    expect(buildThreads([comment(7, 99, '2026-04-01T10:00:00Z')]).map((n) => n.comment.comment_id)).toEqual([7]);
  });
  it('does not depend on the order of the input', () => {
    expect(buildThreads([...items].reverse()).map((n) => n.comment.comment_id)).toEqual([3, 1]);
  });
});

describe('commentAuthorLabel', () => {
  const anonymousIdea = { submitter_id: 5, is_anonymous: true };
  it('hides the submitter of an anonymous idea from others', () => {
    expect(commentAuthorLabel(comment(1, null, 'x'), anonymousIdea)).toBe('Anonymous');
  });
  it('shows the own name, other authors and ideas that are not anonymous', () => {
    expect(commentAuthorLabel(comment(1, null, 'x', { by_me: true }), anonymousIdea)).toBe('Sam');
    expect(commentAuthorLabel(comment(1, null, 'x', { author_id: 6 }), anonymousIdea)).toBe('Sam');
    expect(commentAuthorLabel(comment(1, null, 'x'), { submitter_id: 5, is_anonymous: false })).toBe('Sam');
  });
});

describe('commentTextError', () => {
  it('rejects an empty or blank comment and one over 2000 characters', () => {
    expect(commentTextError('   ')).toBe('Please write a comment.');
    expect(commentTextError('x'.repeat(2001))).toBe('A comment can have at most 2000 characters.');
  });
  it('accepts 1 to 2000 characters, not counting surrounding spaces', () => {
    expect(commentTextError(' a ')).toBeNull();
    expect(commentTextError('x'.repeat(2000))).toBeNull();
  });
});

describe('commentRuleViolation', () => {
  it('rejects comments on confidential ideas', () => {
    expect(commentRuleViolation({ is_confidential: true }, null, 1, 'Hi')).toBe('Confidential ideas cannot get comments');
  });
  it('rejects an answer to a comment of another idea', () => {
    expect(commentRuleViolation({ is_confidential: false }, { idea_id: 2 }, 1, 'Hi')).toBe('The comment you answer does not belong to this idea');
  });
  it('accepts comments and answers on the same idea', () => {
    expect(commentRuleViolation({ is_confidential: false }, null, 1, 'Hi')).toBeNull();
    expect(commentRuleViolation({ is_confidential: false }, { idea_id: 1 }, 1, 'Hi')).toBeNull();
  });
});

describe('canDeleteComment', () => {
  it('lets the author delete a comment without answers', () => {
    expect(canDeleteComment({ by_me: true }, 0)).toBe(true);
  });
  it('does not allow it once somebody has answered', () => {
    expect(canDeleteComment({ by_me: true }, 1)).toBe(false);
  });
  it('does not allow it for the comments of other people', () => {
    expect(canDeleteComment({ by_me: false }, 0)).toBe(false);
  });
});
