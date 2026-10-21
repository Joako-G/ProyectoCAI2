import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonDisciplineRepository } from '../../src/modules/disciplines/json-discipline.repository.js';
import { createDisciplineService } from '../../src/modules/disciplines/discipline.service.js';
import type { DisciplineInput } from '../../src/modules/disciplines/discipline.types.js';

export const TODAY = new Date('2026-10-21T15:00:00Z');

export const basketball: DisciplineInput = { name: 'Básquet', teacherName: 'Marcos Ledesma' };
export const volleyball: DisciplineInput = { name: 'Vóley', teacherName: 'Carla Ibarra' };

export async function createTestContext(now: () => Date = () => TODAY) {
  const dir = await mkdtemp(join(tmpdir(), 'disciplines-'));
  const file = join(dir, 'disciplines.json');
  const repository = createJsonDisciplineRepository(file);
  const service = createDisciplineService({ repository, now });
  return { service, repository, file, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
