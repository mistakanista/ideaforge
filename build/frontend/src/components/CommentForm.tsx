// Form for a new comment on an idea or an answer to a comment (US-7).
import { useState, type FormEvent } from 'react';
import { repository } from '../data';
import { commentTextError, MAX_COMMENT_LENGTH } from '../lib/commentRules';
import { useCurrentUser } from '../session/CurrentUser';

interface CommentFormProps {
  ideaId: number;
  /** The comment that is answered; null for a comment on the idea. */
  parentId: number | null;
  /** Visible label of the text field. */
  label: string;
  onPosted: () => void;
  /** Cancel clears the text and the parent hides the form. */
  onCancel?: () => void;
}

export function CommentForm({ ideaId, parentId, label, onPosted, onCancel }: CommentFormProps) {
  const { user } = useCurrentUser();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fieldId = `comment-${ideaId}-${parentId ?? 'new'}`;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || saving) return;
    const problem = commentTextError(body);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await repository.addComment({ idea_id: ideaId, parent_comment_id: parentId, body }, user);
      setBody('');
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your comment could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
      <div className="field">
        <label htmlFor={fieldId}>{label}</label>
        <textarea
          id={fieldId}
          rows={3}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${fieldId}-hint`}
        />
        <p id={`${fieldId}-hint`} className="hint">
          {body.length} / {MAX_COMMENT_LENGTH} characters
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="comment-form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {parentId === null ? 'Post comment' : 'Post answer'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
