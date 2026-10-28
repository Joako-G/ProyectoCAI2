import { Router } from 'express';
import type { ReportService } from './report.service.js';
import type { ReportGranularity } from './report.types.js';

// A query value that is missing, repeated or structured reads as undefined, so the service rejects it as invalid.
const queryText = (value: unknown) => (typeof value === 'string' ? value : undefined);

// Mounted behind requireCapability('reports:read'). Reports only read: there is no write route.
export function createReportRouter(service: Pick<ReportService, 'revenue' | 'disciplineSettlement'>): Router {
  const router = Router();

  router.get('/revenue', async (request, response) => {
    const { granularity, date } = request.query;
    response.json(await service.revenue({ granularity: queryText(granularity) as ReportGranularity, date: queryText(date) as string }));
  });

  router.get('/discipline-settlement', async (request, response) => {
    const { period, disciplineId } = request.query;
    response.json(await service.disciplineSettlement({ period: queryText(period) as string, disciplineId: queryText(disciplineId) as string }));
  });

  return router;
}
