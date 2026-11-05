import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditLabelSources } from '../../src/modules/audit/audit.labels.js';
import type { AuditEntityType } from '../../src/modules/audit/audit.types.js';
import { createTestContext, HEAD_ACTOR } from './helpers.js';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) await cleanups.pop()!();
});

// Synthetic records only. The member has a name and a DNI that must never reach a label.
const sources = () => ({
  members: vi.fn(async () => [{ id: 'ea722372-1111-4222-8333-444455556666', memberNumber: '0007', firstName: 'Carla', lastName: 'Prueba', dni: '30111222' }]),
  disciplines: vi.fn(async () => [{ id: 'disc-futbol-1234', name: 'Fútbol' }]),
  users: vi.fn(async () => [{ id: 'user-secretary', name: 'Luis Pérez' }]),
  payments: vi.fn(async () => [{ id: 'pay-0000-1111', receiptNumber: 12 }]),
  cashCounts: vi.fn(async () => [{ id: 'cash-0000-1111', businessDate: '2026-11-01' }]),
}) satisfies AuditLabelSources;

async function setup(labels?: AuditLabelSources) {
  const context = await createTestContext({ labels });
  cleanups.push(context.cleanup);
  return context;
}

async function labelOf(service: Awaited<ReturnType<typeof setup>>['service'], entityType: AuditEntityType, entityId: string) {
  await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType, entityId });
  return (await service.list())[0]!.entityLabel;
}

describe('audit labels', () => {
  it('shows a member by number, a discipline and a user by name, a payment by receipt and a close by date', async () => {
    const { service } = await setup(sources());
    expect(await labelOf(service, 'member', 'ea722372-1111-4222-8333-444455556666')).toBe('Socio 0007');
    expect(await labelOf(service, 'discipline', 'disc-futbol-1234')).toBe('Disciplina Fútbol');
    expect(await labelOf(service, 'user', 'user-secretary')).toBe('Usuario Luis Pérez');
    expect(await labelOf(service, 'payment', 'pay-0000-1111')).toBe('Pago N.º 12');
    expect(await labelOf(service, 'cash_count', 'cash-0000-1111')).toBe('Arqueo del 01/11/2026');
  });

  it('names a tariff by its period and the two singletons by a fixed label, without reading any source', async () => {
    const all = sources();
    const { service } = await setup(all);
    expect(await labelOf(service, 'tariff', '2027-03')).toBe('Tarifa desde 2027-03');
    expect(await labelOf(service, 'surcharge_tiers', 'surcharge_tiers')).toBe('Recargos por pago tardío');
    expect(await labelOf(service, 'proration_rule', 'proration_rule')).toBe('Prorrateo');
    for (const source of Object.values(all)) expect(source).not.toHaveBeenCalled();
  });

  it('names a backup by the day it was made, read from its folder name without any source', async () => {
    const { service } = await setup(sources());
    expect(await labelOf(service, 'backup', 'backup-20261104T150000Z')).toBe('Respaldo del 04/11/2026');
    expect(await labelOf(service, 'backup', 'something-else')).toBe('Respaldo somethin…');
  });

  it('reads each source once per request, however many entries there are, and skips sources it does not need', async () => {
    const all = sources();
    const { service } = await setup(all);
    for (const entityId of ['a', 'b', 'c']) await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'member', entityId });
    await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'discipline', entityId: 'x' });
    await service.list();
    expect(all.members).toHaveBeenCalledTimes(1);
    expect(all.disciplines).toHaveBeenCalledTimes(1);
    expect(all.users).not.toHaveBeenCalled();
    expect(all.payments).not.toHaveBeenCalled();
    expect(all.cashCounts).not.toHaveBeenCalled();
  });

  it('falls back to a short readable form for a record that no longer resolves, and never fails the list', async () => {
    const { service } = await setup(sources());
    expect(await labelOf(service, 'member', 'ffffffff-9999-4888-8777-666655554444')).toBe('Socio ffffffff…');
    expect(await labelOf(service, 'payment', 'p1')).toBe('Pago p1');
    expect(await labelOf(service, 'cash_count', 'c1')).toBe('Arqueo c1');
  });

  it('falls back when a source fails, logs only a short message, and still lists everything', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = { ...sources(), members: vi.fn(async () => { throw new Error('members file is corrupt: /secret/path'); }) };
    const { service } = await setup(broken);
    await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'discipline', entityId: 'disc-futbol-1234' });
    await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'member', entityId: 'ea722372-1111-4222-8333-444455556666' });
    expect((await service.list()).map((entry) => entry.entityLabel)).toEqual(['Socio ea722372…', 'Disciplina Fútbol']);
    expect(String(error.mock.calls[0]![0])).not.toContain('/secret/path');
  });

  it('falls back to the short form for everything when no sources are given', async () => {
    const { service } = await setup();
    expect(await labelOf(service, 'member', 'm1')).toBe('Socio m1');
  });

  it('adds the label at read time only: the stored entry keeps the id and holds no label or personal data', async () => {
    const { service, file } = await setup(sources());
    await service.record({ actorId: HEAD_ACTOR.id, action: 'update', entityType: 'member', entityId: 'ea722372-1111-4222-8333-444455556666', changedFields: ['category'] });
    expect((await service.list())[0]!.entityLabel).toBe('Socio 0007');
    const stored = await readFile(file, 'utf8');
    expect(JSON.parse(stored)[0]).not.toHaveProperty('entityLabel');
    for (const forbidden of ['0007', 'Carla', 'Prueba', '30111222']) expect(stored).not.toContain(forbidden);
    expect(stored).toContain('ea722372-1111-4222-8333-444455556666');
  });
});
