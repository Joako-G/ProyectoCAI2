import type { Server } from 'node:http';

export const FETCH_BAD_PORTS: readonly number[];
export const MAX_LISTEN_ATTEMPTS: number;
export function isFetchBlockedPort(port: number): boolean;

/** What the helper needs from a listening server; `http.Server` satisfies it. */
export type ListeningServer = Pick<Server, 'once' | 'off' | 'close'> & { address(): { port: number } | string | null };

/** An Express app or an `http.Server`: anything whose `listen(0)` returns a server. */
export interface Listenable<S extends ListeningServer> {
  listen(port: 0): S;
}

export function listenOnFetchSafePort<S extends ListeningServer>(target: Listenable<S>, maxAttempts?: number): Promise<S>;
