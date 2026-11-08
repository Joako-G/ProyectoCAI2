import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import type { AccessCheck } from '../../src/modules/access/access.types.js';
import type { FaceService } from '../../src/modules/faces/face.service.js';
import { NotFoundError } from '../../src/shared/errors.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';
import { descriptor } from './helpers.js';

const service = {
  enroll: vi.fn(async (_memberId: string, _input: { descriptor: number[] }, _actorId: string) => undefined),
  remove: vi.fn(async (_memberId: string, _actorId: string) => undefined),
  discardForDeactivatedMember: vi.fn(async (_memberId: string, _actorId: string) => undefined),
  status: vi.fn(async (_memberId: string): Promise<{ enrolled: boolean; enrolledAt?: string }> => ({ enrolled: true, enrolledAt: '2026-11-07T15:00:00.000Z' })),
  recognize: vi.fn(async (_descriptor: number[], _actorId: string): Promise<AccessCheck> => ({ result: 'red', reason: 'not_recognized' })),
} satisfies FaceService;

let enabled: Server;
let disabled: Server;
let enabledUrl: string;
let disabledUrl: string;
let cleanup: () => Promise<void>;

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  const users = await createUsersFile();
  cleanup = users.cleanup;
  enabled = createApp({ storePath: users.storePath, faceService: service }).listen(0);
  disabled = createApp({ storePath: users.storePath, facesUnavailable: true }).listen(0);
  [enabledUrl, disabledUrl] = await Promise.all([listen(enabled), listen(disabled)]);
});

afterAll(async () => {
  await Promise.all([enabled, disabled].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  await cleanup();
});

beforeEach(() => vi.clearAllMocks());

function send(baseUrl: string, method: string, path: string, body?: unknown, cookie?: string) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
  });
}

const FACE_ROUTES = [['GET', '/api/faces/m1'], ['PUT', '/api/faces/m1'], ['DELETE', '/api/faces/m1'], ['POST', '/api/faces/recognize']] as const;

describe('faces routes', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    const teacher = await signIn(enabledUrl, 'teacher');
    for (const [method, path] of FACE_ROUTES) {
      expect((await send(enabledUrl, method, path)).status, `${method} ${path}`).toBe(401);
      expect((await send(enabledUrl, method, path, {}, teacher)).status, `${method} ${path}`).toBe(403);
    }
  });

  it('PUT enrolls with the signed-in user as actor and answers 204 without a body', async () => {
    const response = await send(enabledUrl, 'PUT', '/api/faces/m1', { descriptor: descriptor(), consent: true }, await signIn(enabledUrl, 'secretary'));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(service.enroll).toHaveBeenCalledWith('m1', { descriptor: descriptor() }, 'user-secretary');
  });

  it('PUT rejects a bad descriptor or missing consent with 400 and never echoes the descriptor', async () => {
    const cookie = await signIn(enabledUrl, 'secretary');
    const noConsent = await send(enabledUrl, 'PUT', '/api/faces/m1', { descriptor: descriptor(0.31415926), consent: false }, cookie);
    expect(noConsent.status).toBe(400);
    const text = await noConsent.text();
    expect(JSON.parse(text)).toMatchObject({ error: 'validation_error', fieldErrors: { consent: expect.any(String) } });
    expect(text).not.toContain('0.31415926');
    expect((await send(enabledUrl, 'PUT', '/api/faces/m1', { descriptor: [1, 2], consent: true }, cookie)).status).toBe(400);
    expect(service.enroll).not.toHaveBeenCalled();
  });

  it('PUT passes a not found member through as 404', async () => {
    service.enroll.mockRejectedValueOnce(new NotFoundError('Member not found'));
    const response = await send(enabledUrl, 'PUT', '/api/faces/missing', { descriptor: descriptor(), consent: true }, await signIn(enabledUrl, 'head_secretary'));
    expect(response.status).toBe(404);
  });

  it('DELETE removes with the signed-in user as actor and answers 204, or 404', async () => {
    const cookie = await signIn(enabledUrl, 'head_secretary');
    expect((await send(enabledUrl, 'DELETE', '/api/faces/m1', undefined, cookie)).status).toBe(204);
    expect(service.remove).toHaveBeenCalledWith('m1', 'user-head_secretary');
    service.remove.mockRejectedValueOnce(new NotFoundError('Face profile not found'));
    expect((await send(enabledUrl, 'DELETE', '/api/faces/m2', undefined, cookie)).status).toBe(404);
  });

  it('GET returns only the enrollment status', async () => {
    const response = await send(enabledUrl, 'GET', '/api/faces/m1', undefined, await signIn(enabledUrl, 'secretary'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enrolled: true, enrolledAt: '2026-11-07T15:00:00.000Z' });
  });

  it('POST /recognize returns the service answer and rejects a bad descriptor', async () => {
    const cookie = await signIn(enabledUrl, 'secretary');
    const response = await send(enabledUrl, 'POST', '/api/faces/recognize', { descriptor: descriptor() }, cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: 'red', reason: 'not_recognized' });
    expect(service.recognize).toHaveBeenCalledWith(descriptor(), 'user-secretary');
    expect((await send(enabledUrl, 'POST', '/api/faces/recognize', { descriptor: [1] }, cookie)).status).toBe(400);
  });

  it('never logs a descriptor', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    const cookie = await signIn(enabledUrl, 'secretary');
    await send(enabledUrl, 'PUT', '/api/faces/m1', { descriptor: descriptor(), consent: true }, cookie);
    await send(enabledUrl, 'POST', '/api/faces/recognize', { descriptor: descriptor(0.7777777) }, cookie);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/0\.4242424242|0\.7777777/);
    vi.restoreAllMocks();
  });
});

describe('faces routes without a database', () => {
  it('answer 503 faces_unavailable to staff on every route, after the session and role checks', async () => {
    const cookie = await signIn(disabledUrl, 'secretary');
    const teacher = await signIn(disabledUrl, 'teacher');
    for (const [method, path] of FACE_ROUTES) {
      const response = await send(disabledUrl, method, path, {}, cookie);
      expect(response.status, `${method} ${path}`).toBe(503);
      expect(await response.json()).toMatchObject({ error: 'faces_unavailable' });
      expect((await send(disabledUrl, method, path)).status).toBe(401);
      expect((await send(disabledUrl, method, path, {}, teacher)).status).toBe(403);
    }
  });
});
