import { Router } from 'express';
import type { Authenticator } from '../auth/auth.session.js';
import type { AccessService } from './access.service.js';
import type { EntriesService } from './access.entries.js';
import type { GreetingBus } from './greeting.bus.js';
import { parseCheckBody, parseEntriesQuery } from './access.validation.js';

// Mounted behind requireCapability('access:check'). The DNI travels in the body, never in the URL, and is neither
// logged nor echoed. A check writes no audit entry: an identified entrance goes to the entry log instead.
export interface AccessRouterOptions {
  entries?: Pick<EntriesService, 'list'>;
  /** Present: GET /display-events streams its greetings to the public display. */
  greetings?: Pick<GreetingBus, 'subscribe'>;
  /** How often an idle stream sends a comment so proxies and browsers keep the connection open. */
  heartbeatMs?: number;
}

const DEFAULT_HEARTBEAT_MS = 25_000;

export function createAccessRouter(service: Pick<AccessService, 'check'>, authenticate: Authenticator, { entries, greetings, heartbeatMs = DEFAULT_HEARTBEAT_MS }: AccessRouterOptions = {}): Router {
  const router = Router();

  router.post('/check', async (request, response) => {
    const { dni } = parseCheckBody(request.body);
    response.json(await service.check(dni, { method: 'dni', actorId: authenticate(request)!.id }));
  });

  // The day's entries (RF-08). Without a database the log does not exist, so staff get a clear 503.
  router.get('/entries', async (request, response) => {
    const { date } = parseEntriesQuery(request.query);
    if (!entries) {
      response.status(503).json({ error: 'entries_unavailable', message: 'The entry log is not configured on this server' });
      return;
    }
    try {
      response.json(await entries.list(date));
    } catch (error) {
      // The driver's message can quote the connection; only its code is logged.
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'unknown';
      console.error(`Entry log read failed (code ${code})`);
      response.status(503).json({ error: 'entries_unavailable', message: 'The entry log is not available right now' });
    }
  });

  // Server-sent events for the public entrance display. Each message is a GreetingEvent: tone, kind and, for an identified member, who it is; never a DNI or an amount.
  // It needs no database. The headers keep proxies (Vite's in development, nginx in front) from buffering the stream.
  if (greetings) {
    router.get('/display-events', (request, response) => {
      response.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders();
      // retry tells EventSource how long to wait before it reconnects on its own.
      response.write('retry: 3000\n: connected\n\n');
      const stop = greetings.subscribe((event) => {
        response.write(`event: greeting\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => response.write(': ping\n\n'), heartbeatMs);
      request.on('close', () => {
        clearInterval(heartbeat);
        stop();
      });
    });
  }

  return router;
}
