import { describe, expect, it } from 'vitest';
import { renderReceiptPdf, type ReceiptDocument } from '../../src/modules/payments/receipt.pdf.js';
import { formatReceiptNumber } from '../../src/modules/payments/receipt.format.js';
import { createReceiptPdfService } from '../../src/modules/payments/receipt.service.js';
import { NotFoundError } from '../../src/shared/errors.js';
import { ACTOR, MEMBER_ID, createTestContext, membership } from './payment.helpers.js';
import { pdfText } from './pdf-text.js';

const receipt: ReceiptDocument = {
  receiptNumber: 12,
  paymentDate: '2026-11-09',
  memberName: 'María Pérez',
  memberNumber: '0042',
  method: 'cash',
  lines: [
    { label: 'Inscripción', amount: 10_000 },
    { label: 'Cuota de Fútbol noviembre de 2026', amount: 35_000 },
  ],
  total: 45_000,
};

describe('formatReceiptNumber', () => {
  it('pads to four digits and keeps longer numbers whole', () => {
    expect(formatReceiptNumber(12)).toBe('0012');
    expect(formatReceiptNumber(12345)).toBe('12345');
  });
});

describe('renderReceiptPdf', () => {
  it('writes a PDF with the receipt data, the crest and no annulment mark', async () => {
    const pdf = await renderReceiptPdf(receipt, { compress: false });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = pdfText(pdf);
    for (const expected of ['Club Atlético Independiente', 'Comprobante N.º 0012', '09/11/2026', 'María Pérez', '0042', 'Efectivo', 'Inscripción', 'Cuota de Fútbol noviembre de 2026', '$ 10.000', '$ 35.000', 'Total', '$ 45.000']) {
      expect(text).toContain(expected);
    }
    expect(text).not.toContain('ANULADO');
    expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  });

  it('marks an annulled receipt with the reason', async () => {
    const text = pdfText(await renderReceiptPdf({ ...receipt, annulment: { reason: 'Cobro duplicado' } }, { compress: false }));
    expect(text).toContain('ANULADO');
    expect(text).toContain('Motivo: Cobro duplicado');
  });

  it('compresses by default and still produces a valid file', async () => {
    const pdf = await renderReceiptPdf(receipt);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-6).toString()).toContain('%%EOF');
  });
});

describe('createReceiptPdfService', () => {
  async function setup() {
    const context = await createTestContext({ memberships: [membership('basket', '2026-09-01')] });
    const service = createReceiptPdfService({
      payments: context.service,
      members: { getById: async () => ({ firstName: 'Lucía', lastName: 'Ríos', memberNumber: '0007' }) },
      disciplines: { findByIds: async (ids) => ids.map((id) => ({ id, name: 'Básquet' })) },
    });
    return { context, service };
  }

  it('renders the stored payment under its numbered filename', async () => {
    const { context, service } = await setup();
    try {
      const payment = await context.service.register(MEMBER_ID, { concepts: [{ kind: 'socialFee', period: '2026-10' }, { kind: 'activityFee', period: '2026-10', disciplineId: 'basket' }], method: 'qr' }, ACTOR);
      const pdf = await service.render(payment.id, { compress: false });
      expect(pdf.filename).toBe(`comprobante-${formatReceiptNumber(payment.receiptNumber)}.pdf`);
      const text = pdfText(pdf.content);
      expect(text).toContain('Lucía Ríos');
      expect(text).toContain('QR');
      expect(text).toContain('Cuota social octubre de 2026');
      expect(text).toContain('Cuota de Básquet octubre de 2026');
    } finally {
      await context.cleanup();
    }
  });

  it('renders an annulled payment with its mark and rejects an unknown one', async () => {
    const { context, service } = await setup();
    try {
      const payment = await context.service.register(MEMBER_ID, { concepts: [{ kind: 'socialFee', period: '2026-10' }], method: 'cash' }, ACTOR);
      await context.service.annul(payment.id, 'Error de carga', ACTOR);
      const text = pdfText((await service.render(payment.id, { compress: false })).content);
      expect(text).toContain('ANULADO');
      expect(text).toContain('Error de carga');
      await expect(service.render('missing')).rejects.toBeInstanceOf(NotFoundError);
    } finally {
      await context.cleanup();
    }
  });
});
