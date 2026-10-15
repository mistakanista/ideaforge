// Comments of one idea (US-7): top-level comments newest first, answers below them.
// Writing and answering are possible for everybody who sees the idea; deleting follows.
import { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../config';
import { repository } from '../data';
import { buildThreads, canDeleteComment, COMMENTS_PER_PAGE, commentAuthorLabel, type CommentNode } from '../lib/commentRules';
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
  /** comment_id of the comment that waits for the confirmation of its deletion. */
  confirmDelete: number | null;
  onAskDelete: (commentId: number | null) => void;
  onDelete: (commentId: number) => void;
  /** Message of a deletion that failed, with the comment it belongs to. */
  deleteError: { commentId: number; message: string } | null;
  deleting: boolean;
}

function CommentThread(props: ThreadProps) {
  const { node, idea, depth, replyTo, onReply, onPosted, confirmDelete, onAskDelete, onDelete, deleteError, deleting } = props;
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
        <div className="comment-actions">
          {replyTo !== comment.comment_id && (
            <button type="button" className="btn btn-secondary btn-small" onClick={() => onReply(comment.comment_id)}>
              Reply<span className="visually-hidden"> to {author}</span>
            </button>
          )}
          {/* Deleting is permanent, so it needs a second click. Only the author, only without answers. */}
          {canDeleteComment(comment, replies.length) &&
            (confirmDelete === comment.comment_id ? (
              <>
                <button type="button" className="btn btn-primary btn-small" disabled={deleting} onClick={() => onDelete(comment.comment_id)}>
                  Yes, delete comment
                </button>
                <button type="button" className="btn btn-secondary btn-small" disabled={deleting} onClick={() => onAskDelete(null)}>
                  Keep comment
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-secondary btn-small" onClick={() => onAskDelete(comment.comment_id)}>
                Delete<span className="visually-hidden"> your comment of {formatDateTime(comment.created_at)}</span>
              </button>
            ))}
        </div>
        {deleteError?.commentId === comment.comment_id && (
          <p className="form-error" role="alert">
            {deleteError.message}
          </p>
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
            <CommentThread {...props} key={r.comment.comment_id} node={r} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

interface IdeaCommentsProps {
  idea: IdeaListItem;
  /** Called after a comment was added, so the list of ideas shows the new count. */
  onChanged: () => void;
  /** Called when the form is cancelled on an idea without comments: there is nothing left to show. */
  onClose: () => void;
}

export function IdeaComments({ idea, onChanged, onClose }: IdeaCommentsProps) {
  const { user } = useCurrentUser();
  const [items, setItems] = useState<CommentItem[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [writing, setWriting] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{ commentId: number; message: string } | null>(null);
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

  function askDelete(commentId: number | null) {
    setConfirmDelete(commentId);
    setDeleteError(null);
  }

  async function handleDelete(commentId: number) {
    if (!user || deleting) return;
    setDeleting(true);
    try {
      await repository.deleteComment(commentId, user);
      setConfirmDelete(null);
    } catch (e) {
      // For example somebody answered in the meantime: show the reason and the current list.
      setConfirmDelete(null);
      setDeleteError({ commentId, message: e instanceof Error ? e.message : 'The comment could not be deleted.' });
    } finally {
      setDeleting(false);
      setReloadCount((n) => n + 1);
      onChanged();
    }
  }

  /** A new comment or answer: reload the list; a new top-level comment is on top of page 1. */
  function handlePosted(topLevel: boolean) {
    setReplyTo(null);
    if (topLevel) {
      setPageNo(1);
      setWriting(true);
    }
    setReloadCount((n) => n + 1);
    onChanged();
  }

  return (
    <section className="comments" id={`idea-comments-${idea.idea_id}`} aria-label="Comments">
      <h4>Comments</h4>
      {writing ? (
        <CommentForm
          ideaId={idea.idea_id}
          parentId={null}
          label="Write a comment"
          onPosted={() => handlePosted(true)}
          // Without comments the panel would be empty, so it closes; otherwise the form is replaced by a button.
          onCancel={() => (idea.comment_count === 0 ? onClose() : setWriting(false))}
        />
      ) : (
        <button type="button" className="btn btn-secondary" onClick={() => setWriting(true)}>
          Write a comment
        </button>
      )}
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
            <CommentThread
              key={node.comment.comment_id}
              node={node}
              idea={idea}
              depth={0}
              replyTo={replyTo}
              onReply={setReplyTo}
              onPosted={() => handlePosted(false)}
              confirmDelete={confirmDelete}
              onAskDelete={askDelete}
              onDelete={(id) => void handleDelete(id)}
              deleteError={deleteError}
              deleting={deleting}
            />
          ))}
        </ul>
      )}
      <CommentPagination page={page} onPageChange={setPageNo} />
    </section>
  );
}
