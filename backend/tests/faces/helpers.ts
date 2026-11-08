import type { FaceProfileInput, FaceRepository } from '../../src/modules/faces/face.repository.js';

/** A valid 128-number descriptor; the value is distinctive so a test can prove it never leaks. */
export function descriptor(value = 0.4242424242, length = 128): number[] {
  return Array.from({ length }, () => value);
}

/** An in-memory repository with the same observable behavior as the PostgreSQL one. */
export function createFakeFaceRepository() {
  const profiles = new Map<string, FaceProfileInput>();
  const repository: FaceRepository = {
    upsert: async (profile) => {
      const existed = profiles.has(profile.memberId);
      profiles.set(profile.memberId, { ...profile, descriptor: [...profile.descriptor] });
      return existed ? 'updated' : 'created';
    },
    remove: async (memberId) => profiles.delete(memberId),
    findEnrollment: async (memberId) => {
      const found = profiles.get(memberId);
      return found ? { enrolledAt: found.enrolledAt } : undefined;
    },
    nearest: async (query) => {
      let best: { memberId: string; distance: number } | undefined;
      for (const profile of profiles.values()) {
        const distance = Math.sqrt(profile.descriptor.reduce((sum, value, index) => sum + (value - query[index]!) ** 2, 0));
        if (!best || distance < best.distance) best = { memberId: profile.memberId, distance };
      }
      return best;
    },
  };
  return { repository, profiles };
}
