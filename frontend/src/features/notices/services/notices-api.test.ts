import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { jsonResponse } from '../../members/test/fixtures';
import { sendWelcomeEmail } from './notices-api';

afterEach(() => vi.unstubAllGlobals());

describe('sendWelcomeEmail', () => {
  it('posts to the email route of the payment and encodes the id', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ sent: true, maskedAddress: 'a***@club.test' }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendWelcomeEmail('a/b')).toEqual({ sent: true, maskedAddress: 'a***@club.test' });
    expect(fetchMock).toHaveBeenCalledWith('/api/notices/welcome/a%2Fb/email', { method: 'POST' });
  });

  it('rejects with the API error code when the mail server refused', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'mail_send_failed', message: 'The email could not be sent' }, 502)));
    await expect(sendWelcomeEmail('pay-1')).rejects.toMatchObject({ status: 502, code: 'mail_send_failed' });
    await expect(sendWelcomeEmail('pay-1')).rejects.toBeInstanceOf(ApiError);
  });
});
