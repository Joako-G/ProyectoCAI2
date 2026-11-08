// A port owned by the members module so that other modules (face profiles) can react to a deactivation without
// members importing them or any database. The server wires it; a failing listener never undoes the deactivation.
export interface MemberLifecycle {
  onMemberDeactivated(memberId: string, actorId: string): Promise<void>;
}
