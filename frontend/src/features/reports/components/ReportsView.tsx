import { useEffect, useState } from 'react';
import { fetchHistory } from '../../cashcount/services/cashcount-api';
import type { CashCount } from '../../cashcount/types/cashcount';
import { useDisciplinesList } from '../../disciplines/hooks/useDisciplinesList';
import { useReport, type ReportState } from '../hooks/useReport';
import { fetchDisciplineSettlement, fetchRevenue } from '../services/reports-api';
import type { DisciplineSettlement, ReportGranularity, RevenueReport } from '../types/report';
import { GRANULARITIES, todayDate } from '../utils/report-format';
import { revenueExport, settlementExport } from '../utils/report-export';
import { ReportActions } from './ReportActions';
import { RevenueResult } from './RevenueResult';
import { SettlementResult } from './SettlementResult';

type Kind = 'revenue' | 'settlement';

function Outcome<T>({ state, retry, children }: { state: ReportState<T>; retry: () => void; children: (report: T) => React.ReactNode }) {
  if (state.phase === 'loading') return <p className="members-page__notice" role="status">Generando el reporte…</p>;
  if (state.phase === 'error') {
    return (
      <div className="members-page__notice members-page__notice--error" role="alert">
        <p><strong>No se pudo generar el reporte.</strong> {state.message}</p>
        <button type="button" className="button button--secondary" onClick={retry}>Reintentar</button>
      </div>
    );
  }
  return state.phase === 'ready' ? <>{children(state.report)}</> : null;
}

/**
 * The revenue sheet with the day's saved Arqueo, when the user may read it and one exists. Without it the
 * sheet prints blank lines for the counted cash, so a failed or forbidden read never blocks the report.
 */
function RevenueSheet({ report, issuedBy, canReadCashCount }: { report: RevenueReport; issuedBy?: string; canReadCashCount: boolean }) {
  const [cashCount, setCashCount] = useState<CashCount | undefined>();
  useEffect(() => {
    setCashCount(undefined);
    if (!canReadCashCount || report.granularity !== 'daily') return;
    const controller = new AbortController();
    fetchHistory(controller.signal).then(
      (history) => { if (!controller.signal.aborted) setCashCount(history.find(({ businessDate }) => businessDate === report.from)); },
      () => undefined,
    );
    return () => controller.abort();
  }, [report, canReadCashCount]);
  return <RevenueResult report={report} issuedBy={issuedBy} cashCount={cashCount} />;
}

/** Container of the reports feature: picks a report and its criteria and shows the result the server computed. */
export function ReportsView({ issuedBy, canReadCashCount = false }: { issuedBy?: string; canReadCashCount?: boolean } = {}) {
  const [kind, setKind] = useState<Kind>('revenue');
  const [granularity, setGranularity] = useState<ReportGranularity>('daily');
  const [date, setDate] = useState(todayDate);
  const [month, setMonth] = useState(() => todayDate().slice(0, 7));
  const [disciplineId, setDisciplineId] = useState('');
  const revenue = useReport<RevenueReport>();
  const settlement = useReport<DisciplineSettlement>();
  // Only mounted while the settlement report is chosen, so the catalog is not fetched for revenue.
  const disciplines = kind === 'settlement' ? <DisciplineOptions /> : null;

  const canGenerate = kind === 'revenue' ? date !== '' : month !== '' && disciplineId !== '';

  function generate() {
    if (kind === 'revenue') revenue.run((signal) => fetchRevenue(granularity, date, signal));
    else settlement.run((signal) => fetchDisciplineSettlement(month, disciplineId, signal));
  }

  return (
    <section className="card members-page report-page" aria-label="Reportes">
      <fieldset className="report-kind">
        <legend>Tipo de reporte</legend>
        <label><input type="radio" name="report-kind" checked={kind === 'revenue'} onChange={() => setKind('revenue')} /> Recaudación</label>
        <label><input type="radio" name="report-kind" checked={kind === 'settlement'} onChange={() => setKind('settlement')} /> Liquidación por disciplina</label>
      </fieldset>

      <form className="report-filters" onSubmit={(event) => { event.preventDefault(); if (canGenerate) generate(); }}>
        {kind === 'revenue' ? (
          <>
            <div className="form-field">
              <label htmlFor="report-granularity" className="form-field__label">Período</label>
              <select id="report-granularity" value={granularity} onChange={(event) => setGranularity(event.target.value as ReportGranularity)}>
                {GRANULARITIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="report-date" className="form-field__label">Fecha</label>
              <input id="report-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="report-month" className="form-field__label">Mes</label>
              <input id="report-month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="report-discipline" className="form-field__label">Disciplina</label>
              <select id="report-discipline" value={disciplineId} onChange={(event) => setDisciplineId(event.target.value)}>
                <option value="">Elija una disciplina</option>
                {disciplines}
              </select>
            </div>
          </>
        )}
        <button type="submit" className="button button--primary" disabled={!canGenerate}>Generar reporte</button>
      </form>

      {kind === 'revenue'
        ? <Outcome state={revenue.state} retry={revenue.retry}>{(report) => <><ReportActions exported={revenueExport(report)} /><RevenueSheet report={report} issuedBy={issuedBy} canReadCashCount={canReadCashCount} /></>}</Outcome>
        : <Outcome state={settlement.state} retry={settlement.retry}>{(report) => <><ReportActions exported={settlementExport(report)} /><SettlementResult report={report} issuedBy={issuedBy} /></>}</Outcome>}
    </section>
  );
}

// Past disciplines stay selectable: a month can be settled after a discipline was deactivated.
function DisciplineOptions() {
  const { state } = useDisciplinesList({ search: '', status: 'all' });
  if (state.phase !== 'ready') return null;
  return <>{state.disciplines.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</>;
}
