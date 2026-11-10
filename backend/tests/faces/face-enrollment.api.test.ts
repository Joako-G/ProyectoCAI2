import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { createGreetingBus } from '../../src/modules/access/greeting.bus.js';
import { createFaceEnrollmentService } from '../../src/modules/faces/face-enrollment.service.js';
import { createFaceService } from '../../src/modules/faces/face.service.js';
import { NotFoundError } from '../../src/shared/errors.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { listenOnFetchSafePort } from '../helpers/listen.mjs';
import { createFakeFaceRepository, descriptor } from './helpers.js';

const greetings = createGreetingBus();
const audit = { record: vi.fn(async (_input: unknown) => undefined) };
const { repository, profiles } = createFakeFaceRepository();
const members = {
  getById: async (id: string) => {
    if (id === 'missing') throw new NotFoundError('Member not found');
    return { id, firstName: 'Ana', status: 'active' as const };
  },
};
const faceService = createFaceService({ repository, members, access: { checkMember: async () => ({ result: 'red', reason: 'not_found' }) }, audit });
const faceEnrollment = createFaceEnrollmentService({ members, faces: faceService, display: { publish: (event) => greetings.publishEnrollment(event), publicScreenCount: () => greetings.publicScreenCount() } });

let server: Server;
let baseUrl: string;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const users = await createUsersFile();
  cleanup = users.cleanup;
  server = await listenOnFetchSafePort(createApp({ storePath: users.storePath, faceService, faceEnrollment, greetings, accessService: { check: async () => ({ result: 'red', reason: 'not_found' }) }, displayHeartbeatMs: 40 }));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanup();
});

beforeEach(() => {
  audit.record.mockClear();
  profiles.clear();
});

function send(method: string, path: string, body?: unknown, cookie?: string) {
  return fetch(`${baseUrl}/api/faces/enrollments${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
  });
}

/** Opens the display stream like the public screen does and collects what arrives. */
async function connectScreen(cookie: string, query = '?screen=public') {
  const abort = new AbortController();
  const response = await fetch(`${baseUrl}/api/access/display-events${query}`, { headers: { cookie }, signal: abort.signal });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const state = { text: '' };
  void (async () => {
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) return;
        state.text += decoder.decode(chunk.value, { stream: true });
      }
    } catch {
      // aborted
    }
  })();
  return { state, close: () => abort.abort() };
}

async function until(condition: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(condition()).toBe(true);
}

describe('enrollment session routes', () => {
  it('answer 401 without a session and 403 to a teacher', async () => {
    const teacher = await signIn(baseUrl, 'teacher');
    for (const [method, path] of [['POST', ''], ['GET', '/display'], ['GET', '/active'], ['GET', '/s1'], ['POST', '/s1/progress'], ['POST', '/s1/complete'], ['POST', '/s1/cancel']] as const) {
      expect((await send(method, path, {})).status, `${method} ${path}`).toBe(401);
      expect((await send(method, path, {}, teacher)).status, `${method} ${path}`).toBe(403);
    }
  });

  it('refuses to open without consent or a member, or while no public screen is connected', async () => {
    const cookie = await signIn(baseUrl, 'secretary');
    const noConsent = await send('POST', '', { memberId: 'm1', consent: false }, cookie);
    expect(noConsent.status).toBe(400);
    expect(await noConsent.json()).toMatchObject({ fieldErrors: { consent: expect.any(String) } });
    expect((await send('POST', '', { consent: true }, cookie)).status).toBe(400);
    const noScreen = await send('POST', '', { memberId: 'm1', consent: true }, cookie);
    expect(noScreen.status).toBe(409);
    expect(await (await send('GET', '/display', undefined, cookie)).json()).toEqual({ connected: false });
  });

  it('runs a whole enrollment: the screen is told, progress is readable, the face is saved and audited, the screen is released', async () => {
    const secretary = await signIn(baseUrl, 'secretary');
    const head = await signIn(baseUrl, 'head_secretary');
    const screen = await connectScreen(secretary);
    await until(() => greetings.publicScreenCount() === 1);
    expect(await (await send('GET', '/display', undefined, head)).json()).toEqual({ connected: true });

    const opened = await send('POST', '', { memberId: 'm1', consent: true }, head);
    expect(opened.status).toBe(201);
    const { session } = (await opened.json()) as { session: { id: string; memberId: string; firstName: string; status: string } };
    expect(session).toMatchObject({ memberId: 'm1', firstName: 'Ana', status: 'waiting' });
    await until(() => screen.state.text.includes('event: enrollment'));
    expect(screen.state.text).toContain(`"type":"start","sessionId":"${session.id}","firstName":"Ana"`);
    expect(screen.state.text).not.toContain('m1');

    // A second session is refused while this one runs.
    expect((await send('POST', '', { memberId: 'm2', consent: true }, head)).status).toBe(409);
    expect(await (await send('GET', '/active', undefined, head)).json()).toMatchObject({ session: { id: session.id } });

    // The public screen (a different staff session) reports progress; the secretary reads it back.
    const progress = await send('POST', `/${session.id}/progress`, { status: 'capturing', hint: 'Acercate', captures: 1 }, secretary);
    expect(progress.status).toBe(200);
    expect(await (await send('GET', `/${session.id}`, undefined, head)).json()).toMatchObject({ status: 'capturing', hint: 'Acercate', captures: 1, total: 3 });
    expect((await send('POST', `/${session.id}/progress`, { status: 'capturing', captures: 9 }, secretary)).status).toBe(400);

    const complete = await send('POST', `/${session.id}/complete`, { descriptor: descriptor() }, secretary);
    expect(complete.status).toBe(204);
    expect(await complete.text()).toBe('');
    expect(profiles.get('m1')).toMatchObject({ consentedBy: 'user-head_secretary' });
    expect(audit.record).toHaveBeenCalledWith({ actorId: 'user-head_secretary', action: 'create', entityType: 'face_profile', entityId: 'm1' });
    await until(() => screen.state.text.includes('"outcome":"completed"'));
    expect(screen.state.text).not.toContain('0.4242424242');
    expect(await (await send('GET', `/${session.id}`, undefined, head)).json()).toMatchObject({ status: 'completed', captures: 3 });
    expect(await (await send('GET', '/active', undefined, head)).json()).toEqual({ session: null });
    screen.close();
  });

  it('cancel releases the screen; the connection of a staff screen is not a public screen', async () => {
    const cookie = await signIn(baseUrl, 'secretary');
    const staffOnly = await connectScreen(cookie, '');
    await until(() => greetings.listenerCount() >= 1);
    expect(greetings.publicScreenCount()).toBe(0);
    expect((await send('POST', '', { memberId: 'm1', consent: true }, cookie)).status).toBe(409);
    staffOnly.close();

    const screen = await connectScreen(cookie);
    await until(() => greetings.publicScreenCount() === 1);
    const { session } = (await (await send('POST', '', { memberId: 'm1', consent: true }, cookie)).json()) as { session: { id: string } };
    expect((await send('POST', `/${session.id}/cancel`, undefined, cookie)).status).toBe(204);
    await until(() => screen.state.text.includes('"outcome":"cancelled"'));
    expect((await send('POST', `/${session.id}/complete`, { descriptor: descriptor() }, cookie)).status).toBe(409);
    expect(profiles.size).toBe(0);
    expect((await send('GET', '/nope', undefined, cookie)).status).toBe(404);
    screen.close();
  });

  it('never logs a descriptor', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const cookie = await signIn(baseUrl, 'secretary');
    const screen = await connectScreen(cookie);
    await until(() => greetings.publicScreenCount() === 1);
    const { session } = (await (await send('POST', '', { memberId: 'm1', consent: true }, cookie)).json()) as { session: { id: string } };
    await send('POST', `/${session.id}/complete`, { descriptor: descriptor(0.7777777) }, cookie);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/0\.7777777/);
    vi.restoreAllMocks();
    screen.close();
  });
});
