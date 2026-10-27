import { formatDateTime } from './report-format';

/** Hands the print stylesheet the moment of printing, which the page footer shows (`--print-stamp`). */
export function setPrintStamp(now: Date = new Date()): void {
  document.documentElement.style.setProperty('--print-stamp', `"Impreso el ${formatDateTime(now)}"`);
}
