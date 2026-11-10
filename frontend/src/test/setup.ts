import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * How long findBy* and waitFor poll before giving up. Testing Library's default is 1 s, which is not enough when a
 * test renders the whole app on a busy PC: the first render, the redirect from "/" and the first data load took
 * over 1 s under CPU load and the tests failed at random ("Unable to find role heading Socios"). This only widens
 * the wait for something that does appear; it does not change the per-test timeout (`testTimeout` in the Vite
 * config), and a missing element still fails with the DOM dump after this long.
 */
export const ASYNC_UTIL_TIMEOUT_MS = 5_000;

configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

afterEach(() => {
  cleanup();
});
