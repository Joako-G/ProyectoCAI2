import { request } from '../../members/services/members-api';
import type { DisciplineSettlement, ReportGranularity, RevenueReport } from '../types/report';

export function fetchRevenue(granularity: ReportGranularity, date: string, signal?: AbortSignal): Promise<RevenueReport> {
  const params = new URLSearchParams({ granularity, date });
  return request<RevenueReport>(`/api/reports/revenue?${params}`, { signal });
}

export function fetchDisciplineSettlement(period: string, disciplineId: string, signal?: AbortSignal): Promise<DisciplineSettlement> {
  const params = new URLSearchParams({ period, disciplineId });
  return request<DisciplineSettlement>(`/api/reports/discipline-settlement?${params}`, { signal });
}
