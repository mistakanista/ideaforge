import { pageNumbers, type Page } from '../lib/ideaQuery';

interface CommentPaginationProps {
  page: Page<unknown>;
  onPageChange: (page: number) => void;
}

/** Page browser of the comments (US-7); shown only when there is more than one page. */
export function CommentPagination({ page, onPageChange }: CommentPaginationProps) {
  if (page.pageCount <= 1) return null;
  return (
    <nav className="pagination" aria-label="Comment pages">
      <p className="muted small" aria-live="polite">
        Showing comments {page.from}–{page.to} of {page.total} (answers are shown below their comment)
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
              aria-label={`Comment page ${n}`}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className="btn btn-secondary" disabled={page.page >= page.pageCount} onClick={() => onPageChange(page.page + 1)}>
          Next <span aria-hidden="true">→</span>
        </button>
      </div>
    </nav>
  );
}
