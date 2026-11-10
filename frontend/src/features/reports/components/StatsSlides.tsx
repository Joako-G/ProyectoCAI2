import { useState } from 'react';
import { CATEGORY_LABELS } from '../../expenses/utils/expense-format';
import type { Expense } from '../../expenses/types/expense';
import type { DebtNotice } from '../../notices/types/notice';
import { methodLabel } from '../../payments/utils/payment-format';
import type { LoadState } from '../hooks/useLoad';
import type { DisciplineIncome, RevenueReport } from '../types/report';
import { aggregateRevenue, collectionSummary, expensesByCategory, expensesByMonth, expensesInMonths } from '../utils/finance';
import { conceptTotalLabel, formatAmount } from '../utils/report-format';
import { barPercent, monthName, pieColor, wholeShare } from '../utils/stats';
import { MonthRows } from './MonthRows';
import { PieChart } from './PieChart';

const INCOME_COLOR = '#1f4e8c';
const EXPENSE_COLOR = '#d9a441';
const UP_TO_DATE_COLOR = '#2f8f6b';
const LONG_DEBT_COLOR = '#c0563f';

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Shows what a load is doing, or hands the loaded data to `children`. */
export function Async<T>({ state, what, retry, children }: { state: LoadState<T>; what: string; retry: () => void; children: (data: T) => React.ReactNode }) {
  if (state.phase === 'loading') return <p className="members-page__notice" role="status">Calculando {what}…</p>;
  if (state.phase === 'error') {
    return (
      <div className="members-page__notice members-page__notice--error" role="alert">
        <p><strong>No se pudo cargar {what}.</strong> {state.message}</p>
        <button type="button" className="button button--secondary" onClick={retry}>Reintentar</button>
      </div>
    );
  }
  return <>{children(state.data)}</>;
}

/** One big figure with what it is above it and what it means below it. */
function Tile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: 'income' | 'expense' | 'good' | 'bad' }) {
  return (
    <div className="stats__tile" data-tone={tone}>
      <span className="stats__tile-label">{label}</span>
      <strong className="stats__tile-value">{value}</strong>
      <span className="stats__tile-hint">{hint}</span>
    </div>
  );
}

const EXPENSES_UNAVAILABLE = 'Los gastos no están disponibles para este usuario.';

interface RangeData {
  months: string[];
  revenue: LoadState<RevenueReport[]>;
  expenses: LoadState<Expense[]>;
  retryRevenue: () => void;
  retryExpenses: () => void;
}

/** The period in three figures (what came in, what went out, what was left) and then the same month by month. */
export function SummarySlide({ months, revenue, expenses, retryRevenue }: RangeData) {
  return (
    <Async state={revenue} what="los ingresos" retry={retryRevenue}>
      {(reports) => {
        const income = reports.map((report) => report.total);
        const spent = expenses.phase === 'ready' ? expensesByMonth(expenses.data, months) : undefined;
        const balance = spent ? income.map((value, index) => value - spent[index]) : undefined;
        const left = balance ? sum(balance) : undefined;
        const last = months.length - 1;
        const change = last > 0 ? income[last] - income[last - 1] : undefined;
        const best = income.indexOf(Math.max(...income));
        const annulled = { count: sum(reports.map((report) => report.annulled.count)), total: sum(reports.map((report) => report.annulled.total)) };
        return (
          <>
            <section className="stats__card" aria-label="Resumen del período">
              <p className="stats__lead">
                {left === undefined ? <>En este período entraron <strong>{formatAmount(sum(income))}</strong>.</>
                  : left > 0 ? <>Al club le quedaron <strong className="stats__good">{formatAmount(left)} a favor</strong>: entró más dinero del que se gastó.</>
                  : left < 0 ? <>Se gastaron <strong className="stats__bad">{formatAmount(-left)} más</strong> de lo que entró.</>
                  : <>Entró lo mismo que se gastó.</>}
              </p>
              <div className="stats__equation">
                <Tile label="Entró" tone="income" value={formatAmount(sum(income))} hint="Todo lo que se cobró" />
                {spent && left !== undefined ? (
                  <>
                    <span className="stats__operator" aria-hidden="true">−</span>
                    <Tile label="Salió" tone="expense" value={formatAmount(sum(spent))} hint="Todo lo que se gastó" />
                    <span className="stats__operator" aria-hidden="true">=</span>
                    <Tile label={left < 0 ? 'Faltó' : 'Quedó'} tone={left < 0 ? 'bad' : 'good'} value={formatAmount(Math.abs(left))} hint={left < 0 ? 'Se gastó más de lo que entró' : 'Lo que entró menos lo que salió'} />
                  </>
                ) : null}
              </div>
              {!spent ? <p className="stats__note">{EXPENSES_UNAVAILABLE}</p> : null}
              <ul className="stats__facts">
                {change !== undefined ? (
                  <li>
                    En {monthName(months[last])} {change === 0 ? 'entró lo mismo que' : <>entraron <strong className={change > 0 ? 'stats__good' : 'stats__bad'}>{formatAmount(Math.abs(change))} {change > 0 ? 'más' : 'menos'}</strong> que</>} en {monthName(months[last - 1])}.
                  </li>
                ) : null}
                {months.length > 2 && income[best] > 0 ? <li>El mes en que más dinero entró fue <strong>{monthName(months[best])}</strong>: {formatAmount(income[best])}.</li> : null}
                {annulled.count > 0 ? <li>Se {annulled.count === 1 ? 'anuló 1 recibo' : `anularon ${annulled.count} recibos`} por {formatAmount(annulled.total)}. No {annulled.count === 1 ? 'está contado' : 'están contados'} en estos números.</li> : null}
              </ul>
            </section>
            <section className="stats__card" aria-label="Mes por mes">
              <h3 className="stats__title">Mes por mes</h3>
              <p className="stats__note">Cada fila es un mes completo, del día 1 al último día. La barra muestra de un vistazo qué meses fueron más grandes.</p>
              <MonthRows
                label="Ingresos y gastos de cada mes"
                months={months}
                columns={[{ name: 'Entró', color: INCOME_COLOR, values: income }, ...(spent ? [{ name: 'Salió', color: EXPENSE_COLOR, values: spent }] : [])]}
                balance={balance}
              />
            </section>
          </>
        );
      }}
    </Async>
  );
}

/** Where the money of the period came from: by concept and by payment method. */
export function IncomeSlide({ revenue, retryRevenue }: Pick<RangeData, 'revenue' | 'retryRevenue'>) {
  const [selected, setSelected] = useState<string | undefined>();
  return (
    <Async state={revenue} what="los ingresos" retry={retryRevenue}>
      {(reports) => {
        const totals = aggregateRevenue(reports);
        if (totals.total === 0) return <p className="members-page__notice">No hubo cobros en el período elegido.</p>;
        const top = [...totals.byConcept].sort((a, b) => b.total - a.total)[0];
        return (
          <>
            <section className="stats__card" aria-label="Ingresos por concepto">
              <p className="stats__lead">
                Lo que más dinero trajo fue <strong>{conceptTotalLabel(top.concept)}</strong>: {formatAmount(top.total)}, el {wholeShare(top.total, totals.total)} de todo lo que entró.
              </p>
              <h3 className="stats__title">¿Por qué se cobró?</h3>
              <PieChart label="Ingresos por concepto" totalLabel="Entró en total" selectedKey={selected} onSelect={setSelected}
                items={totals.byConcept.map(({ concept, total }) => ({ key: concept, label: conceptTotalLabel(concept), value: total }))} />
            </section>
            <section className="stats__card" aria-label="Ingresos por medio de pago">
              <h3 className="stats__title">¿Cómo pagaron los socios?</h3>
              <ul className="stats__rows">
                {totals.byMethod.map(({ method, total }, index) => (
                  <li key={method} className="stats__row">
                    <div className="stats__row-head"><span className="stats__row-name"><i className="stats__swatch" style={{ background: pieColor(index) }} />{methodLabel(method)}</span><span>{formatAmount(total)} · {wholeShare(total, totals.total)}</span></div>
                    <div className="stats__track"><span className="stats__fill" style={{ width: `${barPercent(total, totals.byMethod[0].total)}%`, background: pieColor(index) }} /></div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        );
      }}
    </Async>
  );
}

/** What each discipline took in, by the day the money was taken: the share of each and its months. */
export function DisciplinesSlide({ income, retry }: { income: LoadState<DisciplineIncome>; retry: () => void }) {
  const [chosen, setChosen] = useState<string | undefined>();
  return (
    <Async state={income} what="los ingresos por disciplina" retry={retry}>
      {(data) => {
        if (data.disciplines.length === 0) return <p className="members-page__notice">No hubo cobros de disciplinas en el período elegido.</p>;
        const selected = data.disciplines[Math.max(0, data.disciplines.findIndex(({ id }) => id === chosen))];
        const first = data.disciplines[0];
        return (
          <>
            <section className="stats__card" aria-label="Ingresos por disciplina">
              <p className="stats__lead">
                <strong>{first.name}</strong> fue la disciplina que más recaudó: {formatAmount(first.total)}, el {wholeShare(first.total, data.total)} del total.
              </p>
              <PieChart
                label="Ranking de disciplinas"
                totalLabel="Recaudaron entre todas"
                selectedKey={selected.id}
                onSelect={setChosen}
                items={data.disciplines.map(({ id, name, total }) => ({ key: id, label: name, value: total }))}
              />
              <p className="stats__note">Tocá una disciplina de la lista para ver sus meses abajo. Se cuentan las cuotas de actividades y sus recargos el día en que se cobraron; los pagos anulados no se cuentan.</p>
            </section>
            <section className="stats__card" aria-label={`Detalle de ${selected.name}`}>
              <h3 className="stats__title">{selected.name}, mes por mes</h3>
              <p className="stats__note">Cuotas: {formatAmount(selected.fees)} · Recargos: {formatAmount(selected.surcharges)}</p>
              <MonthRows label={`Ingresos de ${selected.name} de cada mes`} months={data.months} columns={[{ name: 'Recaudó', color: INCOME_COLOR, values: selected.byMonth }]} />
            </section>
          </>
        );
      }}
    </Async>
  );
}

/** Where the money went in the period: by category and month by month. */
export function ExpensesSlide({ months, expenses, retryExpenses }: Pick<RangeData, 'months' | 'expenses' | 'retryExpenses'>) {
  const [selected, setSelected] = useState<string | undefined>();
  return (
    <Async state={expenses} what="los gastos" retry={retryExpenses}>
      {(all) => {
        const inRange = expensesInMonths(all, months);
        const byCategory = expensesByCategory(inRange);
        if (byCategory.length === 0) return <p className="members-page__notice">No se registraron gastos en el período elegido.</p>;
        const top = [...byCategory].sort((a, b) => b.total - a.total)[0];
        const total = sum(byCategory.map((item) => item.total));
        return (
          <>
            <section className="stats__card" aria-label="Gastos por categoría">
              <p className="stats__lead">
                En lo que más se gastó fue <strong>{CATEGORY_LABELS[top.category]}</strong>: {formatAmount(top.total)}, el {wholeShare(top.total, total)} de todos los gastos.
              </p>
              <h3 className="stats__title">¿En qué se gastó?</h3>
              <PieChart label="Gastos por categoría" totalLabel="Se gastó en total" selectedKey={selected} onSelect={setSelected}
                items={byCategory.map(({ category, total: amount }) => ({ key: category, label: CATEGORY_LABELS[category], value: amount }))} />
            </section>
            <section className="stats__card" aria-label="Gastos por mes">
              <h3 className="stats__title">Mes por mes</h3>
              <MonthRows label="Gastos de cada mes" months={months} columns={[{ name: 'Se gastó', color: EXPENSE_COLOR, values: expensesByMonth(inRange, months) }]} />
            </section>
          </>
        );
      }}
    </Async>
  );
}

const count = (value: number) => `${value} ${value === 1 ? 'socio' : 'socios'}`;

/** How the collection stands today: who is up to date, who owes, for how long and how much. It does not depend on the period. */
export function CollectionSlide({ collection, retry }: { collection: LoadState<{ rows: DebtNotice[]; active: number }>; retry: () => void }) {
  return (
    <Async state={collection} what="las deudas" retry={retry}>
      {({ rows, active }) => {
        const summary = collectionSummary(rows, active);
        const standing = [
          { key: 'upToDate', label: 'Están al día', value: summary.upToDate, color: UP_TO_DATE_COLOR },
          { key: 'debtors', label: 'Deben hasta 3 meses', value: summary.debtors, color: EXPENSE_COLOR },
          { key: 'deregistered', label: 'Deben más de 3 meses', value: summary.deregistered, color: LONG_DEBT_COLOR },
        ].filter((item) => item.value > 0);
        const worst = Math.max(1, ...summary.byMonths.map(({ count: members }) => members));
        if (summary.active === 0) return <p className="members-page__notice">No hay socios activos para mostrar.</p>;
        return (
          <>
            <section className="stats__card" aria-label="Estado de los socios activos">
              <p className="stats__lead">
                De <strong>{count(summary.active)}</strong> {summary.active === 1 ? 'activo' : 'activos'}, <strong className="stats__good">{summary.upToDate} {summary.upToDate === 1 ? 'está' : 'están'} al día</strong> y <strong className={rows.length > 0 ? 'stats__bad' : undefined}>{rows.length} {rows.length === 1 ? 'debe' : 'deben'}</strong>.
                {rows.length > 0 ? <> Entre todos deben <strong className="stats__bad">{formatAmount(summary.owed)}</strong>.</> : null}
              </p>
              <div className="stats__people" aria-hidden="true">
                {standing.map(({ key, value, color }) => <span key={key} style={{ flexGrow: value, background: color }}>{value}</span>)}
              </div>
              <ul className="stats__people-key" aria-label="Estado de los socios activos">
                {standing.map(({ key, label, value, color }) => (
                  <li key={key}><i className="stats__swatch" style={{ background: color }} />{label}: <strong>{count(value)}</strong> ({wholeShare(value, summary.active)})</li>
                ))}
              </ul>
              <p className="stats__note">Es la situación de hoy, con los recargos de hoy. No cambia con el período elegido arriba.</p>
            </section>
            {rows.length > 0 ? (
              <div className="stats__split">
                <section className="stats__card" aria-label="Antigüedad de la deuda">
                  <h3 className="stats__title">¿Cuántos meses deben?</h3>
                  <ul className="stats__rows">
                    {summary.byMonths.map(({ label, count: members }) => (
                      <li key={label} className="stats__row">
                        <div className="stats__row-head"><span>{label}</span><span>{count(members)}</span></div>
                        <div className="stats__track"><span className="stats__fill" style={{ width: `${barPercent(members, worst)}%`, background: EXPENSE_COLOR }} /></div>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="stats__card" aria-label="Mayores deudas">
                  <h3 className="stats__title">Los que más deben</h3>
                  <ul className="stats__rows">
                    {summary.top.map((row) => (
                      <li key={row.memberId} className="stats__row">
                        <div className="stats__row-head"><span>{row.name} <span className="stats__note">N° {row.memberNumber} · {row.unpaidPeriodCount} {row.unpaidPeriodCount === 1 ? 'mes' : 'meses'}</span></span><span>{formatAmount(row.total)}</span></div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : null}
          </>
        );
      }}
    </Async>
  );
}
