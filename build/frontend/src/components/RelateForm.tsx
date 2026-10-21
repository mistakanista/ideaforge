// Inline form for reviewers (US-13): relate this idea to another active idea, with a searchable
// list in alphabetical order.
import { useEffect, useState, type FormEvent } from 'react';
import { repository, RuleViolation } from '../data';
import { RELATION_OPTIONS, relationCandidates, searchCandidates } from '../lib/relationRules';
import { useCurrentUser } from '../session/CurrentUser';
import type { IdeaListItem, IdeaRelationType } from '../types';

interface RelateFormProps {
  idea: IdeaListItem;
  /** Ideas that are already related to this one (not offered again). */
  relatedIds: number[];
  onSaved: () => void;
  onCancel: () => void;
}

export function RelateForm({ idea, relatedIds, onSaved, onCancel }: RelateFormProps) {
  const { user } = useCurrentUser();
  const [ideas, setIdeas] = useState<IdeaListItem[] | null>(null);
  const [type, setType] = useState<IdeaRelationType>('RELATED_TO');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = (name: string) => `relate-${idea.idea_id}-${name}`;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void repository.listIdeas(user).then((list) => {
      if (!cancelled) setIdeas(list);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const candidates = ideas ? relationCandidates(ideas, idea.idea_id, relatedIds) : [];
  const shown = searchCandidates(candidates, query);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (chosen === null) {
      setError('Please choose an idea from the list.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await repository.relateIdeas({ idea_id: idea.idea_id, related_idea_id: chosen, relation_type: type }, user);
      onSaved();
    } catch (err) {
      setError(err instanceof RuleViolation ? err.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate aria-labelledby={id('title')}>
      <h5 id={id('title')}>Relate this idea</h5>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="field">
        <label htmlFor={id('type')}>This idea … (required)</label>
        <select id={id('type')} value={type} onChange={(e) => setType(e.target.value as IdeaRelationType)}>
          {RELATION_OPTIONS.map((o) => (
            <option key={o.type} value={o.type}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor={id('search')}>Search ideas by title</label>
        <input id={id('search')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor={id('idea')}>Other idea (required)</label>
        <select
          id={id('idea')}
          size={6}
          value={chosen ?? ''}
          aria-describedby={id('idea-hint')}
          onChange={(e) => setChosen(Number(e.target.value))}
        >
          {shown.map((i) => (
            <option key={i.idea_id} value={i.idea_id}>
              {i.title}
            </option>
          ))}
        </select>
        <p id={id('idea-hint')} className="hint" aria-live="polite">
          {ideas === null
            ? 'Loading ideas…'
            : `${shown.length} of ${candidates.length} ideas, alphabetical. Confidential and declined ideas are not listed.`}
        </p>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Relate'}
        </button>
      </div>
    </form>
  );
}
