import { useEffect, useState } from 'react';
import { formatDate, MAX_SCORE, SCORING_CRITERIA, STAGE_BY_CODE } from '../config';
import { repository } from '../data';
import { canReview } from '../lib/reviewRules';
import { useCurrentUser } from '../session/CurrentUser';
import type { IdeaDetails as Details, ReviewerScorecard } from '../types';
import { ReviewForm } from './ReviewForm';

function average(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function formatScore(value: number | null): string {
  return value === null ? '–' : value.toFixed(1);
}

function criterionAverage(cards: ReviewerScorecard[], criterionId: number): number | null {
  return average(cards.map((c) => c.scores[criterionId]).filter((v): v is number => v !== undefined));
}

export function IdeaDetails({ ideaId, onReviewed }: { ideaId: number; onReviewed?: () => void }) {
  const { user } = useCurrentUser();
  const [details, setDetails] = useState<Details | null | undefined>(undefined);
  const [reviewing, setReviewing] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void repository.getIdeaDetails(ideaId, user).then((d) => {
      if (!cancelled) setDetails(d);
    });
    return () => {
      cancelled = true;
    };
  }, [ideaId, user, reloadCount]);

  if (details === undefined) return <p className="muted">Loading details…</p>;
  if (details === null) return <p className="muted">This idea is not available.</p>;

  const { idea, scorecards, history } = details;
  const overall = average(scorecards.flatMap((c) => Object.values(c.scores)));
  const mayReview = user !== null && canReview(user, idea);

  function handleReviewed() {
    setReviewing(false);
    setReloadCount((n) => n + 1);
    onReviewed?.();
  }

  return (
    <div className="details">
      <div className="details-texts">
        <h4>The problem</h4>
        <p>{idea.problem}</p>
        <h4>Proposed solution</h4>
        <p>{idea.solution}</p>
        <h4>Expected impact</h4>
        <p>{idea.expected_impact}</p>
      </div>

      <div className="details-section">
        <div className="section-header">
          <h4>Review scores</h4>
          {mayReview && !reviewing && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setReviewing(true)}>
              Review
            </button>
          )}
        </div>
        {mayReview && reviewing && (
          <ReviewForm idea={idea} onSaved={handleReviewed} onCancel={() => setReviewing(false)} />
        )}
        {scorecards.length === 0 ? (
          <p className="muted">Not scored yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="score-table">
              <caption className="visually-hidden">Scores from 1 to {MAX_SCORE} per review</caption>
              <thead>
                <tr>
                  <th scope="col">Reviewer</th>
                  {SCORING_CRITERIA.map((c) => (
                    <th scope="col" key={c.criterion_id}>
                      {c.name}
                      <span className="th-hint">{c.hint}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scorecards.map((card) => (
                  <tr key={card.key}>
                    <th scope="row">
                      {card.reviewer_name}
                      {card.to_stage && card.reviewed_at && (
                        <span className="th-hint">
                          {card.to_stage === 'DECLINED' ? 'Declined' : `Moved to ${STAGE_BY_CODE[card.to_stage].label}`} ·{' '}
                          {formatDate(card.reviewed_at)}
                        </span>
                      )}
                    </th>
                    {SCORING_CRITERIA.map((c) => (
                      <td key={c.criterion_id}>{card.scores[c.criterion_id] ?? '–'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Average</th>
                  {SCORING_CRITERIA.map((c) => (
                    <td key={c.criterion_id}>{formatScore(criterionAverage(scorecards, c.criterion_id))}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {overall !== null && (
          <p className="overall">
            Overall score <strong>{formatScore(overall)}</strong> / {MAX_SCORE}
          </p>
        )}
      </div>

      <div className="details-section">
        <h4>Stage history</h4>
        <ol className="history">
          {history.map((entry) => (
            <li key={entry.history_id}>
              <span className="badge-dot" style={{ background: STAGE_BY_CODE[entry.to_stage].color }} aria-hidden="true" />
              <div>
                <strong>
                  {!entry.from_stage
                    ? 'Submitted'
                    : entry.to_stage === 'DECLINED'
                      ? 'Declined'
                      : `Moved to ${STAGE_BY_CODE[entry.to_stage].label}`}
                </strong>
                {entry.reason && <p>{entry.reason}</p>}
                <div className="muted small">
                  {entry.changed_by_name} · {formatDate(entry.changed_at)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
