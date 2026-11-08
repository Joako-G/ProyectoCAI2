import { describe, expect, it, vi } from 'vitest';
import type { AccessCheck } from '../../src/modules/access/access.types.js';
import { createEntranceRecorder } from '../../src/modules/access/entrance.js';
import { createGreetingBus, type GreetingEvent } from '../../src/modules/access/greeting.bus.js';

const NOW = new Date('2026-11-07T15:00:00.000Z');
const member = { id: 'm1', firstName: 'María José' };
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
    const event: GreetingEvent = { at: NOW.toISOString(), tone: 'refused' };
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
    expect(() => bus.publish({ at: NOW.toISOString(), tone: 'refused' })).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);
  });
});

describe('greetings published by the entrance recorder', () => {
  const cases: Array<[string, AccessCheck, boolean, GreetingEvent['tone'], string | undefined]> = [
    ['green greets by first name', { result: 'green', reason: 'up_to_date', member: summary }, true, 'welcome', 'María José'],
    ['yellow greets by first name and sends to the desk', { result: 'yellow', reason: 'debtor', member: summary }, true, 'see_desk', 'María José'],
    ['an identified red is refused with no name', { result: 'red', reason: 'deregistered', member: summary }, true, 'refused', undefined],
    ['an unknown DNI is refused with no name', { result: 'red', reason: 'not_found' }, false, 'refused', undefined],
    ['an unrecognized face is refused with no name', { result: 'red', reason: 'not_recognized' }, false, 'refused', undefined],
  ];

  it.each(cases)('%s', async (_name, answer, identified, tone, firstName) => {
    const { recorder, events } = setup();
    await recorder.register({ member: identified ? member : undefined, answer, method: 'dni', actorId: 'user-1' });
    expect(events).toEqual([{ at: NOW.toISOString(), tone, ...(firstName ? { firstName } : {}) }]);
  });

  it('publishes nothing but the time, the tone and the first name: no id, reason, number, staff id or surname', async () => {
    const { recorder, events } = setup();
    await recorder.register({ member, answer: { result: 'yellow', reason: 'debtor', member: { ...summary, debtSince: '2026-08' } }, method: 'face', actorId: 'user-77' });
    expect(Object.keys(events[0]!).sort()).toEqual(['at', 'firstName', 'tone']);
    expect(JSON.stringify(events)).not.toMatch(/m1|debtor|0001|user-77|Prueba|2026-08|face/);
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
