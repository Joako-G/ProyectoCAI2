import clubLogo from '../../../assets/club-cai.png';
import { formatDateTime } from '../utils/report-format';

/** Presentational: the club's letterhead and who issued the report and when. Only shown on paper. */
export function ReportLetterhead({ issuedBy, issuedAt }: { issuedBy?: string; issuedAt: Date }) {
  return (
    <header className="report-letterhead">
      <img className="report-letterhead__logo" src={clubLogo} alt="" />
      <div className="report-letterhead__identity">
        <p className="report-letterhead__club">Club CAI</p>
        <p className="report-letterhead__system">Gestión de socios</p>
      </div>
      <dl className="report-letterhead__issue">
        <div><dt>Emitido</dt><dd>{formatDateTime(issuedAt)}</dd></div>
        {issuedBy ? <div><dt>Emitido por</dt><dd>{issuedBy}</dd></div> : null}
      </dl>
    </header>
  );
}
