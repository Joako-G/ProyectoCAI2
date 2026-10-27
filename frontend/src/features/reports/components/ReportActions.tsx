import { useState } from 'react';
import { downloadXlsx } from '../utils/download-xlsx';
import type { ReportExport } from '../utils/report-export';

/** Print (which also saves as PDF) and Excel download of the report on screen. Hidden when printing. */
export function ReportActions({ exported }: { exported: ReportExport }) {
  const [failed, setFailed] = useState(false);

  async function exportExcel() {
    setFailed(false);
    try {
      await downloadXlsx(exported);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="report-actions">
      <button type="button" className="button button--secondary" onClick={() => window.print()}>Imprimir o guardar como PDF</button>
      <button type="button" className="button button--secondary" onClick={() => void exportExcel()}>Descargar Excel</button>
      {failed ? <p className="form-field__error" role="alert">No se pudo generar el archivo de Excel. Intente de nuevo.</p> : null}
    </div>
  );
}
