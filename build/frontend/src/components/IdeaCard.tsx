import { formatDate, OFFICE_LABELS } from '../config';
import type { IdeaListItem } from '../types';
import { IdeaDetails } from './IdeaDetails';
import { ConfidentialBadge, StageBadge } from './StageBadge';

interface IdeaCardProps {
  idea: IdeaListItem;
  expanded: boolean;
  onToggleDetails: () => void;
  onToggleVote: () => void;
}

export function IdeaCard({ idea, expanded, onToggleDetails, onToggleVote }: IdeaCardProps) {
  const detailsId = `idea-details-${idea.idea_id}`;
  return (
    <article className={`card idea-card${expanded ? ' expanded' : ''}`} aria-labelledby={`idea-title-${idea.idea_id}`}>
      <div className="idea-card-top">
        <div className="badges">
          <StageBadge stage={idea.current_stage} />
          {idea.is_confidential && <ConfidentialBadge />}
        </div>
        <span className="muted small">{idea.category_name}</span>
      </div>

      <h3 id={`idea-title-${idea.idea_id}`}>{idea.title}</h3>
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
          <button
            type="button"
            className={`btn vote${idea.voted_by_me ? ' voted' : ''}`}
            aria-pressed={idea.voted_by_me}
            onClick={onToggleVote}
            title={idea.voted_by_me ? 'Take back your vote' : 'Vote for this idea'}
          >
            <span aria-hidden="true">↑</span> {idea.vote_count}
            <span className="visually-hidden"> votes. {idea.voted_by_me ? 'You voted.' : 'Vote for this idea.'}</span>
            <span className="vote-label" aria-hidden="true">{idea.voted_by_me ? 'Voted' : 'Vote'}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div id={detailsId}>
          <IdeaDetails ideaId={idea.idea_id} />
        </div>
      )}
    </article>
  );
}
