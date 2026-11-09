// Shared test helper: start a test server on a port that `fetch` accepts.
//
// `fetch` (undici) refuses to connect to the "bad ports" of the WHATWG Fetch standard
// (https://fetch.spec.whatwg.org/#port-blocking, "bad port" list), failing with `fetch failed: bad port`.
// `listen(0)` lets the OS choose the port, and on a PC whose dynamic range includes those ports (Windows
// development machines can use 1024-15000) a test server occasionally lands on one, which makes the test or the
// whole file fail at random. This helper retries until the OS gives a port `fetch` can call.
//
// It is plain JavaScript (typed by listen.d.mts) so both the Vitest suites and the `node --test` suites can use it.

/** The WHATWG Fetch "bad port" list, in ascending order. */
export const FETCH_BAD_PORTS = Object.freeze([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110,
  111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061,
  6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);

/** How many ports to try before giving up; with about 0.1% of ports blocked, even 2 attempts are practically enough. */
export const MAX_LISTEN_ATTEMPTS = 50;

const BLOCKED = new Set(FETCH_BAD_PORTS);

/** True when `fetch` refuses to connect to this port. */
export function isFetchBlockedPort(port) {
  return BLOCKED.has(port);
}

function waitForListening(server) {
  return new Promise((resolve, reject) => {
    const onListening = () => { server.off('error', onError); resolve(); };
    const onError = (error) => { server.off('listening', onListening); reject(error); };
    server.once('listening', onListening);
    server.once('error', onError);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

/**
 * Starts `target.listen(0)` (an Express app or an `http.Server`) and resolves with the listening server once its
 * port is one `fetch` accepts. A server on a blocked port is closed and replaced, up to `maxAttempts` times.
 */
export async function listenOnFetchSafePort(target, maxAttempts = MAX_LISTEN_ATTEMPTS) {
  const rejected = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const server = target.listen(0);
    await waitForListening(server);
    const port = server.address().port;
    if (!isFetchBlockedPort(port)) return server;
    rejected.push(port);
    await close(server);
  }
  throw new Error(`No port accepted by fetch after ${maxAttempts} attempts (blocked ports given: ${rejected.join(', ')})`);
}
