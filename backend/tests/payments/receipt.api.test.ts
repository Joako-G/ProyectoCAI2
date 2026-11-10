import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createReceiptPdfService } from '../../src/modules/payments/receipt.service.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';
import { ACTOR, MEMBER_ID, createTestContext, membership } from './payment.helpers.js';
import { pdfText } from './pdf-text.js';

let baseUrl: string;
let server: Server;
let paymentId: string;
let receiptNumber: number;
let annulledId: string;
const cleanups: Array<() => Promise<void>> = [];

beforeEach(async () => {
  const users = await createUsersFile();
  const context = await createTestContext({ memberships: [membership('basket', '2026-09-01')] });
  cleanups.push(users.cleanup, context.cleanup);
  const receiptPdfService = createReceiptPdfService({
    payments: context.service,
    members: { getById: async () => ({ firstName: 'Lucía', lastName: 'Ríos', memberNumber: '0007' }) },
    disciplines: { findByIds: async () => [{ id: 'basket', name: 'Básquet' }] },
  });
  const payment = await context.service.register(MEMBER_ID, { concepts: [{ kind: 'socialFee', period: '2026-10' }], method: 'cash' }, ACTOR);
  const other = await context.service.register(MEMBER_ID, { concepts: [{ kind: 'socialFee', period: '2026-09' }], method: 'cash' }, ACTOR);
  await context.service.annul(other.id, 'Error de carga', ACTOR);
  paymentId = payment.id;
  receiptNumber = payment.receiptNumber;
  annulledId = other.id;
  server = await listenOnFetchSafePort(createApp({ storePath: users.storePath, paymentService: context.service, receiptPdfService }));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  while (cleanups.length > 0) await cleanups.pop()!();
});

const get = async (path: string, role?: 'secretary' | 'head_secretary' | 'teacher') =>
  fetch(`${baseUrl}${path}`, { headers: role ? { cookie: await signIn(baseUrl, role) } : {} });

describe('GET /api/payments/:id/receipt.pdf', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await get(`/api/payments/${paymentId}/receipt.pdf`)).status).toBe(401);
    expect((await get(`/api/payments/${paymentId}/receipt.pdf`, 'teacher')).status).toBe(403);
  });

  it('downloads the receipt as an attachment named after its number', async () => {
    for (const role of ['secretary', 'head_secretary'] as const) {
      const response = await get(`/api/payments/${paymentId}/receipt.pdf`, role);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');
      expect(response.headers.get('content-disposition')).toBe(`attachment; filename="comprobante-${String(receiptNumber).padStart(4, '0')}.pdf"`);
      const body = Buffer.from(await response.arrayBuffer());
      expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('marks an annulled payment and answers 404 for an unknown one', async () => {
    const annulled = await get(`/api/payments/${annulledId}/receipt.pdf`, 'secretary');
    expect(annulled.status).toBe(200);
    // The default output is compressed; the content is checked in receipt.pdf.test.ts, here only that it is served.
    expect(pdfText(Buffer.from(await annulled.arrayBuffer()))).toContain('ANULADO');
    const missing = await get('/api/payments/missing/receipt.pdf', 'secretary');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ error: 'not_found' });
  });
});
