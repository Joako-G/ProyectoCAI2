import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../shared/errors.js';
import { activeDisciplineIdsForPeriod } from './membership.period.js';
import type { MembershipRepository } from './membership.repository.js';
import type { MemberDisciplines, Membership, MembershipListQuery } from './membership.types.js';

export interface MembershipServiceDeps {
  repository: MembershipRepository;
  now?: () => Date;
}

const REMOVED_REASON = 'Discipline removed from member';

function findIndex(memberships: Membership[], id: string): number {
  const index = memberships.findIndex((membership) => membership.id === id);
  if (index === -1) throw new NotFoundError('Membership not found');
  return index;
}

function compareByStartDate(a: Membership, b: Membership): number {
  return a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt);
}

export function createMembershipService({ repository, now = () => new Date() }: MembershipServiceDeps) {
  const timestamp = () => now().toISOString();

  async function list({ memberId, disciplineId, status }: MembershipListQuery = {}): Promise<Membership[]> {
    const memberships = await repository.list();
    return memberships
      .filter(
        (membership) =>
          (!memberId || membership.memberId === memberId) &&
          (!disciplineId || membership.disciplineId === disciplineId) &&
          (!status || membership.status === status),
      )
      .sort(compareByStartDate);
  }

  // Makes the member's active memberships match `disciplineIds`, in one atomic repository write:
  // opens one (starting `date`) for each listed discipline without an active one, and ends (on `date`)
  // each active one whose discipline is no longer listed. Idempotent for the same ids.
  async function syncMember(memberId: string, disciplineIds: readonly string[], date: string): Promise<void> {
    const wanted = new Set(disciplineIds);
    await repository.mutate((memberships) => {
      const at = timestamp();
      const active = new Set<string>();
      let changed = false;
      const next = memberships.map((membership) => {
        if (membership.memberId !== memberId || membership.status !== 'active') return membership;
        if (wanted.has(membership.disciplineId)) {
          active.add(membership.disciplineId);
          return membership;
        }
        changed = true;
        // Never end a membership before it started (e.g. one backfilled or opened with a later date).
        const endDate = date < membership.startDate ? membership.startDate : date;
        return { ...membership, status: 'ended' as const, endDate, endReason: REMOVED_REASON, updatedAt: at };
      });
      const opened: Membership[] = [...wanted]
        .filter((disciplineId) => !active.has(disciplineId))
        .map((disciplineId) => ({
          id: randomUUID(),
          memberId,
          disciplineId,
          startDate: date,
          status: 'active' as const,
          createdAt: at,
          updatedAt: at,
        }));
      return { memberships: changed || opened.length > 0 ? [...next, ...opened] : memberships, result: undefined };
    });
  }

  return {
    syncMember,

    // Aligns the history with the members' current disciplines (used at startup, because the members
    // and memberships files cannot be written atomically together). A member with no history yet is
    // backfilled from their memberSince date; everyone else is synced as of the date their disciplines last
    // changed (disciplinesChangedOn), or `date` when that is unknown (legacy records).
    async reconcile(members: readonly MemberDisciplines[], date: string): Promise<void> {
      const withHistory = new Set((await repository.list()).map((membership) => membership.memberId));
      for (const member of members) {
        await syncMember(member.id, member.disciplineIds, withHistory.has(member.id) ? (member.disciplinesChangedOn ?? date) : member.memberSince);
      }
    },

    async getById(id: string): Promise<Membership> {
      const memberships = await repository.list();
      return memberships[findIndex(memberships, id)]!;
    },

    list,

    // For the payments module: disciplines a member owes for a month (YYYY-MM).
    async activeDisciplineIdsForPeriod(memberId: string, period: string): Promise<string[]> {
      return activeDisciplineIdsForPeriod(await repository.list(), memberId, period);
    },
  };
}

export type MembershipService = ReturnType<typeof createMembershipService>;
