import { useState } from 'react';
import { fetchExpenses } from '../../expenses/services/expenses-api';
import { fetchMembers } from '../../members/services/members-api';
import { fetchDebtNotices } from '../../notices/services/notices-api';
import { useLoad } from '../hooks/useLoad';
import { fetchDisciplineIncome, fetchRevenue } from '../services/reports-api';
import type { DisciplineIncome } from '../types/report';
import { todayDate } from '../utils/report-format';
import { monthsInRange, periodLabel, presetRange, rangeProblem, RANGE_PRESETS, type RangePreset } from '../utils/stats';
import { StatsCarousel } from './StatsCarousel';
import { CollectionSlide, DisciplinesSlide, ExpensesSlide, IncomeSlide, SummarySlide } from './StatsSlides';

const NO_INCOME: DisciplineIncome = { from: '', to: '', months: [], total: 0, disciplines: [] };

/**
 * The club's finances, one slide at a time under a single period: summary, income, disciplines, expenses and
 * collection. Read-only; nothing here is printed. Each source loads once per period and every slide shares it.
 */
export function StatsView({ today = todayDate() }: { today?: string }) {
  const [range, setRange] = useState(() => presetRange('half', today));
  const [preset, setPreset] = useState<RangePreset | undefined>('half');
  const problem = rangeProblem(range.from, range.to);
  const months = problem ? [] : monthsInRange(range.from, range.to);
  const key = `${range.from}|${range.to}`;

  // One monthly report per month of the period; the server only answers a day, a week or a month at a time.
  const revenue = useLoad((signal) => (problem ? Promise.resolve([]) : Promise.all(months.map((month) => fetchRevenue('monthly', `${month}-01`, signal)))), key);
  const disciplines = useLoad((signal) => (problem ? Promise.resolve(NO_INCOME) : fetchDisciplineIncome(range.from, range.to, signal)), key);
  // Expenses and collection do not depend on the period; a role without access to them still gets the rest.
  const expenses = useLoad((signal) => fetchExpenses(signal), 'expenses');
  const collection = useLoad(
    async (signal) => {
      const [debts, active] = await Promise.all([fetchDebtNotices(signal), fetchMembers({ search: '', status: 'active', disciplineId: '' }, signal)]);
      return { rows: debts.rows, active: active.length };
    },
    'collection',
  );

  function choosePreset(value: RangePreset) {
    setPreset(value);
    setRange(presetRange(value, today));
  }

  function changeRange(next: { from: string; to: string }) {
    setPreset(undefined);
    setRange(next);
  }

  const shared = { months, revenue: revenue.state, expenses: expenses.state, retryRevenue: revenue.retry, retryExpenses: expenses.retry };

  return (
    <div className="stats">
      <section className="stats__card stats__period" aria-label="Período">
        <h2 className="stats__title">¿Qué período querés ver?</h2>
        <div className="stats__presets" role="group" aria-label="Períodos rápidos">
          {RANGE_PRESETS.map(({ value, label }) => (
            <button key={value} type="button" className="stats__preset" aria-pressed={preset === value} onClick={() => choosePreset(value)}>{label}</button>
          ))}
        </div>
        <div className="stats__filters">
          <div className="form-field">
            <label htmlFor="stats-from" className="form-field__label">Desde</label>
            <input id="stats-from" type="month" value={range.from} onChange={(event) => changeRange({ ...range, from: event.target.value })} />
          </div>
          <div className="form-field">
            <label htmlFor="stats-to" className="form-field__label">Hasta</label>
            <input id="stats-to" type="month" value={range.to} onChange={(event) => changeRange({ ...range, to: event.target.value })} />
          </div>
        </div>
        {problem ? null : <p className="stats__showing" role="status">Estás viendo: <strong>{periodLabel(range.from, range.to)}</strong> ({months.length === 1 ? '1 mes' : `${months.length} meses`}).</p>}
      </section>

      {problem ? <p className="form-field__error" role="alert">{problem}</p> : (
        <StatsCarousel
          label="Estadísticas financieras"
          slides={[
            { id: 'summary', label: 'Resumen', title: '¿Cómo le fue al club?', content: <SummarySlide {...shared} /> },
            { id: 'income', label: 'Ingresos', title: '¿De dónde entró el dinero?', content: <IncomeSlide revenue={revenue.state} retryRevenue={revenue.retry} /> },
            { id: 'disciplines', label: 'Disciplinas', title: '¿Qué disciplina recaudó más?', content: <DisciplinesSlide income={disciplines.state} retry={disciplines.retry} /> },
            { id: 'expenses', label: 'Gastos', title: '¿En qué se gastó?', content: <ExpensesSlide months={months} expenses={expenses.state} retryExpenses={expenses.retry} /> },
            { id: 'collection', label: 'Deudas', title: '¿Quiénes deben?', content: <CollectionSlide collection={collection.state} retry={collection.retry} /> },
          ]}
        />
      )}
    </div>
  );
}
