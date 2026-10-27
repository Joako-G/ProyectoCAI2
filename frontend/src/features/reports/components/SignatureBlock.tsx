const SIGNERS = ['Responsable de caja', 'Tesorería'];

/** Presentational: signature lines for the people who receive the printed report. Only shown on paper. */
export function SignatureBlock() {
  return (
    <section className="report-signatures" aria-label="Firmas">
      {SIGNERS.map((role) => (
        <div key={role} className="report-signature">
          <p className="report-signature__role">{role}</p>
          <p className="report-signature__line">Firma</p>
          <p className="report-signature__line">Aclaración</p>
          <p className="report-signature__line">Fecha</p>
        </div>
      ))}
    </section>
  );
}
