import { useEffect, useState } from 'react';
import { getFaceSummary } from '../../faces/services/faces-api';

/** The screen can stay open for days, so the number is read again now and then. */
const REFRESH_MS = 10 * 60 * 1000;

/** How many faces the door compares against; undefined while unknown or when the server cannot say. */
export function useEnrolledCount(): number | undefined {
  const [count, setCount] = useState<number | undefined>();
  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      getFaceSummary(controller.signal)
        .then(({ enrolled }) => setCount(enrolled))
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  return count;
}
