/** What is stored for one member. The descriptor leaves the repository only as a distance, never as data. */
export interface FaceProfileInput {
  memberId: string;
  descriptor: readonly number[];
  /** ISO instant at which the staff member recorded the consent. */
  consentedAt: string;
  /** Id of the staff user who recorded it. */
  consentedBy: string;
  /** ISO instant. */
  enrolledAt: string;
}

/** The persistence contract of the faces module; the PostgreSQL adapter implements it. */
export interface FaceRepository {
  /** Creates or replaces the member's profile and says which. */
  upsert(profile: FaceProfileInput): Promise<'created' | 'updated'>;
  /** Deletes the profile, descriptor included; false when there was none. */
  remove(memberId: string): Promise<boolean>;
  /** When the member was enrolled, or undefined. Never the descriptor. */
  findEnrollment(memberId: string): Promise<{ enrolledAt: string } | undefined>;
  /** The profile closest to the descriptor by Euclidean distance, or undefined when nobody is enrolled. */
  nearest(descriptor: readonly number[]): Promise<{ memberId: string; distance: number } | undefined>;
}
