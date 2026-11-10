import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import type { DebtNotice, WelcomeNotice } from '../../src/modules/notices/notice.types.js';
import { MailAlreadySentError, MailNotConfiguredError, MailSendError, MailSendInProgressError, MailSendUncertainError } from '../../src/modules/notices/notice.errors.js';
import { ConflictError, NotFoundError } from '../../src/shared/errors.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';

let server: Server;
let baseUrl: string;
let cleanup: () => Promise<void>;
const resendFlags: boolean[] = [];
const rows: DebtNotice[] = [
  {
    memberId: 'm1',
    memberNumber: '1',
    name: 'A B',
    standing: 'debtor',
    unpaidPeriodCount: 1,
    total: 40000,
    recipient: 'member',
    recipientName: 'A B',
    recipientContact: '12345',
    link: null,
    numberIssue: true,
  },
];

const welcome: WelcomeNotice = { memberId: 'm1', recipient: 'member', recipientName: 'A B', link: 'https://wa.me/5493815550101?text=hola', numberIssue: false, email: { available: true, maskedAddress: 'a***@club.test' } };

beforeAll(async () => {
  const users = await createUsersFile();
  cleanup = users.cleanup;
  server = await listenOnFetchSafePort(createApp({
    storePath: users.storePath,
    noticeService: {
      debtNotices: async () => ({ asOf: '2026-11-01', rows }),
      welcomeNotice: async (paymentId: string) => {
        if (paymentId === 'missing') throw new NotFoundError('Payment not found');
        return welcome;
      },
      sendWelcomeEmail: async (paymentId: string, options?: { resend?: boolean }) => {
        resendFlags.push(options?.resend === true);
        if (paymentId === 'missing') throw new NotFoundError('Payment not found');
        if (paymentId === 'annulled') throw new ConflictError('Payment is annulled');
        if (paymentId === 'unconfigured') throw new MailNotConfiguredError();
        if (paymentId === 'broken') throw new MailSendError();
        if (paymentId === 'busy') throw new MailSendInProgressError();
        if (paymentId === 'done' && !options?.resend) throw new MailAlreadySentError({ status: 'sent', at: '2026-11-10T14:05:00.000Z', to: 'a***@club.test' });
        if (paymentId === 'unsure') throw new MailSendUncertainError();
        return { sent: true as const, maskedAddress: 'a***@club.test', sentAt: '2026-11-10T14:05:00.000Z' };
      },
    },
  }));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanup();
});

describe('GET /api/notices/debt', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await fetch(`${baseUrl}/api/notices/debt`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/notices/debt`, { headers: { cookie: await signIn(baseUrl, 'teacher') } })).status).toBe(403);
  });

  it('returns the service result to the secretary and the head secretary', async () => {
    for (const role of ['secretary', 'head_secretary'] as const) {
      const response = await fetch(`${baseUrl}/api/notices/debt`, { headers: { cookie: await signIn(baseUrl, role) } });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ asOf: '2026-11-01', rows });
    }
  });
});

describe('GET /api/notices/welcome/:paymentId', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await fetch(`${baseUrl}/api/notices/welcome/pay-1`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/notices/welcome/pay-1`, { headers: { cookie: await signIn(baseUrl, 'teacher') } })).status).toBe(403);
  });

  it('returns the prepared welcome to the secretary and 404 for an unknown payment', async () => {
    const cookie = await signIn(baseUrl, 'secretary');
    const found = await fetch(`${baseUrl}/api/notices/welcome/pay-1`, { headers: { cookie } });
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual(welcome);
    expect((await fetch(`${baseUrl}/api/notices/welcome/missing`, { headers: { cookie } })).status).toBe(404);
  });
});

describe('POST /api/notices/welcome/:paymentId/email', () => {
  const send = async (paymentId: string, role?: 'secretary' | 'head_secretary' | 'teacher', body?: unknown) =>
    fetch(`${baseUrl}/api/notices/welcome/${paymentId}/email`, {
      method: 'POST',
      headers: { ...(role ? { cookie: await signIn(baseUrl, role) } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await send('pay-1')).status).toBe(401);
    expect((await send('pay-1', 'teacher')).status).toBe(403);
  });

  it('answers the masked address once the email was accepted', async () => {
    for (const role of ['secretary', 'head_secretary'] as const) {
      const response = await send('pay-1', role);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ sent: true, maskedAddress: 'a***@club.test', sentAt: '2026-11-10T14:05:00.000Z' });
    }
  });

  it('maps the refusals: 404 unknown, 409 annulled, 503 not configured, 502 send failure', async () => {
    expect((await send('missing', 'secretary')).status).toBe(404);
    expect((await send('annulled', 'secretary')).status).toBe(409);
    const unconfigured = await send('unconfigured', 'secretary');
    expect(unconfigured.status).toBe(503);
    expect(await unconfigured.json()).toEqual({ error: 'mail_not_configured', message: 'Email sending is not configured' });
    const broken = await send('broken', 'secretary');
    expect(broken.status).toBe(502);
    expect(await broken.json()).toEqual({ error: 'mail_send_failed', message: 'The email could not be sent' });
  });

  it('answers 409 while a send is running, 409 with the last send once sent, and 504 when the outcome is unknown', async () => {
    const busy = await send('busy', 'secretary');
    expect(busy.status).toBe(409);
    expect(await busy.json()).toMatchObject({ error: 'mail_send_in_progress' });
    const done = await send('done', 'secretary');
    expect(done.status).toBe(409);
    expect(await done.json()).toMatchObject({ error: 'mail_already_sent', lastSend: { status: 'sent', at: '2026-11-10T14:05:00.000Z', to: 'a***@club.test' } });
    const unsure = await send('unsure', 'secretary');
    expect(unsure.status).toBe(504);
    expect(await unsure.json()).toEqual({ error: 'mail_send_uncertain', message: 'The email may or may not have been sent' });
  });

  it('passes resend only when the body says exactly true', async () => {
    resendFlags.length = 0;
    expect((await send('done', 'secretary', { resend: true })).status).toBe(200);
    expect((await send('done', 'secretary', { resend: 'true' })).status).toBe(409);
    expect((await send('done', 'secretary')).status).toBe(409);
    expect(resendFlags).toEqual([true, false, false]);
  });
});
