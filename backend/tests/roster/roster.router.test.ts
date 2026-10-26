import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRosterRouter } from '../../src/modules/roster/roster.routes.js';
import type { RosterService } from '../../src/modules/roster/roster.service.js';

let server: Server | undefined;
afterEach(async () => { await new Promise<void>((resolve) => server ? server.close(() => resolve()) : resolve()); server = undefined; });

describe('roster router mounted without the capability guard', () => {
  it('answers 401 and reads no roster when there is no signed-in user', async () => {
    const forDisciplines = vi.fn(async () => []);
    const app = express().use('/api/roster', createRosterRouter({ forDisciplines } as unknown as RosterService, () => null));
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/roster`);
    expect(response.status).toBe(401);
    expect(forDisciplines).not.toHaveBeenCalled();
  });
});
