import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { RECEIPT_CREST_FILE } from '../../config/paths.js';
import { formatClubDate, formatPesos, formatReceiptNumber } from './receipt.format.js';
import type { PaymentMethod } from './payment.types.js';

export const CLUB_NAME = 'Club Atlético Independiente';

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  qr: 'QR',
  transfer: 'Transferencia',
};

/** Everything the PDF prints; the caller words the lines in Spanish. */
export interface ReceiptDocument {
  receiptNumber: number;
  /** Club-local date, `YYYY-MM-DD`. */
  paymentDate: string;
  memberName: string;
  memberNumber: string;
  method: PaymentMethod;
  lines: ReadonlyArray<{ label: string; amount: number }>;
  total: number;
  annulment?: { reason: string };
}

export interface RenderOptions {
  /** Test hook: set to false to leave the page streams uncompressed so the text can be read back. */
  compress?: boolean;
}

const MARGIN = 56;
const INK = '#1a1a1a';
const MUTED = '#5f6368';
const RULE = '#c9ccd1';
const ALERT = '#b3261e';

let crest: Buffer | undefined;
/** The crest bytes, or undefined when the asset is missing. */
export function loadCrest(): Buffer | undefined {
  try {
    crest ??= readFileSync(RECEIPT_CREST_FILE);
    return crest;
  } catch {
    // A missing asset must not stop a receipt from being produced.
    return undefined;
  }
}

/** Renders one receipt as a single-page A4 PDF. Pure apart from reading the crest asset. */
export function renderReceiptPdf(receipt: ReceiptDocument, { compress = true }: RenderOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const number = formatReceiptNumber(receipt.receiptNumber);
    const document = new PDFDocument({
      size: 'A4',
      margin: MARGIN,
      compress,
      info: { Title: `Comprobante N.º ${number}`, Author: CLUB_NAME },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    const left = MARGIN;
    const right = document.page.width - MARGIN;
    const width = right - left;

    // Header: crest, club name and the kind of document.
    const image = loadCrest();
    if (image) document.image(image, left, MARGIN, { fit: [64, 64] });
    const textLeft = image ? left + 80 : left;
    document.fillColor(INK).font('Helvetica-Bold').fontSize(18).text(CLUB_NAME, textLeft, MARGIN + 8, { width: right - textLeft });
    document.fillColor(MUTED).font('Helvetica').fontSize(11).text('Comprobante de pago', textLeft, document.y + 2);

    let y = MARGIN + 84;
    document.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor(RULE).stroke();
    y += 18;

    document.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(`Comprobante N.º ${number}`, left, y, { width });
    y = document.y + 10;

    if (receipt.annulment) {
      document.fillColor(ALERT).font('Helvetica-Bold').fontSize(22).text('ANULADO', left, y, { width });
      document.font('Helvetica').fontSize(11).text(`Motivo: ${receipt.annulment.reason}`, left, document.y + 2, { width });
      y = document.y + 12;
    }

    // Meta block: a label column and a value column.
    const meta: Array<[string, string]> = [
      ['Fecha', formatClubDate(receipt.paymentDate)],
      ['Socio', `${receipt.memberName} · N.º ${receipt.memberNumber}`],
      ['Medio de pago', METHOD_LABEL[receipt.method] ?? receipt.method],
    ];
    for (const [label, value] of meta) {
      document.fillColor(MUTED).font('Helvetica').fontSize(10).text(label, left, y, { width: 110 });
      document.fillColor(INK).font('Helvetica').fontSize(11).text(value, left + 120, y, { width: width - 120 });
      y = Math.max(y + 16, document.y + 4);
    }
    y += 10;

    // Lines table.
    const amountWidth = 110;
    document.fillColor(MUTED).font('Helvetica-Bold').fontSize(10).text('Concepto', left, y, { width: width - amountWidth });
    document.text('Importe', right - amountWidth, y, { width: amountWidth, align: 'right' });
    y = document.y + 4;
    document.moveTo(left, y).lineTo(right, y).lineWidth(0.75).strokeColor(RULE).stroke();
    y += 8;
    for (const line of receipt.lines) {
      document.fillColor(INK).font('Helvetica').fontSize(11).text(line.label, left, y, { width: width - amountWidth - 12 });
      const bottom = document.y;
      document.text(formatPesos(line.amount), right - amountWidth, y, { width: amountWidth, align: 'right' });
      y = Math.max(bottom, document.y) + 6;
    }
    document.moveTo(left, y).lineTo(right, y).lineWidth(0.75).strokeColor(RULE).stroke();
    y += 10;
    document.fillColor(INK).font('Helvetica-Bold').fontSize(13).text('Total', left, y, { width: width - amountWidth });
    document.text(formatPesos(receipt.total), right - amountWidth, y, { width: amountWidth, align: 'right' });

    document.end();
  });
}
