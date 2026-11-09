import { formatIsoDate } from '../../members/utils/member-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import { useExpenses } from '../hooks/useExpenses';
import { CATEGORY_LABELS } from '../utils/expense-format';
import { ExpenseForm } from './ExpenseForm';

/** Container of the club expenses: a form to record one and the list of those already recorded. */
export function ExpensesView({ canWrite }: { canWrite: boolean }) {
  const { state, saving, reload, save } = useExpenses();

  return (
    <section className="card members-page report-page" aria-label="Gastos">
      <h2 className="report-title">Gastos del club</h2>

      {canWrite ? <ExpenseForm saving={saving.phase === 'saving'} {...(saving.phase === 'error' ? { error: saving.message } : {})} onSave={save} /> : null}

      {state.phase === 'loading' ? <p className="members-page__notice" role="status">Cargando los gastos…</p> : null}
      {state.phase === 'error' ? (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p><strong>No se pudieron cargar los gastos.</strong> {state.message}</p>
          <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
        </div>
      ) : null}
      {state.phase === 'ready' && state.expenses.length === 0 ? <p className="members-page__notice">Todavía no hay gastos registrados.</p> : null}
      {state.phase === 'ready' && state.expenses.length > 0 ? (
        <table className="members-table">
          <caption className="visually-hidden">Gastos registrados</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">Fecha</th><th scope="col">Categoría</th><th scope="col">Descripción</th><th scope="col">Monto</th>
            </tr>
          </thead>
          <tbody>
            {state.expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="members-table__mono">{formatIsoDate(expense.date)}</td>
                <td>{CATEGORY_LABELS[expense.category]}</td>
                <td>{expense.description}</td>
                <td className="members-table__mono">{formatPesos(expense.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
