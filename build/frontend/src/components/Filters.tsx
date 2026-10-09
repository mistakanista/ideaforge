import { OFFICES, STAGES } from '../config';
import type { IdeaFilters, SortOrder } from '../lib/ideaQuery';
import type { Category, IdeaStage, OfficeCode } from '../types';

interface FiltersProps {
  filters: IdeaFilters;
  categories: Category[];
  counts: Record<IdeaStage, number>;
  onChange: (changes: Partial<IdeaFilters>) => void;
}

export function Filters({ filters, categories, counts, onChange }: FiltersProps) {
  const visibleStages = STAGES.filter((s) => s.code !== 'DECLINED' || filters.showDeclined);
  const allCount = visibleStages.reduce((sum, s) => sum + counts[s.code], 0);

  return (
    <section className="card filters" aria-label="Search and filter ideas">
      <div className="filter-grid">
        <div className="field field-search">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            placeholder="Title, problem, solution or keyword"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
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

      <div className="stage-row">
        <div className="chips" role="group" aria-label="Filter by stage">
          <button type="button" className="chip" aria-pressed={filters.stage === null} onClick={() => onChange({ stage: null })}>
            All <span className="chip-count">{allCount}</span>
          </button>
          {visibleStages.map((s) => (
            <button
              key={s.code}
              type="button"
              className="chip"
              aria-pressed={filters.stage === s.code}
              onClick={() => onChange({ stage: s.code })}
            >
              {s.label} <span className="chip-count">{counts[s.code]}</span>
            </button>
          ))}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.showDeclined}
            onChange={(e) =>
              onChange({
                showDeclined: e.target.checked,
                stage: !e.target.checked && filters.stage === 'DECLINED' ? null : filters.stage,
              })
            }
          />
          Show declined ideas
        </label>
      </div>
    </section>
  );
}
