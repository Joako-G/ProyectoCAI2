import { formatIsoDate } from '../../members/utils/member-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import { useArqueo } from '../hooks/useArqueo';
import { describeVariance } from '../utils/cashcount-format';
import { CloseDayForm } from './CloseDayForm';
import { ClosedDay } from './ClosedDay';
import { ExpectedTotals } from './ExpectedTotals';

/** Container of the cash count: today's expected totals, the close of the day and the days already closed. */
export function ArqueoView() {
  const { state, closing, alreadyClosed, reload, close } = useArqueo();

  if (state.phase === 'loading') {
    return <section className="card members-page" aria-label="Arqueo"><p className="members-page__notice" role="status">Cargando el arqueo…</p></section>;
  }
  if (state.phase === 'error') {
    return (
      <section className="card members-page" aria-label="Arqueo">
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p><strong>No se pudo cargar el arqueo.</strong> {state.message}</p>
          <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
        </div>
      </section>
    );
  }

  const { preview, history } = state;
  const earlier = history.filter((entry) => entry.businessDate !== preview.businessDate);
  return (
    <section className="card members-page" aria-label="Arqueo">
      <h2>Arqueo del {formatIsoDate(preview.businessDate)}</h2>
      <ExpectedTotals expected={preview.expected} />

      {preview.closed ? (
        <>
          {alreadyClosed ? <p className="members-page__notice" role="status">Otra persona ya cerró el día. Se muestra el cierre registrado.</p> : null}
          <ClosedDay close={preview.closed} />
        </>
      ) : (
        <CloseDayForm
          expectedCash={preview.expected.cash}
          saving={closing.phase === 'saving'}
          {...(closing.phase === 'error' ? { error: closing.message } : {})}
          onClose={(input) => void close(input)}
        />
      )}

      {earlier.length > 0 ? (
        <table className="members-table">
          <caption className="visually-hidden">Cierres anteriores</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">Fecha</th><th scope="col">Efectivo esperado</th><th scope="col">Efectivo contado</th>
              <th scope="col">Diferencia</th><th scope="col">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {earlier.map((entry) => (
              <tr key={entry.id}>
                <td className="members-table__mono">{formatIsoDate(entry.businessDate)}</td>
                <td className="members-table__mono">{formatPesos(entry.expected.cash)}</td>
                <td className="members-table__mono">{formatPesos(entry.countedCash)}</td>
                <td>{describeVariance(entry.variance)}</td>
                <td>{entry.varianceNote ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
