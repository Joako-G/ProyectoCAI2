/**
 * Presentational: lays a report out as a repeating page header over its body. On paper the header row of
 * this table repeats on every page, which is how the letterhead reaches each sheet. On screen it is plain
 * blocks (see report-print.css), and it is hidden from assistive technology as it only lays things out.
 */
export function ReportFrame({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <table className="report-frame" role="presentation">
      <thead><tr><td>{header}</td></tr></thead>
      <tbody><tr><td><div className="report-result">{children}</div></td></tr></tbody>
    </table>
  );
}
