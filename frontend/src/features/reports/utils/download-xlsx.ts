import type { ReportExport } from './report-export';

/** Builds the workbook in the browser and offers it as a download. The library loads only when someone exports. */
export async function downloadXlsx({ fileName, sheets }: ReportExport): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(sheets).toFile(fileName);
}
