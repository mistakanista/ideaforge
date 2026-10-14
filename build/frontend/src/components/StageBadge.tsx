import { STAGE_BY_CODE } from '../config';
import type { IdeaStage } from '../types';

/** Stage shown as text plus coloured dot, never colour alone. */
export function StageBadge({ stage }: { stage: IdeaStage }) {
  const config = STAGE_BY_CODE[stage];
  return (
    <span className="badge" style={{ color: config.color, borderColor: config.color }}>
      <span className="badge-dot" style={{ background: config.color }} aria-hidden="true" />
      {config.label}
    </span>
  );
}

export function ConfidentialBadge() {
  return (
    <span className="badge badge-confidential" title="Only visible to the submitter and the innovation panel">
      <span aria-hidden="true">🔒</span> Confidential
    </span>
  );
}

/** Shown on anonymous ideas; the submitter sees their own ideas marked "Anonymous to others". */
export function AnonymousBadge({ mine = false }: { mine?: boolean }) {
  return (
    <span className="badge badge-confidential" title={mine ? 'Other people do not see your name' : 'The submitter is not shown'}>
      <span aria-hidden="true">👤</span> Anonymous{mine ? ' to others' : ''}
    </span>
  );
}
