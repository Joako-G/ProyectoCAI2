import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { jsonResponse } from '../../members/test/fixtures';
import { sendWelcomeEmail } from './notices-api';

afterEach(() => vi.unstubAllGlobals());

describe('sendWelcomeEmail', () => {
  it('posts to the email route of the payment and encodes the id', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ sent: true, maskedAddress: 'a***@club.test', sentAt: '2026-11-10T14:05:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendWelcomeEmail('a/b')).toEqual({ sent: true, maskedAddress: 'a***@club.test', sentAt: '2026-11-10T14:05:00.000Z' });
    expect(fetchMock).toHaveBeenCalledWith('/api/notices/welcome/a%2Fb/email', { method: 'POST', signal: expect.any(AbortSignal) });
  });

  it('sends resend: true in the body only when asked', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ sent: true, maskedAddress: 'a***@club.test', sentAt: '2026-11-10T14:05:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);
    await sendWelcomeEmail('pay-1', { resend: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/notices/welcome/pay-1/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resend: true }),
      signal: expect.any(AbortSignal),
    });
  });

  it('rejects with the API error code when the mail server refused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'mail_send_failed', message: 'The email could not be sent' }, 502)));
    await expect(sendWelcomeEmail('pay-1')).rejects.toMatchObject({ status: 502, code: 'mail_send_failed' });
    await expect(sendWelcomeEmail('pay-1')).rejects.toBeInstanceOf(ApiError);
  });
});
