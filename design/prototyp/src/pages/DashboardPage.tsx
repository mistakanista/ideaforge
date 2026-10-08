import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Filters } from '../components/Filters';
import { IdeaCard } from '../components/IdeaCard';
import { Pagination } from '../components/Pagination';
import { DEFAULT_PAGE_SIZE, OFFICES, PAGE_SIZES, STAGES, type PageSize } from '../config';
import { repository } from '../data';
import { DEFAULT_FILTERS, filterIdeas, paginate, sortIdeas, stageCounts, type IdeaFilters } from '../lib/ideaQuery';
import { useCurrentUser } from '../session/CurrentUser';
import type { Category, IdeaListItem, IdeaStage, OfficeCode } from '../types';

// Filters, sort order and page live in the URL, so views can be shared and the back button works.
function readFilters(params: URLSearchParams): IdeaFilters {
  const stage = params.get('stage');
  const office = params.get('office');
  const showDeclined = params.get('declined') === '1';
  const validStage = STAGES.some((s) => s.code === stage) && (stage !== 'DECLINED' || showDeclined);
  return {
    search: params.get('q') ?? '',
    categoryId: params.get('category') ? Number(params.get('category')) : null,
    office: OFFICES.some((o) => o.code === office) ? (office as OfficeCode) : null,
    stage: validStage ? (stage as IdeaStage) : null,
    showDeclined,
    sort: params.get('sort') === 'votes' ? 'votes' : 'newest',
  };
}

function writeFilters(f: IdeaFilters, page: number, size: PageSize): URLSearchParams {
  const params = new URLSearchParams();
  if (f.search) params.set('q', f.search);
  if (f.categoryId !== null) params.set('category', String(f.categoryId));
  if (f.office) params.set('office', f.office);
  if (f.stage) params.set('stage', f.stage);
  if (f.showDeclined) params.set('declined', '1');
  if (f.sort !== DEFAULT_FILTERS.sort) params.set('sort', f.sort);
  if (page > 1) params.set('page', String(page));
  if (size !== DEFAULT_PAGE_SIZE) params.set('size', String(size));
  return params;
}

export function DashboardPage() {
  const { user } = useCurrentUser();
  const location = useLocation();
  const createdTitle = (location.state as { created?: string } | null)?.created;
  const [params, setParams] = useSearchParams();
  const [ideas, setIdeas] = useState<IdeaListItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const filters = readFilters(params);
  const sizeParam = Number(params.get('size'));
  const pageSize: PageSize = (PAGE_SIZES as readonly number[]).includes(sizeParam) ? (sizeParam as PageSize) : DEFAULT_PAGE_SIZE;
  const requestedPage = Number(params.get('page')) || 1;

  const loadIdeas = useCallback(async () => {
    if (!user) return;
    setIdeas(await repository.listIdeas(user));
  }, [user]);

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  useEffect(() => {
    void repository.listCategories().then(setCategories);
  }, []);

  const filtered = ideas ? sortIdeas(filterIdeas(ideas, filters), filters.sort) : [];
  const counts = stageCounts(ideas ?? [], filters);
  const page = paginate(filtered, requestedPage, pageSize);

  function updateFilters(changes: Partial<IdeaFilters>) {
    // Every filter change starts again at page 1.
    setParams(writeFilters({ ...filters, ...changes }, 1, pageSize), { replace: 'search' in changes });
  }

  function goToPage(n: number) {
    setParams(writeFilters(filters, n, pageSize));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleDetails(ideaId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ideaId)) next.delete(ideaId);
      else next.add(ideaId);
      return next;
    });
  }

  async function toggleVote(ideaId: number) {
    if (!user) return;
    await repository.toggleVote(ideaId, user);
    await loadIdeas();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Browse ideas</h1>
          <p className="muted">Back the ideas you believe in. You have one vote per idea.</p>
        </div>
        <Link to="/submit" className="btn btn-primary">
          <span aria-hidden="true">+</span> Submit an idea
        </Link>
      </div>

      {createdTitle && (
        <p className="card success" role="status">
          Thank you! “{createdTitle}” has been submitted and is now at the top of the list.
        </p>
      )}

      <Filters filters={filters} categories={categories} counts={counts} onChange={updateFilters} />

      {ideas === null ? (
        <p className="muted">Loading ideas…</p>
      ) : page.total === 0 ? (
        <section className="card notice">
          <h2>No ideas found</h2>
          <p>Try another search term or remove some filters.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setParams(new URLSearchParams())}>
            Reset filters
          </button>
        </section>
      ) : (
        <div className="idea-list">
          {page.items.map((idea) => (
            <IdeaCard
              key={idea.idea_id}
              idea={idea}
              expanded={expanded.has(idea.idea_id)}
              onToggleDetails={() => toggleDetails(idea.idea_id)}
              onToggleVote={() => void toggleVote(idea.idea_id)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        onPageChange={goToPage}
        onPageSizeChange={(size) => setParams(writeFilters(filters, 1, size))}
      />
    </>
  );
}
