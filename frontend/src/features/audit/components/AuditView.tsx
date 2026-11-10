import { Pagination } from '../../../components/Pagination';
import { usePagination } from '../../../hooks/usePagination';
import { useAuditFilters } from '../hooks/useAuditFilters';
import { useAuditLog } from '../hooks/useAuditLog';
import { hasActiveFilters, resultsSummary } from '../utils/audit-filters';
import { failedWritesMessage } from '../utils/audit-format';
import { AuditFilterCard } from './AuditFilterCard';
import { AuditTable } from './AuditTable';

/** Container of the audit log (RF-27): who did what and when, newest first, filterable. Read-only. */
export function AuditView() {
  const { filters, change, clear } = useAuditFilters();
  const { state, reload, url } = useAuditLog(filters);
  // A changed filter sends the reader back to the first page.
  const pager = usePagination(state.phase === 'ready' ? state.entries : [], url);
  const actors = state.phase === 'ready' ? state.actors : [];
  const filtered = hasActiveFilters(filters);

  return (
    <section className="audit" aria-label="Auditoría">
      <p className="audit__intro">
        Registro de quién creó, modificó o anuló cada dato y cuándo. No se puede modificar y solo muestra los nombres de los campos cambiados, nunca sus valores.
      </p>

      {state.phase === 'ready' && state.failedWrites.count > 0 && (
        <div className="members-page__notice members-page__notice--error audit__banner" role="alert">
          <p>{failedWritesMessage(state.failedWrites)}</p>
        </div>
      )}

      <AuditFilterCard filters={filters} actors={actors} onChange={change} onClear={clear} />

      {state.phase === 'loading' && (
        <div className="card audit-results"><p className="members-page__notice" role="status">Cargando la auditoría…</p></div>
      )}

      {state.phase === 'error' && (
        <div className="card audit-results">
          <div className="members-page__notice members-page__notice--error" role="alert">
            <p><strong>No se pudo cargar la auditoría.</strong> {state.message}</p>
            <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
          </div>
        </div>
      )}

      {state.phase === 'ready' && (
        <div className="card audit-results" aria-busy={state.refreshing}>
          <p className="audit-results__summary" aria-live="polite">{resultsSummary(state.entries.length)}</p>
          {state.entries.length === 0 ? (
            filtered ? (
              <div className="members-page__notice">
                <p>No hay registros con estos filtros.</p>
                <button type="button" className="button button--secondary" onClick={clear}>Limpiar filtros</button>
              </div>
            ) : (
              <p className="members-page__notice">Todavía no hay operaciones registradas.</p>
            )
          ) : (
            <>
              <div className="audit-results__scroll">
                <AuditTable entries={pager.pageItems} onFilterMember={(member) => change({ member })} />
              </div>
              <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total} onPageChange={pager.setPage} label="Paginación de la auditoría" />
            </>
          )}
        </div>
      )}
    </section>
  );
}
