import { describe, expect, it, vi } from 'vitest';
import { createEntriesService } from '../../src/modules/access/access.entries.js';
import type { EntryRecord } from '../../src/modules/access/entry.repository.js';

// 2026-11-07 in the club time zone (UTC-3).
const NOW = new Date('2026-11-07T15:00:00.000Z');

function record(id: string, memberId: string, checkedAt: string, result: EntryRecord['result'], method: EntryRecord['method'] = 'dni'): EntryRecord {
  return { id, memberId, result, reason: 'up_to_date', method, checkedAt, checkedBy: 'user-1' };
}

function setup(rows: EntryRecord[]) {
  // The repository answers newest first; the service keeps that order.
  const entries = { append: vi.fn(), listByDate: vi.fn(async (_date: string) => rows) };
  const members = { list: vi.fn(async () => [{ id: 'm1', memberNumber: '0001', firstName: 'Ana', lastName: 'Prueba' }, { id: 'm2', memberNumber: '0002', firstName: 'Beto', lastName: 'Prueba' }]) };
  return { entries, members, service: createEntriesService({ entries, members, now: () => NOW }) };
}

describe('entries service', () => {
  it('lists the day with the member number and name resolved at read time, in the order the log gives', async () => {
    const { service } = setup([
      record('e2', 'm2', '2026-11-07T14:30:00.000Z', 'yellow', 'face'),
      record('e1', 'm1', '2026-11-07T14:00:00.000Z', 'green'),
    ]);
    const day = await service.list('2026-11-07');
    expect(day.date).toBe('2026-11-07');
    expect(day.entries.map((entry) => entry.memberNumber)).toEqual(['0002', '0001']);
    expect(day.entries[0]).toEqual({ id: 'e2', checkedAt: '2026-11-07T14:30:00.000Z', memberNumber: '0002', name: 'Beto Prueba', method: 'face', result: 'yellow' });
  });

  it('counts the members who entered: green and yellow, not red', async () => {
    const { service } = setup([
      record('e3', 'm1', '2026-11-07T14:20:00.000Z', 'red'),
      record('e2', 'm2', '2026-11-07T14:10:00.000Z', 'yellow'),
      record('e1', 'm1', '2026-11-07T14:00:00.000Z', 'green'),
    ]);
    expect((await service.list('2026-11-07')).count).toBe(2);
  });

  it('defaults to today in the club time zone', async () => {
    const { service, entries } = setup([]);
    expect((await service.list()).date).toBe('2026-11-07');
    expect(entries.listByDate).toHaveBeenCalledWith('2026-11-07');
  });

  it('shows no number or name for a member that no longer exists, and exposes no reason or staff id', async () => {
    const { service } = setup([record('e1', 'gone', '2026-11-07T14:00:00.000Z', 'green')]);
    const [entry] = (await service.list('2026-11-07')).entries;
    expect(entry).toMatchObject({ memberNumber: null, name: null });
    expect(Object.keys(entry!)).not.toContain('reason');
    expect(Object.keys(entry!)).not.toContain('checkedBy');
  });
});
