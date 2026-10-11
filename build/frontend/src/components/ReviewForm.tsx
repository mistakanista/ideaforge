// Inline review form for reviewers (US-3): move the idea to the next stage with scores,
// or decline it with a reason (scores optional, all three or none).
import { useState, type FormEvent } from 'react';
import { MAX_SCORE, MIN_SCORE, SCORING_CRITERIA, STAGE_BY_CODE } from '../config';
import { repository, RuleViolation } from '../data';
import { nextStage, validateReview, type ReviewDraft, type ReviewField } from '../lib/reviewRules';
import { useCurrentUser } from '../session/CurrentUser';
import type { IdeaListItem } from '../types';

type ScoreKey = 'impact' | 'cost' | 'feasibility';

const SCORE_KEY: Record<(typeof SCORING_CRITERIA)[number]['code'], ScoreKey> = {
  IMPACT: 'impact',
  COST: 'cost',
  FEASIBILITY: 'feasibility',
};

const SCORE_VALUES = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

const EMPTY: ReviewDraft = { decision: null, impact: null, cost: null, feasibility: null, reason: '' };

interface ReviewFormProps {
  idea: IdeaListItem;
  onSaved: () => void;
  onCancel: () => void;
}

export function ReviewForm({ idea, onSaved, onCancel }: ReviewFormProps) {
  const { user } = useCurrentUser();
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<ReviewField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const next = nextStage(idea.current_stage);
  const id = (name: string) => `review-${idea.idea_id}-${name}`;
  const declining = draft.decision === 'DECLINE';
  const hasScores = draft.impact !== null || draft.cost !== null || draft.feasibility !== null;

  function update<K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const result = validateReview(idea.current_stage, draft);
    if (result.errors) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    setFormError(null);
    try {
      await repository.reviewIdea(idea.idea_id, result.input, user);
      onSaved();
    } catch (err) {
      setFormError(err instanceof RuleViolation ? err.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  function errorText(field: ReviewField) {
    return errors[field] ? (
      <p id={id(`${field}-error`)} className="field-error">
        {errors[field]}
      </p>
    ) : null;
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate aria-labelledby={id('title')}>
      <h5 id={id('title')}>Your review</h5>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}

      <fieldset className="field" aria-describedby={errors.to_stage ? id('to_stage-error') : undefined}>
        <legend>Decision (required)</legend>
        <div className="radio-row">
          {next && (
            <label className="checkbox radio-card">
              <input
                type="radio"
                name={id('decision')}
                value="MOVE"
                checked={draft.decision === 'MOVE'}
                onChange={() => update('decision', 'MOVE')}
              />
              <span>Move to {STAGE_BY_CODE[next].label}</span>
            </label>
          )}
          <label className="checkbox radio-card">
            <input
              type="radio"
              name={id('decision')}
              value="DECLINE"
              checked={declining}
              onChange={() => update('decision', 'DECLINE')}
            />
            <span>Decline</span>
          </label>
        </div>
        {errorText('to_stage')}
      </fieldset>

      <fieldset className="field" aria-describedby={errors.scores ? id('scores-error') : id('scores-hint')}>
        <legend>Scores {declining ? '(optional when declining)' : '(required)'}</legend>
        <p id={id('scores-hint')} className="hint">
          From {MIN_SCORE} to {MAX_SCORE}; {MAX_SCORE} is always best.
          {declining && ' Give all three scores or none.'}
        </p>
        {SCORING_CRITERIA.map((criterion) => {
          const key = SCORE_KEY[criterion.code];
          return (
            <fieldset key={criterion.code} className="score-input">
              <legend>
                {criterion.name} <span className="hint">{criterion.hint}</span>
              </legend>
              <div className="score-options">
                {SCORE_VALUES.map((value) => (
                  <label key={value} className="score-option">
                    <input
                      type="radio"
                      name={id(key)}
                      value={value}
                      checked={draft[key] === value}
                      onChange={() => update(key, value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
        {declining && hasScores && (
          <button
            type="button"
            className="link-button"
            onClick={() => setDraft((d) => ({ ...d, impact: null, cost: null, feasibility: null }))}
          >
            Clear scores
          </button>
        )}
        {errorText('scores')}
      </fieldset>

      <div className="field">
        <label htmlFor={id('reason')}>Reason {declining ? '(required)' : '(optional)'}</label>
        <textarea
          id={id('reason')}
          rows={3}
          value={draft.reason}
          aria-invalid={errors.reason ? true : undefined}
          aria-describedby={errors.reason ? id('reason-error') : id('reason-hint')}
          onChange={(e) => update('reason', e.target.value)}
        />
        <p id={id('reason-hint')} className="hint">
          {declining ? 'The submitter will see this reason.' : 'For example what convinced you or what to watch out for.'}
        </p>
        {errorText('reason')}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save review'}
        </button>
      </div>
    </form>
  );
}
