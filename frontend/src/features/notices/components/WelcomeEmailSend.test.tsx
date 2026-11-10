import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import type { EmailLastSend } from '../types/notice';
import { formatSentAt } from '../utils/notice-format';
import { WelcomeEmailSend } from './WelcomeEmailSend';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ADDRESS = 'l***@gmail.com';
const AT = '2026-11-10T14:05:00.000Z';
const SEND_KEY = 'POST /api/notices/welcome/pay-1/email';

function stub(handler: (init?: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => handler(init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function show(lastSend?: EmailLastSend) {
  render(<WelcomeEmailSend paymentId="pay-1" maskedAddress={ADDRESS} lastSend={lastSend} />);
  return userEvent.setup({ delay: null });
}

const bodyOf = (init?: RequestInit) => (init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined);

describe('WelcomeEmailSend remounted after a send', () => {
  it('shows when and where it was sent instead of the send button', () => {
    show({ status: 'sent', at: AT, to: ADDRESS });
    expect(screen.getByRole('status')).toHaveTextContent(`Enviado el ${formatSentAt(AT)} a ${ADDRESS}.`);
    expect(screen.queryByRole('button', { name: /Enviar por email/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeInTheDocument();
  });

  it('asks for confirmation before resending with resend: true, and can be cancelled', async () => {
    const fetchMock = stub(() => jsonResponse({ sent: true, maskedAddress: ADDRESS, sentAt: '2026-11-10T15:00:00.000Z' }));
    const user = show({ status: 'sent', at: AT, to: ADDRESS });

    await user.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(screen.getByText(/puede recibir el comprobante dos veces/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Reenviar' }));
    await user.click(screen.getByRole('button', { name: 'Sí, reenviar' }));
    expect(await screen.findByRole('status')).toHaveTextContent(`Enviado el ${formatSentAt('2026-11-10T15:00:00.000Z')} a ${ADDRESS}.`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/notices/welcome/pay-1/email');
    expect(bodyOf(fetchMock.mock.calls[0]![1])).toEqual({ resend: true });
  });

  it('shows an uncertain outcome with the same confirmation to resend', async () => {
    const fetchMock = stub(() => jsonResponse({ sent: true, maskedAddress: ADDRESS, sentAt: AT }));
    const user = show({ status: 'uncertain', at: AT, to: ADDRESS });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo confirmar el envío. Puede que el email ya haya llegado.');
    expect(screen.queryByRole('button', { name: /Enviar por email/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reenviar' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Sí, reenviar' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Enviado el');
    expect(bodyOf(fetchMock.mock.calls[0]![1])).toEqual({ resend: true });
  });

  it('tells that a send is running and offers no resend', () => {
    show({ status: 'sending', at: AT, to: ADDRESS });
    expect(screen.getByRole('status')).toHaveTextContent('se está enviando');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('WelcomeEmailSend first send', () => {
  it('sends without a body and shows when it was sent', async () => {
    const fetchMock = stub(() => jsonResponse({ sent: true, maskedAddress: ADDRESS, sentAt: AT }));
    const user = show();
    await user.click(screen.getByRole('button', { name: `Enviar por email a ${ADDRESS}` }));
    expect(await screen.findByRole('status')).toHaveTextContent(`Enviado el ${formatSentAt(AT)} a ${ADDRESS}.`);
    expect(fetchMock.mock.calls[0]![1]?.body).toBeUndefined();
  });

  it('answers 409 mail_send_in_progress with the running message', async () => {
    stub(() => jsonResponse({ error: 'mail_send_in_progress', message: 'x' }, 409));
    const user = show();
    await user.click(screen.getByRole('button', { name: `Enviar por email a ${ADDRESS}` }));
    expect(await screen.findByRole('status')).toHaveTextContent('se está enviando');
  });

  it('answers 409 mail_already_sent with the sent state and a Reenviar button', async () => {
    stub(() => jsonResponse({ error: 'mail_already_sent', message: 'x', lastSend: { status: 'sent', at: AT, to: ADDRESS } }, 409));
    const user = show();
    await user.click(screen.getByRole('button', { name: `Enviar por email a ${ADDRESS}` }));
    expect(await screen.findByRole('status')).toHaveTextContent(`ya fue enviado por email a ${ADDRESS}`);
    expect(screen.getByRole('button', { name: 'Reenviar' })).toBeInTheDocument();
  });

  it('shows the uncertain state, not "already sent", when the earlier send was uncertain', async () => {
    stub((init) =>
      init?.method === 'POST'
        ? jsonResponse({ error: 'mail_already_sent', message: 'x', lastSend: { status: 'uncertain', at: AT, to: ADDRESS } }, 409)
        : jsonResponse({ memberId: 'm1', recipient: 'member', recipientName: 'A B', link: null, numberIssue: false, email: { available: true, maskedAddress: ADDRESS, lastSend: { status: 'uncertain', at: AT, to: ADDRESS } } }),
    );
    const user = show();
    await user.click(screen.getByRole('button', { name: `Enviar por email a ${ADDRESS}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar el envío. Puede que el email ya haya llegado.');
    expect(screen.queryByText(/ya fue enviado/)).not.toBeInTheDocument();
  });

  it('shows the uncertain message when the server could not confirm the send (504)', async () => {
    stub(() => jsonResponse({ error: 'mail_send_uncertain', message: 'x' }, 504));
    const user = show();
    await user.click(screen.getByRole('button', { name: `Enviar por email a ${ADDRESS}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar el envío. Puede que el email ya haya llegado.');
  });

  it('keeps a plain failure retryable', async () => {
    stub(() => jsonResponse({ error: 'mail_send_failed', message: 'x' }, 502));
    const user = show();
    await user.click(screen.getByRole('button', { name: `Enviar por email a ${ADDRESS}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo enviar el email.');
    expect(screen.getByRole('button', { name: 'Reintentar envío por email' })).toBeEnabled();
  });

  it('aborts the request after 20 s and treats it as uncertain', async () => {
    vi.useFakeTimers();
    const fetchMock = stub(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
        }),
    );
    show();
    fireEvent.click(screen.getByRole('button', { name: `Enviar por email a ${ADDRESS}` }));
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(19_000);
    });
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo confirmar el envío. Puede que el email ya haya llegado.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(SEND_KEY.replace('POST ', ''));
  });
});
