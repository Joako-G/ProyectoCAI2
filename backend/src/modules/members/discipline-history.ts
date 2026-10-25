// Port owned by the members module: lets another module keep a dated history of each member's
// disciplines without members importing it. Member.disciplineIds stays the single editable source.
//
// It is called on EVERY member save (create or update), not only when the disciplines changed, with the
// member's current disciplines, so implementations must be idempotent. Calls for one member are serialized.
export interface DisciplineHistory {
  // `date` is the club-local calendar date (YYYY-MM-DD) the member's disciplines last changed.
  onDisciplinesChanged(memberId: string, disciplineIds: readonly string[], date: string): Promise<void>;
}
