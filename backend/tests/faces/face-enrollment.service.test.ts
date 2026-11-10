import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnrollmentEvent } from '../../src/modules/access/greeting.bus.js';
import { createGreetingBus } from '../../src/modules/access/greeting.bus.js';
import { createFaceEnrollmentService, ENROLLMENT_TTL_MS } from '../../src/modules/faces/face-enrollment.service.js';
import { createFaceService } from '../../src/modules/faces/face.service.js';
import { ConflictError, NotFoundError } from '../../src/shared/errors.js';
import { createFakeFaceRepository, descriptor } from './helpers.js';

const START = new Date('2026-11-09T15:00:00.000Z');

function setup(options: { screens?: number; memberStatus?: 'active' | 'inactive' } = {}) {
  const { repository, profiles } = createFakeFaceRepository();
  const members = {
    getById: vi.fn(async (id: string) => {
      if (id === 'missing') throw new NotFoundError('Member not found');
      return { id, firstName: 'Ana', status: options.memberStatus ?? ('active' as const) };
    }),
  };
  const audit = { record: vi.fn(async (_input: unknown) => undefined) };
  const faces = createFaceService({ repository, members, access: { checkMember: async () => ({ result: 'red', reason: 'not_found' }) }, audit });
  const events: EnrollmentEvent[] = [];
  let screens = options.screens ?? 1;
  let counter = 0;
  const service = createFaceEnrollmentService({
    members,
    faces,
    display: { publish: (event) => events.push(event), publicScreenCount: () => screens },
    newId: () => `s${++counter}`,
  });
  return { service, events, profiles, audit, setScreens: (count: number) => { screens = count; } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => vi.useRealTimers());

describe('open', () => {
  it('opens a waiting session and tells the public screen with the first name only', async () => {
    const { service, events } = setup();
    const session = await service.open('m1', 'user-1');
    expect(session).toMatchObject({ id: 's1', memberId: 'm1', firstName: 'Ana', status: 'waiting', captures: 0, total: 3, expiresAt: new Date(START.getTime() + ENROLLMENT_TTL_MS).toISOString() });
    expect(events).toEqual([{ type: 'start', sessionId: 's1', firstName: 'Ana', expiresAt: session.expiresAt, captures: 3 }]);
    expect(JSON.stringify(events)).not.toContain('m1');
    expect(service.active()?.id).toBe('s1');
  });

  it('refuses a second session while one is active, and writes no second event', async () => {
    const { service, events } = setup();
    await service.open('m1', 'user-1');
    await expect(service.open('m2', 'user-2')).rejects.toBeInstanceOf(ConflictError);
    expect(events).toHaveLength(1);
  });

  it('refuses concurrent opens: only one wins', async () => {
    const { service } = setup();
    const results = await Promise.allSettled([service.open('m1', 'user-1'), service.open('m2', 'user-2')]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
  });

  it('refuses when no public screen is connected', async () => {
    const { service, events } = setup({ screens: 0 });
    await expect(service.open('m1', 'user-1')).rejects.toBeInstanceOf(ConflictError);
    expect(events).toHaveLength(0);
    expect(service.displayConnected()).toBe(false);
  });

  it('refuses an unknown or inactive member', async () => {
    await expect(setup().service.open('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundError);
    await expect(setup({ memberStatus: 'inactive' }).service.open('m1', 'user-1')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('progress', () => {
  it('stores the hint and the captures done, and moves the session to capturing', async () => {
    const { service } = setup();
    await service.open('m1', 'user-1');
    expect(service.progress('s1', { status: 'capturing', hint: 'Acercate', captures: 1 })).toMatchObject({ status: 'capturing', hint: 'Acercate', captures: 1 });
    expect(service.get('s1')).toMatchObject({ hint: 'Acercate', captures: 1 });
  });

  it('ends the session when the public screen reports a failure', async () => {
    const { service, events } = setup();
    await service.open('m1', 'user-1');
    expect(service.progress('s1', { status: 'failed', message: 'No hay cámara' })).toMatchObject({ status: 'failed', message: 'No hay cámara' });
    expect(events.at(-1)).toEqual({ type: 'end', sessionId: 's1', outcome: 'failed' });
    expect(service.active()).toBeUndefined();
  });

  it('refuses progress for an unknown or finished session', async () => {
    const { service } = setup();
    expect(() => service.progress('nope', { status: 'capturing' })).toThrow(NotFoundError);
    await service.open('m1', 'user-1');
    service.cancel('s1');
    expect(() => service.progress('s1', { status: 'capturing' })).toThrow(ConflictError);
  });
});

describe('complete', () => {
  it('saves the face for the staff member who confirmed the consent, with the time of that consent, and ends the session', async () => {
    const { service, profiles, audit, events } = setup();
    await service.open('m1', 'user-1');
    vi.setSystemTime(new Date(START.getTime() + 20_000));
    await service.complete('s1', descriptor());
    expect(profiles.get('m1')).toMatchObject({ consentedBy: 'user-1', consentedAt: START.toISOString() });
    expect(audit.record).toHaveBeenCalledWith({ actorId: 'user-1', action: 'create', entityType: 'face_profile', entityId: 'm1' });
    expect(service.get('s1')).toMatchObject({ status: 'completed', captures: 3 });
    expect(events.at(-1)).toEqual({ type: 'end', sessionId: 's1', outcome: 'completed' });
    expect(JSON.stringify(events)).not.toContain('0.4242424242');
    expect(service.active()).toBeUndefined();
  });

  it('allows a new session after the previous one finished', async () => {
    const { service } = setup();
    await service.open('m1', 'user-1');
    await service.complete('s1', descriptor());
    await expect(service.open('m2', 'user-1')).resolves.toMatchObject({ id: 's2' });
  });

  it('cannot complete twice', async () => {
    const { service, events } = setup();
    await service.open('m1', 'user-1');
    await service.complete('s1', descriptor());
    await expect(service.complete('s1', descriptor())).rejects.toBeInstanceOf(ConflictError);
    expect(events.filter((event) => event.type === 'end')).toHaveLength(1);
  });

  it('reports a refused save as failed and rethrows', async () => {
    const { repository } = createFakeFaceRepository();
    const events: EnrollmentEvent[] = [];
    let status: 'active' | 'inactive' = 'active';
    const members = { getById: async (id: string) => ({ id, firstName: 'Ana', status }) };
    const faces = createFaceService({ repository, members, access: { checkMember: async () => ({ result: 'red', reason: 'not_found' }) }, audit: { record: async () => undefined } });
    const service = createFaceEnrollmentService({ members, faces, display: { publish: (event) => events.push(event), publicScreenCount: () => 1 }, newId: () => 'x' });
    await service.open('m1', 'user-1');
    status = 'inactive';
    // The faces service refuses an inactive member at save time; the session ends instead of staying open.
    await expect(service.complete('x', descriptor())).rejects.toBeInstanceOf(ConflictError);
    expect(service.get('x').status).toBe('failed');
    expect(events.at(-1)).toEqual({ type: 'end', sessionId: 'x', outcome: 'failed' });
  });
});

describe('cancel', () => {
  it('ends the session and tells the public screen; cancelling again changes nothing', async () => {
    const { service, events } = setup();
    await service.open('m1', 'user-1');
    expect(service.cancel('s1').status).toBe('cancelled');
    service.cancel('s1');
    expect(events.filter((event) => event.type === 'end')).toEqual([{ type: 'end', sessionId: 's1', outcome: 'cancelled' }]);
    expect(() => service.cancel('nope')).toThrow(NotFoundError);
  });
});

describe('expiry', () => {
  it('releases the public screen by itself after the time limit', async () => {
    const { service, events } = setup();
    await service.open('m1', 'user-1');
    vi.advanceTimersByTime(ENROLLMENT_TTL_MS - 1);
    expect(service.active()).toBeDefined();
    vi.advanceTimersByTime(1);
    expect(events.at(-1)).toEqual({ type: 'end', sessionId: 's1', outcome: 'expired' });
    expect(service.get('s1').status).toBe('expired');
    expect(service.active()).toBeUndefined();
  });

  it('refuses to complete an expired session and keeps no face', async () => {
    const { service, profiles } = setup();
    await service.open('m1', 'user-1');
    vi.advanceTimersByTime(ENROLLMENT_TTL_MS);
    await expect(service.complete('s1', descriptor())).rejects.toBeInstanceOf(ConflictError);
    expect(profiles.size).toBe(0);
  });

  it('allows a new session once the old one expired', async () => {
    const { service } = setup();
    await service.open('m1', 'user-1');
    vi.advanceTimersByTime(ENROLLMENT_TTL_MS);
    await expect(service.open('m2', 'user-1')).resolves.toMatchObject({ id: 's2' });
  });
});

describe('public screen count on the bus', () => {
  it('counts only connections that identify as the public screen and forgets them when they leave', () => {
    const bus = createGreetingBus();
    const received: EnrollmentEvent[] = [];
    const staff = bus.subscribeEnrollment((event) => received.push(event));
    const screen = bus.subscribeEnrollment((event) => received.push(event), { publicScreen: true });
    expect(bus.publicScreenCount()).toBe(1);
    bus.publishEnrollment({ type: 'end', sessionId: 's1', outcome: 'cancelled' });
    expect(received).toHaveLength(2);
    screen();
    expect(bus.publicScreenCount()).toBe(0);
    staff();
    bus.publishEnrollment({ type: 'end', sessionId: 's1', outcome: 'cancelled' });
    expect(received).toHaveLength(2);
  });
});
