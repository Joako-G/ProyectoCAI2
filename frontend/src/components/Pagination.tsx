import { pageNumbers, pageRange, PAGE_SIZE } from '../utils/pagination';

interface PaginationProps {
  page: number;
  pageCount: number;
  /** Total rows of the whole list, for the "Mostrando 11–20 de 35" summary. */
  total: number;
  onPageChange: (page: number) => void;
  /** Accessible name of the navigation; several lists may share a screen. */
  label?: string;
}

/** Page controls of a list. Shows nothing while everything fits on one page. */
export function Pagination({ page, pageCount, total, onPageChange, label = 'Paginación' }: PaginationProps) {
  if (pageCount <= 1) return null;
  const { from, to } = pageRange(page, total, PAGE_SIZE);
  return (
    <nav className="pagination" aria-label={label}>
      <p className="pagination__summary" role="status">
        Mostrando {from}–{to} de {total}
      </p>
      <div className="pagination__controls">
        <button type="button" className="button button--secondary pagination__step" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </button>
        <ol className="pagination__pages">
          {pageNumbers(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <li key={`gap-${index}`} className="pagination__gap" aria-hidden="true">…</li>
            ) : (
              <li key={entry}>
                <button
                  type="button"
                  className={`button pagination__page${entry === page ? ' pagination__page--current' : ''}`}
                  aria-label={`Página ${entry}`}
                  aria-current={entry === page ? 'page' : undefined}
                  onClick={() => onPageChange(entry)}
                >
                  {entry}
                </button>
              </li>
            ),
          )}
        </ol>
        <p className="pagination__position">Página {page} de {pageCount}</p>
        <button type="button" className="button button--secondary pagination__step" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </button>
      </div>
    </nav>
  );
}
