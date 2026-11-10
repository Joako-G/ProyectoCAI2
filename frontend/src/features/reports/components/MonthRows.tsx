import { formatAmount } from '../utils/report-format';
import { barPercent, monthName } from '../utils/stats';

export interface MonthColumn {
  /** Heading of the column, such as `Entró`. */
  name: string;
  color: string;
  /** One amount per month. */
  values: number[];
}

interface MonthRowsProps {
  /** `YYYY-MM`, oldest first. */
  months: string[];
  columns: MonthColumn[];
  /** What was left each month (income minus expenses); adds the last column when present. */
  balance?: number[];
  /** Names the table for assistive technology. */
  label: string;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What was left, in words: an amount "a favor" or "en contra", never a negative number. */
function Balance({ value }: { value: number }) {
  if (value === 0) return <>{formatAmount(0)}</>;
  return <>{formatAmount(Math.abs(value))} <small>{value > 0 ? 'a favor' : 'en contra'}</small></>;
}

/**
 * The months of a period as the rows of a ledger: each month spelled out, each amount written in full with a bar
 * next to it that shows at a glance which months were bigger. Nothing has to be read off an axis.
 */
export function MonthRows({ months, columns, balance, label }: MonthRowsProps) {
  const max = Math.max(1, ...columns.flatMap(({ values }) => values));

  return (
    <table className="month-rows" aria-label={label}>
      <thead>
        <tr>
          <th scope="col">Mes</th>
          {columns.map(({ name }) => <th key={name} scope="col">{name}</th>)}
          {balance ? <th scope="col">Quedó</th> : null}
        </tr>
      </thead>
      <tbody>
        {months.map((month, index) => (
          <tr key={month}>
            <th scope="row">{capitalize(monthName(month))}</th>
            {columns.map(({ name, color, values }) => (
              <td key={name} data-label={name}>
                <span className="month-rows__amount">{formatAmount(values[index])}</span>
                <span className="month-rows__track" aria-hidden="true"><span className="month-rows__fill" style={{ width: `${barPercent(values[index], max)}%`, background: color }} /></span>
              </td>
            ))}
            {balance ? <td data-label="Quedó" className="month-rows__balance" data-tone={balance[index] < 0 ? 'bad' : 'good'}><Balance value={balance[index]} /></td> : null}
          </tr>
        ))}
      </tbody>
      {months.length > 1 ? (
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {columns.map(({ name, values }) => <td key={name} data-label={name}><span className="month-rows__amount">{formatAmount(sum(values))}</span></td>)}
            {balance ? <td data-label="Quedó" className="month-rows__balance" data-tone={sum(balance) < 0 ? 'bad' : 'good'}><Balance value={sum(balance)} /></td> : null}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
