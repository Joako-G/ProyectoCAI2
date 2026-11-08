import { describe, expect, it, vi } from 'vitest';
import type { AccessCheck } from '../../src/modules/access/access.types.js';
import { createEntranceRecorder } from '../../src/modules/access/entrance.js';
import { createGreetingBus, type GreetingEvent } from '../../src/modules/access/greeting.bus.js';

const NOW = new Date('2026-11-07T15:00:00.000Z');
const member = { id: 'm1', memberNumber: '0001', firstName: 'María José', fullName: 'María José Prueba', disciplines: ['Básquet', 'Natación'] };
const summary = { memberNumber: '0001', name: 'María José Prueba', unpaidPeriodCount: 0 };

function setup() {
  const bus = createGreetingBus();
  const events: GreetingEvent[] = [];
  bus.subscribe((event) => events.push(event));
  return { events, bus, recorder: createEntranceRecorder({ greetings: bus, now: () => NOW, log: vi.fn() }) };
}

describe('greeting bus', () => {
  it('delivers an event to every subscriber until they unsubscribe', () => {
    const bus = createGreetingBus();
    const first = vi.fn();
    const second = vi.fn();
    const stop = bus.subscribe(first);
    bus.subscribe(second);
    const event: GreetingEvent = { at: NOW.toISOString(), tone: 'refused', kind: 'not_found', method: 'dni' };
    bus.publish(event);
    stop();
    bus.publish(event);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(bus.listenerCount()).toBe(1);
  });

  it('keeps delivering when one subscriber throws', () => {
    const bus = createGreetingBus();
    const healthy = vi.fn();
    bus.subscribe(() => { throw new Error('closed socket'); });
    bus.subscribe(healthy);
    expect(() => bus.publish({ at: NOW.toISOString(), tone: 'refused', kind: 'not_found', method: 'dni' })).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});

describe('greetings published by the entrance recorder', () => {
  const cases: Array<[string, AccessCheck, boolean, GreetingEvent['tone'], string | undefined, GreetingEvent['kind']]> = [
    ['green greets by first name', { result: 'green', reason: 'up_to_date', member: summary }, true, 'welcome', 'María José', 'up_to_date'],
    ['yellow greets by first name and sends to the desk', { result: 'yellow', reason: 'debtor', member: summary }, true, 'see_desk', 'María José', 'debtor'],
    ['an identified red is refused with no first name', { result: 'red', reason: 'deregistered', member: summary }, true, 'refused', undefined, 'deregistered'],
    ['an identified inactive member is refused with no first name', { result: 'red', reason: 'inactive', member: summary }, true, 'refused', undefined, 'inactive'],
    ['an unknown DNI is refused with no name', { result: 'red', reason: 'not_found' }, false, 'refused', undefined, 'not_found'],
    ['an unrecognized face is refused with no name', { result: 'red', reason: 'not_recognized' }, false, 'refused', undefined, 'not_recognized'],
    ['a face that matched an inactive member is not recognized', { result: 'red', reason: 'inactive', member: summary }, false, 'refused', undefined, 'not_recognized'],
  ];

  it.each(cases)('%s', async (_name, answer, identified, tone, firstName, kind) => {
    const { recorder, events } = setup();
    await recorder.register({ member: identified ? member : undefined, answer, method: 'dni', actorId: 'user-1' });
    expect(events).toEqual([
      {
        at: NOW.toISOString(),
        tone,
        kind,
        method: 'dni',
        ...(firstName ? { firstName } : {}),
        ...(identified ? { member: { id: 'm1', memberNumber: '0001', fullName: 'María José Prueba', firstName: 'María José', disciplines: ['Básquet', 'Natación'] }, unpaidPeriodCount: 0 } : {}),
      },
    ]);
  });

  it('carries the paid-through month and the due date of an up to date member', async () => {
    const { recorder, events } = setup();
    await recorder.register({ member, answer: { result: 'green', reason: 'up_to_date', member: { ...summary, paidThrough: '2026-12', dueDate: '2027-01-10' } }, method: 'dni', actorId: 'user-1' });
    expect(events[0]).toMatchObject({ kind: 'up_to_date', paidThrough: '2026-12', dueDate: '2027-01-10', unpaidPeriodCount: 0 });
    expect(events[0]).not.toHaveProperty('debtSince');
  });

  it('carries the oldest unpaid month and the count of a debtor, by face', async () => {
    const { recorder, events } = setup();
    await recorder.register({ member, answer: { result: 'yellow', reason: 'debtor', member: { ...summary, unpaidPeriodCount: 2, debtSince: '2026-09' } }, method: 'face', actorId: 'user-77' });
    expect(events[0]).toMatchObject({ kind: 'debtor', method: 'face', debtSince: '2026-09', unpaidPeriodCount: 2 });
    expect(events[0]).not.toHaveProperty('paidThrough');
    expect(events[0]).not.toHaveProperty('dueDate');
  });

  it('sends nothing about a member who was not recognized or not found', async () => {
    const { recorder, events } = setup();
    await recorder.register({ member: undefined, answer: { result: 'red', reason: 'inactive', member: { ...summary, debtSince: '2026-08' } }, method: 'face', actorId: 'user-1' });
    await recorder.register({ member: undefined, answer: { result: 'red', reason: 'not_found' }, method: 'dni', actorId: 'user-1' });
    for (const event of events) expect(Object.keys(event).sort()).toEqual(['at', 'kind', 'method', 'tone']);
    expect(JSON.stringify(events)).not.toMatch(/m1|0001|María|Prueba|2026-08|Básquet/);
  });

  it('never publishes a DNI, an amount, the staff id or other fields of the answer', async () => {
    const { recorder, events } = setup();
    await recorder.register({ member, answer: { result: 'red', reason: 'deregistered', member: { ...summary, unpaidPeriodCount: 5, debtSince: '2026-06' } }, method: 'face', actorId: 'user-77' });
    expect(Object.keys(events[0]!).sort()).toEqual(['at', 'debtSince', 'kind', 'member', 'method', 'tone', 'unpaidPeriodCount']);
    expect(Object.keys(events[0]!.member!).sort()).toEqual(['disciplines', 'firstName', 'fullName', 'id', 'memberNumber']);
    expect(JSON.stringify(events)).not.toMatch(/user-77|dni|amount|"reason"|"result"/i);
  });

  it('greets even when there is no entry log', async () => {
    const { recorder, events } = setup();
    await recorder.register({ member, answer: { result: 'green', reason: 'up_to_date', member: summary }, method: 'dni', actorId: 'user-1' });
    expect(events).toHaveLength(1);
  });

  it('greets before the log write finishes, and still greets when the write fails', async () => {
    const bus = createGreetingBus();
    const seen: string[] = [];
    bus.subscribe(() => seen.push('greeted'));
    const append = vi.fn(async () => { seen.push('writing'); throw new Error('down'); });
    const recorder = createEntranceRecorder({ entries: { append }, greetings: bus, now: () => NOW, log: vi.fn() });
    await recorder.register({ member, answer: { result: 'green', reason: 'up_to_date', member: summary }, method: 'dni', actorId: 'user-1' });
    expect(seen).toEqual(['greeted', 'writing']);
  });
});
