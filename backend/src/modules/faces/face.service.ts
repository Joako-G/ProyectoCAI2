import { ConflictError, NotFoundError } from '../../shared/errors.js';
import type { AccessCheck } from '../access/access.types.js';
import type { AuditRecorder } from '../audit/audit.service.js';
import type { FaceRepository } from './face.repository.js';

/**
 * The largest Euclidean distance between two descriptors that still counts as the same person. face-api.js
 * treats about 0.6 as typical for "same person", so 0.5 is deliberately stricter: a wrong green at the door is
 * worse than asking for the DNI. Provisional until the club has tried it with real faces.
 */
export const RECOGNITION_MAX_DISTANCE = 0.5;

// Ports owned by the faces module; the members and access services satisfy them as they are.
export interface FaceServiceDeps {
  repository: FaceRepository;
  members: { getById(id: string): Promise<{ id: string; status: 'active' | 'inactive' }> };
  access: { checkMember(memberId: string): Promise<AccessCheck> };
  audit: AuditRecorder;
  now?: () => Date;
}

// Said when nobody matches. It names no member and no distance, so it cannot be used to probe who is enrolled.
const NOT_RECOGNIZED: AccessCheck = { result: 'red', reason: 'not_recognized' };

export function createFaceService({ repository, members, access, audit, now = () => new Date() }: FaceServiceDeps) {
  return {
    // Staff confirmed the member's consent (the route requires `consent: true`); the time and the staff member are kept.
    async enroll(memberId: string, input: { descriptor: number[] }, actorId: string): Promise<void> {
      const member = await members.getById(memberId);
      if (member.status !== 'active') throw new ConflictError('Member is not active');
      const at = now().toISOString();
      const outcome = await repository.upsert({ memberId, descriptor: input.descriptor, consentedAt: at, consentedBy: actorId, enrolledAt: at });
      // The entry names the member and the action only: no descriptor and no personal data.
      await audit.record({ actorId, action: outcome === 'created' ? 'create' : 'update', entityType: 'face_profile', entityId: memberId });
    },

    async remove(memberId: string, actorId: string): Promise<void> {
      if (!(await repository.remove(memberId))) throw new NotFoundError('Face profile not found');
      await audit.record({ actorId, action: 'delete', entityType: 'face_profile', entityId: memberId });
    },

    // Biometric data must not outlive its purpose: when the members flow deactivates a member, the profile goes too.
    // It is quiet when there was none, and the audit entry names the staff member who deactivated.
    async discardForDeactivatedMember(memberId: string, actorId: string): Promise<void> {
      if (!(await repository.remove(memberId))) return;
      await audit.record({ actorId, action: 'delete', entityType: 'face_profile', entityId: memberId });
    },

    async status(memberId: string): Promise<{ enrolled: boolean; enrolledAt?: string }> {
      const found = await repository.findEnrollment(memberId);
      return found ? { enrolled: true, enrolledAt: found.enrolledAt } : { enrolled: false };
    },

    // Reads only: the answer is the access check of the nearest member, or red when nobody is close enough.
    async recognize(descriptor: number[]): Promise<AccessCheck> {
      const nearest = await repository.nearest(descriptor);
      if (!nearest || nearest.distance > RECOGNITION_MAX_DISTANCE) return NOT_RECOGNIZED;
      const answer = await access.checkMember(nearest.memberId);
      // A profile whose member no longer exists, or who is inactive, is a leftover, not a person the door can name.
      return answer.reason === 'not_found' || answer.reason === 'inactive' ? NOT_RECOGNIZED : answer;
    },
  };
}

export type FaceService = ReturnType<typeof createFaceService>;
