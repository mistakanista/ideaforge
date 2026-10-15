// Comments of one idea (US-7): top-level comments newest first, answers below them.
// Writing and answering are possible for everybody who sees the idea; deleting follows.
import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../config';
import { repository } from '../data';
import { buildThreads, COMMENTS_PER_PAGE, commentAuthorLabel, type CommentNode } from '../lib/commentRules';
import { paginate } from '../lib/ideaQuery';
import { useCurrentUser } from '../session/CurrentUser';
import type { CommentItem, IdeaListItem } from '../types';
import { CommentForm } from './CommentForm';
import { CommentPagination } from './CommentPagination';

/** Answers are indented up to this depth; deeper answers stay at the same level (narrow screens). */
const MAX_INDENT = 3;

interface ThreadProps {
  node: CommentNode;
  idea: IdeaListItem;
  depth: number;
  /** comment_id of the comment whose answer form is open. */
  replyTo: number | null;
  onReply: (commentId: number | null) => void;
  onPosted: () => void;
}

function CommentThread({ node, idea, depth, replyTo, onReply, onPosted }: ThreadProps) {
  const { comment, replies } = node;
  const author = commentAuthorLabel(comment, idea);
  return (
    <li className="comment">
      <div className="comment-body">
        <p className="comment-meta small">
          <strong>{commentAuthorLabel(comment, idea)}</strong>
          {comment.by_me && <span className="muted"> (you)</span>}
          <span className="muted"> · {formatDateTime(comment.created_at)}</span>
        </p>
        <p className="comment-text">{comment.body}</p>
        {replyTo !== comment.comment_id && (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => onReply(comment.comment_id)}>
            Reply<span className="visually-hidden"> to {author}</span>
          </button>
        )}
      </div>
      {replyTo === comment.comment_id && (
        <CommentForm
          ideaId={idea.idea_id}
          parentId={comment.comment_id}
          label={`Your answer to ${author}`}
          onPosted={onPosted}
          onCancel={() => onReply(null)}
        />
      )}
      {replies.length > 0 && (
        <ul className={`comment-list comment-replies${depth + 1 >= MAX_INDENT ? ' flat' : ''}`} aria-label={`Answers to the comment of ${author}`}>
          {replies.map((r) => (
            <CommentThread key={r.comment.comment_id} node={r} idea={idea} depth={depth + 1} replyTo={replyTo} onReply={onReply} onPosted={onPosted} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function IdeaComments({ idea, onChanged }: { idea: IdeaListItem; /** Called after a comment was added, so the list of ideas shows the new count. */ onChanged: () => void }) {
  const { user } = useCurrentUser();
  const [items, setItems] = useState<CommentItem[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

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
  }, [idea.idea_id, user, reloadCount]);

  const threads = useMemo(() => buildThreads(items ?? []), [items]);
  const page = paginate(threads, pageNo, COMMENTS_PER_PAGE);

  /** A new comment or answer: reload the list; a new top-level comment is on top of page 1. */
  function handlePosted(topLevel: boolean) {
    setReplyTo(null);
    if (topLevel) setPageNo(1);
    setReloadCount((n) => n + 1);
    onChanged();
  }

  return (
    <section className="comments" id={`idea-comments-${idea.idea_id}`} aria-label="Comments">
      <h4>Comments</h4>
      <CommentForm ideaId={idea.idea_id} parentId={null} label="Write a comment" onPosted={() => handlePosted(true)} />
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
            <CommentThread key={node.comment.comment_id} node={node} idea={idea} depth={0} replyTo={replyTo} onReply={setReplyTo} onPosted={() => handlePosted(false)} />
          ))}
        </ul>
      )}
      <CommentPagination page={page} onPageChange={setPageNo} />
    </section>
  );
}
