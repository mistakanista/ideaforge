import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, OFFICE_LABELS } from '../config';
import { allowsComments, commentsButtonLabel } from '../lib/commentRules';
import { canVote, showsVotes } from '../lib/voteRules';
import type { IdeaListItem } from '../types';
import { IdeaComments } from './IdeaComments';
import { IdeaDetails } from './IdeaDetails';
import { AnonymousBadge, ConfidentialBadge, StageBadge } from './StageBadge';

interface IdeaCardProps {
  idea: IdeaListItem;
  /** The viewer may give this declined idea a second chance (US-6). */
  canImprove?: boolean;
  /** Title of the declined idea this one is a second attempt of, if the viewer can see it. */
  originalTitle?: string;
  expanded: boolean;
  onToggleDetails: () => void;
  onToggleVote: () => void;
  /** A vote of the viewer for this idea is being saved. */
  voting?: boolean;
  /** Message of a vote that could not be saved. */
  voteError?: string | null;
  /** Called after a reviewer saved a review, so the list can show the new stage. */
  onReviewed?: () => void;
  /** Called after the viewer added a comment, so the list can show the new count. */
  onCommentAdded?: () => void;
}

export function IdeaCard({ idea, canImprove = false, originalTitle, expanded, onToggleDetails, onToggleVote, voting = false, voteError = null, onReviewed, onCommentAdded }: IdeaCardProps) {
  const detailsId = `idea-details-${idea.idea_id}`;
  const commentsId = `idea-comments-${idea.idea_id}`;
  // Opening the comments is independent of the details.
  const [commentsOpen, setCommentsOpen] = useState(false);
  return (
    <article className={`card idea-card${expanded ? ' expanded' : ''}`} aria-labelledby={`idea-title-${idea.idea_id}`}>
      <div className="idea-card-top">
        <div className="badges">
          <StageBadge stage={idea.current_stage} />
          {idea.is_confidential && <ConfidentialBadge />}
          {idea.is_anonymous && <AnonymousBadge mine={idea.submitted_by_me} />}
        </div>
        <span className="muted small">{idea.category_name}</span>
      </div>

      <h3 id={`idea-title-${idea.idea_id}`}>{idea.title}</h3>
      {originalTitle && <p className="muted small">Second chance of: {originalTitle}</p>}
      {!expanded && <p className="clamp">{idea.problem}</p>}

      <div className="idea-card-bottom">
        <div className="small">
          <strong>{idea.submitter_name}</strong>
          <div className="muted">
            {OFFICE_LABELS[idea.office]} office · {formatDate(idea.created_at)}
          </div>
        </div>
        <div className="card-actions">
          <button type="button" className="btn btn-secondary" aria-expanded={expanded} aria-controls={detailsId} onClick={onToggleDetails}>
            {expanded ? 'Hide details' : 'Details'}
          </button>
          {/* US-7: "Show comments (N)" when there are comments, "Comment" when there are none;
              confidential ideas get no comments, so no button. */}
          {allowsComments(idea) && (
            <button type="button" className="btn btn-secondary" aria-expanded={commentsOpen} aria-controls={commentsId} onClick={() => setCommentsOpen(!commentsOpen)}>
              {idea.comment_count > 0 ? commentsButtonLabel(commentsOpen, idea.comment_count) : 'Comment'}
            </button>
          )}
          {canImprove && (
            <Link to={`/submit?improve=${idea.idea_id}`} className="btn btn-primary">
              Improve idea
            </Link>
          )}
          {/* Confidential ideas get no votes (US-4): no button and no count. */}
          {canVote(idea) ? (
            <button
              type="button"
              className={`btn vote${idea.voted_by_me ? ' voted' : ''}`}
              aria-pressed={idea.voted_by_me}
              disabled={voting}
              onClick={onToggleVote}
              title={idea.voted_by_me ? 'Take back your vote' : 'Vote for this idea'}
            >
              <span aria-hidden="true">↑</span> {idea.vote_count}
              <span className="visually-hidden"> votes. {idea.voted_by_me ? 'You voted.' : 'Vote for this idea.'}</span>
              <span className="vote-label" aria-hidden="true">{idea.voted_by_me ? 'Voted' : 'Vote'}</span>
            </button>
          ) : (
            showsVotes(idea) && (
              // Own idea: the votes are shown, but the submitter cannot vote.
              <span className="vote-count" title="You cannot vote for your own idea">
                <span aria-hidden="true">↑</span> {idea.vote_count} {idea.vote_count === 1 ? 'vote' : 'votes'}
              </span>
            )
          )}
        </div>
      </div>
      {voteError && (
        <p className="form-error" role="alert">
          {voteError}
        </p>
      )}

      {expanded && (
        <div id={detailsId}>
          <IdeaDetails ideaId={idea.idea_id} onReviewed={onReviewed} />
        </div>
      )}
      {commentsOpen && allowsComments(idea) && <IdeaComments idea={idea} onChanged={() => onCommentAdded?.()} />}
    </article>
  );
}
