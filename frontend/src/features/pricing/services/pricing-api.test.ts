import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../members/services/members-api';
import { jsonResponse } from '../../members/test/fixtures';
import { buildPricingConfig, buildTariff } from '../test/fixtures';
import {
  addTariff,
  deleteTariff,
  fetchPricing,
  replaceProrationRule,
  replaceSurchargeTiers,
  replaceTariff,
} from './pricing-api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetchMock = vi.fn(async () => response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const jsonInit = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('pricing api', () => {
  it('reads the whole configuration', async () => {
    const fetchMock = stubFetch(jsonResponse(buildPricingConfig()));
    expect(await fetchPricing()).toEqual(buildPricingConfig());
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing', { signal: undefined });
  });

  it('creates a tariff with POST', async () => {
    const tariff = buildTariff({ effectiveFrom: '2026-12' });
    const fetchMock = stubFetch(jsonResponse(tariff, 201));
    expect(await addTariff(tariff)).toEqual(tariff);
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/tariffs', jsonInit('POST', tariff));
  });

  it('replaces a tariff addressed by its effectiveFrom', async () => {
    const tariff = buildTariff({ effectiveFrom: '2026-12' });
    const fetchMock = stubFetch(jsonResponse(tariff));
    await replaceTariff(tariff);
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/tariffs/2026-12', jsonInit('PUT', tariff));
  });

  it('deletes a tariff and accepts the empty 204 response', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    await expect(deleteTariff('2026-12')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/tariffs/2026-12', { method: 'DELETE' });
  });

  it('replaces the surcharge tiers and the proration rule with PUT', async () => {
    const tiers = [{ fromDay: 1, amount: 0 }];
    const rule = { afterDay: 10, activityPercent: 40 };
    const fetchMock = stubFetch(jsonResponse(tiers));
    await replaceSurchargeTiers(tiers);
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/surcharge-tiers', jsonInit('PUT', tiers));
    fetchMock.mockResolvedValueOnce(jsonResponse(rule));
    await replaceProrationRule(rule);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/pricing/proration-rule', jsonInit('PUT', rule));
  });

  it('maps the backend error contract to an ApiError with status, code and field errors', async () => {
    stubFetch(jsonResponse({ error: 'validation_error', message: 'Invalid', fieldErrors: { socialFee: 'Must be a non-negative whole number of pesos' } }, 400));
    const error = await addTariff(buildTariff()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'validation_error', fieldErrors: { socialFee: expect.any(String) } });
  });
});
