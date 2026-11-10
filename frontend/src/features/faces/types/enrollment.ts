/** Mirrors `EnrollmentSessionView` in backend/src/modules/faces/face-enrollment.service.ts. */
export type EnrollmentStatus = 'waiting' | 'capturing' | 'completed' | 'cancelled' | 'failed' | 'expired';

export interface EnrollmentSession {
  id: string;
  memberId: string;
  firstName: string;
  status: EnrollmentStatus;
  /** The live guidance the public screen shows; empty until it reports one. */
  hint: string;
  captures: number;
  total: number;
  expiresAt: string;
  message?: string;
}

/** What the public screen reports: the hint and captures done, or that it cannot capture. */
export type EnrollmentProgressReport =
  | { status: 'capturing'; hint?: string; captures?: number }
  | { status: 'failed'; message?: string };

/** The session is over when it is not waiting for or taking captures any more. */
export const isEnrollmentActive = (status: EnrollmentStatus): boolean => status === 'waiting' || status === 'capturing';
