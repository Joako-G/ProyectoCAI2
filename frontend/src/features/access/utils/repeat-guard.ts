/**
 * Two descriptors closer than this are taken as the same person standing in front of the camera. It is stricter than
 * the server's own threshold (0.5) on purpose: a different person is always recognized at once. Provisional until the
 * club has tried it with real faces.
 */
export const SAME_PERSON_DISTANCE = 0.4;

/** How long the same person is not announced again, so one visit does not fill the entry log with duplicates. */
export const SAME_PERSON_WINDOW_MS = 30_000;

/** Euclidean distance between two descriptors; infinite when they cannot be compared. */
export function descriptorDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let index = 0; index < a.length; index += 1) sum += (a[index]! - b[index]!) ** 2;
  return Math.sqrt(sum);
}

/**
 * Remembers the last person who was recognized and says whether a new descriptor is that same person within the
 * window. The client asks it BEFORE calling the server, so a repeat never reaches the entry log.
 */
export function createRepeatGuard({
  now = Date.now,
  maxDistance = SAME_PERSON_DISTANCE,
  windowMs = SAME_PERSON_WINDOW_MS,
}: { now?: () => number; maxDistance?: number; windowMs?: number } = {}) {
  let last: { descriptor: readonly number[]; at: number } | undefined;
  return {
    isRepeat(descriptor: readonly number[]): boolean {
      return last !== undefined && now() - last.at < windowMs && descriptorDistance(last.descriptor, descriptor) < maxDistance;
    },
    /** Call it after somebody was recognized; it replaces the previous person and restarts the window. */
    remember(descriptor: readonly number[]): void {
      last = { descriptor: [...descriptor], at: now() };
    },
  };
}
