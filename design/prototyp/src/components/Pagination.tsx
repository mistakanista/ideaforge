import { PAGE_SIZES, type PageSize } from '../config';
import { pageNumbers, type Page } from '../lib/ideaQuery';

interface PaginationProps {
  page: Page<unknown>;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export function Pagination({ page, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  return (
    <nav className="pagination" aria-label="Pages">
      <div className="field field-inline">
        <label htmlFor="page-size">Ideas per page</label>
        <select id="page-size" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}>
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <p className="muted small" aria-live="polite">
        {page.total === 0 ? 'No ideas' : `Showing ${page.from}–${page.to} of ${page.total}`}
      </p>

      <div className="page-buttons">
        <button type="button" className="btn btn-secondary" disabled={page.page <= 1} onClick={() => onPageChange(page.page - 1)}>
          <span aria-hidden="true">←</span> Previous
        </button>
        {pageNumbers(page.page, page.pageCount).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="page-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className="btn page-number"
              aria-current={n === page.page ? 'page' : undefined}
              aria-label={`Page ${n}`}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page.page >= page.pageCount}
          onClick={() => onPageChange(page.page + 1)}
        >
          Next <span aria-hidden="true">→</span>
        </button>
      </div>
    </nav>
  );
}
