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
