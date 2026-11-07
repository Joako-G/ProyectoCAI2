import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createGreetingBus, type GreetingEvent } from '../../src/modules/access/greeting.bus.js';
import { createUsersFile, signIn } from '../authorization/helpers.js';

let server: Server;
let baseUrl: string;
let cleanup: () => Promise<void>;
const greetings = createGreetingBus();
const check = async () => ({ result: 'red' as const, reason: 'not_found' as const });

beforeAll(async () => {
  const users = await createUsersFile();
  cleanup = users.cleanup;
  // No entries service: the stream must work without a database.
  server = createApp({ storePath: users.storePath, accessService: { check }, greetings, displayHeartbeatMs: 40 }).listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await cleanup();
});

/** Reads the stream until the text satisfies `done`, or fails after two seconds. */
async function readUntil(response: Response, done: (text: string) => boolean): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const deadline = Date.now() + 2000;
  while (!done(text) && Date.now() < deadline) {
    const chunk = await Promise.race([reader.read(), new Promise<{ done: true; value: undefined }>((resolve) => setTimeout(() => resolve({ done: true, value: undefined }), 2000))]);
    if (chunk.done) break;
    text += decoder.decode(chunk.value, { stream: true });
  }
  reader.releaseLock();
  return text;
}

async function until(condition: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('GET /api/access/display-events', () => {
  it('answers 401 without a session and 403 to a teacher', async () => {
    expect((await fetch(`${baseUrl}/api/access/display-events`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/api/access/display-events`, { headers: { cookie: await signIn(baseUrl, 'teacher') } })).status).toBe(403);
  });

  it('opens an event stream with headers that keep proxies from buffering it', async () => {
    const abort = new AbortController();
    const response = await fetch(`${baseUrl}/api/access/display-events`, { headers: { cookie: await signIn(baseUrl, 'secretary') }, signal: abort.signal });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-cache');
    expect(response.headers.get('cache-control')).toContain('no-transform');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    abort.abort();
  });

  it('sends each published greeting as an event and heartbeat comments while idle', async () => {
    const abort = new AbortController();
    const response = await fetch(`${baseUrl}/api/access/display-events`, { headers: { cookie: await signIn(baseUrl, 'head_secretary') }, signal: abort.signal });
    const event: GreetingEvent = { at: '2026-11-07T15:00:00.000Z', tone: 'welcome', firstName: 'Ana' };
    setTimeout(() => greetings.publish(event), 20);
    const text = await readUntil(response, (seen) => seen.includes('event: greeting') && seen.includes(': ping'));
    abort.abort();
    expect(text).toContain(`event: greeting\ndata: ${JSON.stringify(event)}\n\n`);
    expect(text).toMatch(/^: ping$/m);
  });

  it('stops listening when the display closes', async () => {
    // Earlier tests aborted their streams; let the server notice before counting.
    await until(() => greetings.listenerCount() === 0);
    const before = greetings.listenerCount();
    const abort = new AbortController();
    const response = await fetch(`${baseUrl}/api/access/display-events`, { headers: { cookie: await signIn(baseUrl, 'secretary') }, signal: abort.signal });
    await readUntil(response, (seen) => seen.length > 0);
    expect(greetings.listenerCount()).toBe(before + 1);
    abort.abort();
    await until(() => greetings.listenerCount() === before);
    expect(greetings.listenerCount()).toBe(before);
  });
});
