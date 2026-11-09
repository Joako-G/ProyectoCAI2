import { Pagination } from '../../../components/Pagination';
import { usePagination } from '../../../hooks/usePagination';
import { roleLabel } from '../../users/utils/user-format';
import { useAuditLog } from '../hooks/useAuditLog';
import { actionLabel, changedFieldsLabel, failedWritesMessage, formatInstant } from '../utils/audit-format';

/** Container of the audit log (RF-27): who did what and when, newest first. Read-only. */
export function AuditView() {
  const { state, reload } = useAuditLog();
  const pager = usePagination(state.phase === 'ready' ? state.entries : []);

  if (state.phase === 'loading') {
    return <section className="card members-page" aria-label="Auditoría"><p className="members-page__notice" role="status">Cargando la auditoría…</p></section>;
  }
  if (state.phase === 'error') {
    return (
      <section className="card members-page" aria-label="Auditoría">
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p><strong>No se pudo cargar la auditoría.</strong> {state.message}</p>
          <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
        </div>
      </section>
    );
  }

  const { entries, failedWrites } = state;
  return (
    <section className="card members-page" aria-label="Auditoría">
      {failedWrites.count > 0 && (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p>{failedWritesMessage(failedWrites)}</p>
        </div>
      )}
      <p className="members-page__summary">
        Registro de quién creó, modificó o anuló cada dato y cuándo. No se puede modificar y solo muestra los nombres de los campos cambiados, nunca sus valores.
      </p>
      {entries.length === 0 ? (
        <p className="members-page__notice">Todavía no hay operaciones registradas.</p>
      ) : (
        <>
          <table className="members-table members-table--stack">
            <caption className="visually-hidden">Registro de auditoría</caption>
            <thead>
              <tr className="table-head">
                <th scope="col">Fecha</th><th scope="col">Usuario</th><th scope="col">Rol</th>
                <th scope="col">Acción</th><th scope="col">Registro</th><th scope="col">Campos modificados</th>
              </tr>
            </thead>
            <tbody>
              {pager.pageItems.map((entry) => (
                <tr key={entry.id}>
                  <td className="members-table__mono" data-label="Fecha">{formatInstant(entry.at)}</td>
                  <td data-label="Usuario">{entry.actor.name}</td>
                  <td data-label="Rol">{roleLabel(entry.actor.role)}</td>
                  <td data-label="Acción">{actionLabel(entry.action)}</td>
                  <td data-label="Registro">{entry.entityLabel}</td>
                  <td data-label="Campos modificados">{changedFieldsLabel(entry.changedFields)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pager.page} pageCount={pager.pageCount} total={pager.total} onPageChange={pager.setPage} label="Paginación de la auditoría" />
        </>
      )}
    </section>
  );
}
