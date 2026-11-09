interface DeskStatProps {
  label: string;
  value: string;
  /** Highlights the figure that matters most on the screen. */
  primary?: boolean;
  testId?: string;
}

/** One figure with its caption, as a tile. */
export function DeskStat({ label, value, primary = false, testId }: DeskStatProps) {
  return (
    <p className={primary ? 'desk-stat desk-stat--primary' : 'desk-stat'}>
      <span className="desk-stat__label">{label}</span>
      <strong className="desk-stat__value" {...(testId ? { 'data-testid': testId } : {})}>{value}</strong>
    </p>
  );
}
