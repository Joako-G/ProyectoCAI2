import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { jsonResponse } from '../../members/test/fixtures';
import { buildAccount, buildCharge, buildPayment } from '../test/fixtures';
import { annulPayment, fetchAccount, fetchHistory, previewCharge, registerPayment } from './payments-api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const jsonInit = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('payments api', () => {
  it('reads the account of a member', async () => {
    const fetchMock = stubFetch(jsonResponse(buildAccount()));
    expect(await fetchAccount('member-1')).toEqual(buildAccount());
    expect(fetchMock).toHaveBeenCalledWith('/api/payments/members/member-1/account', { signal: undefined });
  });

  it('reads the payment history of a member and encodes the id', async () => {
    const fetchMock = stubFetch(jsonResponse([buildPayment()]));
    expect(await fetchHistory('a/b')).toEqual([buildPayment()]);
    expect(fetchMock).toHaveBeenCalledWith('/api/payments/members/a%2Fb', { signal: undefined });
  });

  it('previews a charge with POST', async () => {
    const request = { memberId: 'member-1', concepts: [{ kind: 'socialFee' as const, period: '2026-09' }] };
    const fetchMock = stubFetch(jsonResponse(buildCharge()));
    expect(await previewCharge(request)).toEqual(buildCharge());
    expect(fetchMock).toHaveBeenCalledWith('/api/payments/preview', jsonInit(request));
  });

  it('registers a payment with POST and returns the receipt', async () => {
    const request = { memberId: 'member-1', concepts: [{ kind: 'carnetReplacement' as const }], method: 'qr' as const };
    const fetchMock = stubFetch(jsonResponse(buildPayment(), 201));
    expect(await registerPayment(request)).toEqual(buildPayment());
    expect(fetchMock).toHaveBeenCalledWith('/api/payments', jsonInit(request));
  });

  it('annuls a payment with its reason', async () => {
    const fetchMock = stubFetch(jsonResponse(buildPayment()));
    await annulPayment('pay-1', 'Cobro duplicado');
    expect(fetchMock).toHaveBeenCalledWith('/api/payments/pay-1/annul', jsonInit({ reason: 'Cobro duplicado' }));
  });

  it('rejects with the shared ApiError when the server refuses', async () => {
    stubFetch(jsonResponse({ error: 'conflict', message: 'Already paid: socialFee:2026-09' }, 409));
    await expect(registerPayment({ memberId: 'member-1', concepts: [], method: 'cash' })).rejects.toMatchObject({
      status: 409,
      message: 'Already paid: socialFee:2026-09',
    });
    stubFetch(jsonResponse({ error: 'conflict', message: 'x' }, 409));
    await expect(fetchAccount('member-1')).rejects.toBeInstanceOf(ApiError);
  });
});
