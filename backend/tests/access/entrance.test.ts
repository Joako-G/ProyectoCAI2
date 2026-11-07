import { describe, expect, it, vi } from 'vitest';
import { createEntranceRecorder, type EntranceInput } from '../../src/modules/access/entrance.js';
import type { EntryRepository } from '../../src/modules/access/entry.repository.js';

const NOW = new Date('2026-11-07T15:00:00.000Z');
const green: EntranceInput = {
  member: { id: 'm1', firstName: 'Ana' },
  answer: { result: 'green', reason: 'up_to_date', member: { memberNumber: '0001', name: 'Ana Prueba', unpaidPeriodCount: 0 } },
  method: 'dni',
  actorId: 'user-1',
};

function setup(overrides: Partial<EntryRepository> = {}) {
  const entries: EntryRepository = { append: vi.fn(async () => undefined), listByDate: vi.fn(async () => []), ...overrides };
  const log = vi.fn();
  return { entries, log, recorder: createEntranceRecorder({ entries, now: () => NOW, log }) };
}

describe('entrance recorder', () => {
  it('records an identified member with the method, the result, the reason, the time and the staff member', async () => {
    const { recorder, entries } = setup();
    await recorder.register(green);
    expect(entries.append).toHaveBeenCalledWith({ memberId: 'm1', result: 'green', reason: 'up_to_date', method: 'dni', checkedAt: NOW.toISOString(), checkedBy: 'user-1' });
  });

  it('records a yellow and an identified red too, and a face entrance', async () => {
    const { recorder, entries } = setup();
    await recorder.register({ ...green, method: 'face', answer: { result: 'yellow', reason: 'debtor' } });
    await recorder.register({ ...green, answer: { result: 'red', reason: 'deregistered' } });
    expect(entries.append).toHaveBeenNthCalledWith(1, expect.objectContaining({ result: 'yellow', reason: 'debtor', method: 'face' }));
    expect(entries.append).toHaveBeenNthCalledWith(2, expect.objectContaining({ result: 'red', reason: 'deregistered' }));
  });

  it('never records an unknown DNI or an unrecognized face', async () => {
    const { recorder, entries } = setup();
    await recorder.register({ ...green, member: undefined, answer: { result: 'red', reason: 'not_found' } });
    await recorder.register({ ...green, member: undefined, method: 'face', answer: { result: 'red', reason: 'not_recognized' } });
    expect(entries.append).not.toHaveBeenCalled();
  });

  it('stores nothing that could be a DNI or a name', async () => {
    const { recorder, entries } = setup();
    await recorder.register(green);
    const stored = JSON.stringify(vi.mocked(entries.append).mock.calls);
    expect(stored).not.toMatch(/Ana|Prueba|\d{7,8}/);
    expect(Object.keys(vi.mocked(entries.append).mock.calls[0]![0]).sort()).toEqual(['checkedAt', 'checkedBy', 'memberId', 'method', 'reason', 'result']);
  });

  it('does nothing without a log, which is the case when there is no database', async () => {
    const recorder = createEntranceRecorder({ now: () => NOW, log: vi.fn() });
    await expect(recorder.register(green)).resolves.toBeUndefined();
  });

  it('keeps going when the write fails, with a short log line that has no personal data', async () => {
    const failure = Object.assign(new Error('connection refused for member m1 ana prueba 30111222'), { code: 'ECONNREFUSED' });
    const { recorder, log } = setup({ append: vi.fn(async () => { throw failure; }) });
    await expect(recorder.register(green)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]![0]);
    expect(line).toContain('ECONNREFUSED');
    expect(line).not.toMatch(/m1|ana|prueba|30111222/i);
  });
});
