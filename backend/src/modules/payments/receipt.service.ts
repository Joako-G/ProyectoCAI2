import { describeReceiptLine } from '../notices/notice.message.js';
import type { Payment } from './payment.types.js';
import { formatReceiptNumber } from './receipt.format.js';
import { renderReceiptPdf, type RenderOptions } from './receipt.pdf.js';

/** Ports owned by the receipt PDF; the payments, members and disciplines services satisfy them as they are. */
export interface ReceiptPdfDeps {
  payments: { getReceipt(paymentId: string): Promise<Payment> };
  members: { getById(id: string): Promise<{ firstName: string; lastName: string; memberNumber: string }> };
  disciplines: { findByIds(ids: readonly string[]): Promise<Array<{ id: string; name: string }>> };
}

export interface ReceiptPdf {
  /** For example `comprobante-0012.pdf`. */
  filename: string;
  content: Buffer;
  receiptNumber: number;
}

/** Renders the PDF of a payment; an annulled payment is rendered with its ANULADO mark. */
export function createReceiptPdfService({ payments, members, disciplines }: ReceiptPdfDeps) {
  return {
    async render(paymentId: string, options: RenderOptions = {}): Promise<ReceiptPdf> {
      const payment = await payments.getReceipt(paymentId);
      const member = await members.getById(payment.memberId);
      const ids = payment.lines.flatMap((line) => (line.disciplineId ? [line.disciplineId] : []));
      const names = new Map((await disciplines.findByIds(ids)).map((discipline) => [discipline.id, discipline.name]));
      const content = await renderReceiptPdf(
        {
          receiptNumber: payment.receiptNumber,
          paymentDate: payment.paymentDate,
          memberName: `${member.firstName} ${member.lastName}`,
          memberNumber: member.memberNumber,
          method: payment.method,
          lines: payment.lines.map((line) => ({
            label: describeReceiptLine(line, (id) => names.get(id) ?? 'actividad'),
            amount: line.amount,
          })),
          total: payment.total,
          ...(payment.annulment ? { annulment: { reason: payment.annulment.reason } } : {}),
        },
        options,
      );
      return { filename: `comprobante-${formatReceiptNumber(payment.receiptNumber)}.pdf`, content, receiptNumber: payment.receiptNumber };
    },
  };
}

export type ReceiptPdfService = ReturnType<typeof createReceiptPdfService>;
