import { formatIsoDate } from '../../members/utils/member-format';
import { formatPesos } from '../../pricing/utils/pricing-format';
import { useDebtNotices } from '../hooks/useDebtNotices';
import { numberIssueLabel, recipientLabel, standingLabel } from '../utils/notice-format';

/** Container of the debt notices: who owes, as of today, and one WhatsApp link per member to send by hand. */
export function NoticesView() {
  const { state, reload } = useDebtNotices();

  if (state.phase === 'loading') {
    return <section className="card members-page" aria-label="Avisos"><p className="members-page__notice" role="status">Cargando los avisos…</p></section>;
  }
  if (state.phase === 'error') {
    return (
      <section className="card members-page" aria-label="Avisos">
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p><strong>No se pudieron cargar los avisos.</strong> {state.message}</p>
          <button type="button" className="button button--secondary" onClick={reload}>Reintentar</button>
        </div>
      </section>
    );
  }

  const { asOf, rows } = state.list;
  return (
    <section className="card members-page" aria-label="Avisos">
      <h2 className="report-title">Avisos de deuda al {formatIsoDate(asOf)}</h2>
      <p className="members-page__summary">
        El total se calcula con la fecha de hoy y puede cambiar según la fecha de pago. Cada aviso se envía a mano desde WhatsApp.
      </p>
      {rows.length === 0 ? (
        <p className="members-page__notice">No hay socios con deuda para avisar.</p>
      ) : (
        <table className="members-table">
          <caption className="visually-hidden">Socios con deuda</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">N° de socio</th><th scope="col">Socio</th><th scope="col">Estado</th>
              <th scope="col">Meses adeudados</th><th scope="col">Total</th><th scope="col">Destinatario</th><th scope="col">Aviso</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((notice) => (
              <tr key={notice.memberId}>
                <td className="members-table__mono">{notice.memberNumber}</td>
                <td>{notice.name}</td>
                <td>{standingLabel(notice.standing)}</td>
                <td>{notice.unpaidPeriodCount}</td>
                <td className="members-table__mono">{formatPesos(notice.total)}</td>
                <td>{recipientLabel(notice)}</td>
                <td>
                  {notice.link ? (
                    <a className="button button--secondary notice-send" href={notice.link} target="_blank" rel="noopener noreferrer" aria-label={`Enviar por WhatsApp a ${notice.recipientName}`}>
                      Enviar por WhatsApp
                    </a>
                  ) : (
                    <span className="notice-issue">{numberIssueLabel(notice)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
