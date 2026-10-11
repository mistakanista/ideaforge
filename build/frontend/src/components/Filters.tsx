import { useEffect, useState } from 'react';
import { OFFICES, STAGES } from '../config';
import { HIDDEN_BY_DEFAULT, type IdeaFilters, type SortOrder, type StageFilter, type SubmitterOption } from '../lib/ideaQuery';
import type { Category, IdeaStage, OfficeCode } from '../types';

interface FiltersProps {
  filters: IdeaFilters;
  categories: Category[];
  counts: Record<IdeaStage, number>;
  submitters: SubmitterOption[];
  onChange: (changes: Partial<IdeaFilters>) => void;
}

export function Filters({ filters, categories, counts, submitters, onChange }: FiltersProps) {
  const allCount = STAGES.reduce((sum, s) => sum + counts[s.code], 0);
  const activeCount = STAGES.filter((s) => filters.mine || !HIDDEN_BY_DEFAULT.includes(s.code)).reduce(
    (sum, s) => sum + counts[s.code],
    0,
  );
  const selectedName = submitters.find((p) => p.id === filters.submitterId)?.name ?? '';

  // The person field is typed into freely; the filter only applies once the text matches a name from the list.
  const [personText, setPersonText] = useState(selectedName);
  useEffect(() => setPersonText(selectedName), [selectedName]);

  function changePerson(text: string) {
    setPersonText(text);
    const match = submitters.find((p) => p.name.toLowerCase() === text.trim().toLowerCase());
    if (match) {
      if (match.id !== filters.submitterId) onChange({ submitterId: match.id });
    } else if (filters.submitterId !== null) {
      onChange({ submitterId: null });
    }
  }

  return (
    <section className="card filters" aria-label="Search and filter ideas">
      <div className="filter-row filter-row-1">
        <div className="field">
          <label htmlFor="stage">Stage</label>
          <select
            id="stage"
            value={filters.stage ?? ''}
            onChange={(e) => onChange({ stage: (e.target.value || null) as StageFilter })}
          >
            <option value="">{filters.mine ? 'All my ideas' : 'Active ideas'} ({activeCount})</option>
            {STAGES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label} ({counts[s.code]})
              </option>
            ))}
            <option value="ALL">All stages ({allCount})</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={filters.categoryId ?? ''}
            onChange={(e) => onChange({ categoryId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.category_id} value={c.category_id}>
                {c.name}
                {c.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="office">Office</label>
          <select
            id="office"
            value={filters.office ?? ''}
            onChange={(e) => onChange({ office: (e.target.value || null) as OfficeCode | null })}
          >
            <option value="">All offices</option>
            {OFFICES.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as SortOrder })}>
            <option value="newest">Newest first</option>
            <option value="votes">Most votes first</option>
          </select>
        </div>
      </div>

      <div className="filter-row filter-row-2">
        <div className="field">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            placeholder="Title, problem, solution, keyword or name"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="submitter">Submitted by</label>
          <div className="input-with-action">
            <input
              id="submitter"
              type="text"
              list="submitter-options"
              autoComplete="off"
              placeholder="Type a name"
              value={personText}
              onChange={(e) => changePerson(e.target.value)}
            />
            {personText && (
              <button type="button" className="btn btn-secondary" onClick={() => changePerson('')}>
                Clear
              </button>
            )}
          </div>
          <datalist id="submitter-options">
            {submitters.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </div>
        <div className="field field-chip">
          <button type="button" className="chip" aria-pressed={filters.mine} onClick={() => onChange({ mine: !filters.mine })}>
            My ideas
          </button>
        </div>
      </div>
    </section>
  );
}
