import { formatAmount } from '../utils/report-format';
import { pieColor, pieSlices, wholeShare } from '../utils/stats';

export interface PieItem {
  key: string;
  label: string;
  value: number;
}

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface PieChartProps {
  items: PieItem[];
  /** Names the chart and its legend for assistive technology. */
  label: string;
  /** Caption of the total shown next to the legend. */
  totalLabel?: string;
  /** The slice shown in the center; the first one when absent or gone. */
  selectedKey?: string;
  onSelect?: (key: string) => void;
  /** How a value reads; pesos by default. */
  formatValue?: (value: number) => string;
}

/**
 * A ring chart with its legend: each slice is a colored share of the total, the center spells out the chosen one and
 * the legend lists every slice with its amount and share. Slices and legend rows select the same thing.
 */
export function PieChart({ items, label, totalLabel = 'Total', selectedKey, onSelect, formatValue = formatAmount }: PieChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const slices = pieSlices(items.map((item) => item.value), CIRCUMFERENCE);
  const selectedIndex = Math.max(0, items.findIndex((item) => item.key === selectedKey));
  const selected = items[selectedIndex];

  return (
    <div className="stats__pie-layout">
      <div className="stats__pie" role="group" aria-label={`Gráfico de torta: ${label}`}>
        <svg viewBox="0 0 200 200" className="stats__pie-svg" aria-hidden="true">
          <g transform="rotate(-90 100 100)">
            {items.map((item, index) => (
              <circle
                key={item.key}
                className="stats__slice"
                data-selected={index === selectedIndex}
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke={pieColor(index)}
                strokeWidth={index === selectedIndex ? 34 : 26}
                strokeDasharray={`${slices[index].length} ${CIRCUMFERENCE}`}
                strokeDashoffset={-slices[index].start}
                onClick={() => onSelect?.(item.key)}
              >
                <title>{`${item.label}: ${formatValue(item.value)} (${wholeShare(item.value, total)})`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div className="stats__pie-center">
          <span className="stats__kpi-label">{selected.label}</span>
          <strong className="stats__pie-amount">{formatValue(selected.value)}</strong>
          <span className="stats__pie-share">{wholeShare(selected.value, total)} del total</span>
        </div>
      </div>

      <div className="stats__legend-list">
        <p className="stats__discipline-total">
          <span className="stats__kpi-label">{totalLabel}</span>
          <strong className="stats__kpi-value">{formatValue(total)}</strong>
        </p>
        <ul className="stats__rows" aria-label={label}>
          {items.map((item, index) => (
            <li key={item.key} className="stats__row">
              <button type="button" className="stats__row-button" aria-pressed={index === selectedIndex} onClick={() => onSelect?.(item.key)}>
                <span className="stats__row-head">
                  <span className="stats__row-name"><i className="stats__swatch" style={{ background: pieColor(index) }} />{item.label}</span>
                  <span>{formatValue(item.value)} · {wholeShare(item.value, total)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
