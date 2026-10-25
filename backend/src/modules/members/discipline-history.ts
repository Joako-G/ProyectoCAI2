// Port owned by the members module: lets another module keep a dated history of each member's
// disciplines without members importing it. Member.disciplineIds stays the single editable source.
export interface DisciplineHistory {
  // `date` is the club-local calendar date (YYYY-MM-DD) of the change.
  onDisciplinesChanged(memberId: string, disciplineIds: readonly string[], date: string): Promise<void>;
}
