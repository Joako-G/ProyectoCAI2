import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  FETCH_BAD_PORTS, MAX_LISTEN_ATTEMPTS, isFetchBlockedPort, listenOnFetchSafePort, type ListeningServer,
} from './listen.mjs';

/** A server double that "listens" on the given port, to script which ports the OS hands out. */
function fakeServer(port: number): ListeningServer & { closed: boolean } {
  const emitter = new EventEmitter();
  const server = Object.assign(emitter, {
    closed: false,
    address: () => ({ port }),
    close(callback?: () => void) { server.closed = true; callback?.(); return server; },
  });
  queueMicrotask(() => emitter.emit('listening'));
  return server as unknown as ListeningServer & { closed: boolean };
}

function fakeTarget(ports: readonly number[]) {
  const servers: Array<ReturnType<typeof fakeServer>> = [];
  const target = { listen: (_port: 0) => { const server = fakeServer(ports[Math.min(servers.length, ports.length - 1)]!); servers.push(server); return server; } };
  return { target, servers };
}

describe('isFetchBlockedPort', () => {
  it('knows the WHATWG Fetch bad ports and accepts ordinary ones', () => {
    for (const port of [1, 22, 4045, 5060, 6000, 6669, 10080]) expect(isFetchBlockedPort(port)).toBe(true);
    for (const port of [3001, 5173, 5432, 8080, 14999, 49152]) expect(isFetchBlockedPort(port)).toBe(false);
  });
});

describe('listenOnFetchSafePort', () => {
  it('returns the first server when its port is safe', async () => {
    const { target, servers } = fakeTarget([40000]);
    const server = await listenOnFetchSafePort(target);
    expect(server).toBe(servers[0]);
    expect(servers).toHaveLength(1);
    expect(servers[0]!.closed).toBe(false);
  });

  it('closes servers on blocked ports and retries until a safe port arrives', async () => {
    const { target, servers } = fakeTarget([6000, 4045, 10080, 40001]);
    const server = await listenOnFetchSafePort(target);
    expect(servers).toHaveLength(4);
    expect(servers.map((candidate) => candidate.closed)).toEqual([true, true, true, false]);
    expect(server).toBe(servers[3]);
  });

  it('throws a clear error naming the blocked ports once the attempts run out', async () => {
    const { target, servers } = fakeTarget([6000]);
    await expect(listenOnFetchSafePort(target, 3)).rejects.toThrow(/No port accepted by fetch after 3 attempts.*6000, 6000, 6000/);
    expect(servers).toHaveLength(3);
    expect(servers.every((server) => server.closed)).toBe(true);
  });

  it('defaults to a bounded number of attempts', async () => {
    const { target, servers } = fakeTarget([6000]);
    await expect(listenOnFetchSafePort(target)).rejects.toThrow();
    expect(servers).toHaveLength(MAX_LISTEN_ATTEMPTS);
  });

  it('rejects when the server fails to listen', async () => {
    const failing = { listen: () => { const emitter = new EventEmitter(); queueMicrotask(() => emitter.emit('error', new Error('EADDRINUSE'))); return emitter as unknown as ListeningServer; } };
    await expect(listenOnFetchSafePort(failing)).rejects.toThrow('EADDRINUSE');
  });

  it('keeps the block list free of duplicates and sorted', () => {
    expect([...FETCH_BAD_PORTS]).toEqual([...new Set(FETCH_BAD_PORTS)].sort((a, b) => a - b));
  });

  it('starts 500 real servers that fetch can call, none on a blocked port', async () => {
    const servers = await Promise.all(Array.from({ length: 500 }, () => listenOnFetchSafePort(createServer((_request, response) => { response.end('ok'); }))));
    try {
      const ports = servers.map((server) => (server.address() as { port: number }).port);
      expect(ports.filter(isFetchBlockedPort)).toEqual([]);
      const bodies = await Promise.all(ports.map(async (port) => (await fetch(`http://127.0.0.1:${port}/`)).text()));
      expect(bodies.every((body) => body === 'ok')).toBe(true);
    } finally {
      await Promise.all(servers.map((server) => new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); })));
    }
  }, 60_000);
});
