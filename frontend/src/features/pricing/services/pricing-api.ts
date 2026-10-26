import { ApiError, request, sendJson } from '../../members/services/members-api';
import type { PricingConfig, ProrationRule, SurchargeTier, Tariff } from '../types/pricing';

// The HTTP plumbing and error contract are shared with the members client.
export { ApiError };

const BASE = '/api/pricing';

const tariffUrl = (effectiveFrom: string) => `${BASE}/tariffs/${encodeURIComponent(effectiveFrom)}`;

export function fetchPricing(signal?: AbortSignal): Promise<PricingConfig> {
  return request<PricingConfig>(BASE, { signal });
}

export function addTariff(tariff: Tariff): Promise<Tariff> {
  return request<Tariff>(`${BASE}/tariffs`, sendJson('POST', tariff));
}

export function replaceTariff(tariff: Tariff): Promise<Tariff> {
  return request<Tariff>(tariffUrl(tariff.effectiveFrom), sendJson('PUT', tariff));
}

export function deleteTariff(effectiveFrom: string): Promise<void> {
  return request<void>(tariffUrl(effectiveFrom), { method: 'DELETE' });
}

export function replaceSurchargeTiers(tiers: SurchargeTier[]): Promise<SurchargeTier[]> {
  return request<SurchargeTier[]>(`${BASE}/surcharge-tiers`, sendJson('PUT', tiers));
}

export function replaceProrationRule(rule: ProrationRule): Promise<ProrationRule> {
  return request<ProrationRule>(`${BASE}/proration-rule`, sendJson('PUT', rule));
}
