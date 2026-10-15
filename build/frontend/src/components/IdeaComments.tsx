// Comments of one idea (US-7): top-level comments newest first, answers below them.
// Step 3b: reading only; writing and deleting follow.
import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../config';
import { repository } from '../data';
import { buildThreads, COMMENTS_PER_PAGE, commentAuthorLabel, type CommentNode } from '../lib/commentRules';
import { paginate } from '../lib/ideaQuery';
import { useCurrentUser } from '../session/CurrentUser';
import type { CommentItem, IdeaListItem } from '../types';
import { CommentPagination } from './CommentPagination';

/** Answers are indented up to this depth; deeper answers stay at the same level (narrow screens). */
const MAX_INDENT = 3;

function CommentThread({ node, idea, depth }: { node: CommentNode; idea: IdeaListItem; depth: number }) {
  const { comment, replies } = node;
  return (
    <li className="comment">
      <div className="comment-body">
        <p className="comment-meta small">
          <strong>{commentAuthorLabel(comment, idea)}</strong>
          {comment.by_me && <span className="muted"> (you)</span>}
          <span className="muted"> · {formatDateTime(comment.created_at)}</span>
        </p>
        <p className="comment-text">{comment.body}</p>
      </div>
      {replies.length > 0 && (
        <ul className={`comment-list comment-replies${depth + 1 >= MAX_INDENT ? ' flat' : ''}`} aria-label={`Answers to the comment of ${commentAuthorLabel(comment, idea)}`}>
          {replies.map((r) => (
            <CommentThread key={r.comment.comment_id} node={r} idea={idea} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function IdeaComments({ idea }: { idea: IdeaListItem }) {
  const { user } = useCurrentUser();
  const [items, setItems] = useState<CommentItem[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    repository
      .listComments(idea.idea_id, user)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The comments could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [idea.idea_id, user]);

  const threads = useMemo(() => buildThreads(items ?? []), [items]);
  const page = paginate(threads, pageNo, COMMENTS_PER_PAGE);

  return (
    <section className="comments" id={`idea-comments-${idea.idea_id}`} aria-label="Comments">
      <h4>Comments</h4>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!error && items === undefined && <p className="muted">Loading comments…</p>}
      {items && threads.length === 0 && <p className="muted">There are no comments yet.</p>}
      {page.items.length > 0 && (
        <ul className="comment-list">
          {page.items.map((node) => (
            <CommentThread key={node.comment.comment_id} node={node} idea={idea} depth={0} />
          ))}
        </ul>
      )}
      <CommentPagination page={page} onPageChange={setPageNo} />
    </section>
  );
}
