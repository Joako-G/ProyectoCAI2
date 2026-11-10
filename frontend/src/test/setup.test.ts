import { getConfig } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ASYNC_UTIL_TIMEOUT_MS } from './setup';

// Tests that render the whole app wait for the first screen with findBy*/waitFor. With Testing Library's default
// of 1 s they failed at random on a busy PC (the first render of the app took longer than that), so the wait is
// widened once, here, for every test.
it('waits up to the configured time for findBy and waitFor, which stays below the test timeout', () => {
  expect(getConfig().asyncUtilTimeout).toBe(ASYNC_UTIL_TIMEOUT_MS);
  expect(ASYNC_UTIL_TIMEOUT_MS).toBeGreaterThan(1_000);
  // A missing element must still fail with Testing Library's DOM dump, not with a bare test timeout.
  expect(ASYNC_UTIL_TIMEOUT_MS).toBeLessThan(20_000);
});
