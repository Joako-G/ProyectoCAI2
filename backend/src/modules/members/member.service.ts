import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { toIsoDate } from '../../shared/date.js';
import type { DisciplineHistory } from './discipline-history.js';
import type { DisciplineLookup } from './discipline-lookup.js';
import type { MemberRepository } from './member.repository.js';
import type { Member, MemberInput, MemberListQuery } from './member.types.js';
import { assertDisciplinesAssignable, validateMemberInput } from './member.validation.js';

export interface MemberServiceDeps {
  repository: MemberRepository;
  disciplineLookup: DisciplineLookup;
  // Optional: when absent, discipline changes are simply not recorded anywhere else.
  disciplineHistory?: DisciplineHistory;
  now?: () => Date;
}

const DNI_QUERY = /^[\d.\s-]+$/;
const BARE_DIGITS_QUERY = /^\d+$/;
const MIN_DNI_DIGITS_WITHOUT_SEPARATORS = 5;

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// A bare digit query of any length matches a member number by value (exact, leading zeros ignored:
// "7" = "0007", "10000" = "10000"), so numbers past 9999 stay searchable. It additionally searches DNIs only
// from 5 digits on, or when separated ("30.1"), so a short number never matches every DNI containing it.
function matchesNumber(member: Member, query: string): boolean {
  return BARE_DIGITS_QUERY.test(query) && Number(query) === Number(member.memberNumber);
}

function matchesDni(member: Member, query: string): boolean {
  if (!DNI_QUERY.test(query)) return false;
  const digits = query.replace(/\D/g, '');
  const bare = BARE_DIGITS_QUERY.test(query);
  if (digits === '' || (bare && digits.length < MIN_DNI_DIGITS_WITHOUT_SEPARATORS)) return false;
  return member.dni.includes(digits);
}

function matchesSearch(member: Member, search: string): boolean {
  const query = fold(search.trim());
  if (!query) return true;
  const first = fold(member.firstName);
  const last = fold(member.lastName);
  return (
    `${first} ${last}`.includes(query) ||
    `${last} ${first}`.includes(query) ||
    matchesNumber(member, query) ||
    matchesDni(member, query)
  );
}

function compareByName(a: Member, b: Member): number {
  return (
    fold(a.lastName).localeCompare(fold(b.lastName)) || fold(a.firstName).localeCompare(fold(b.firstName))
  );
}

function nextMemberNumber(members: Member[]): string {
  const highest = members.reduce((max, member) => {
    const number = Number(member.memberNumber);
    return Number.isInteger(number) && number >= 0 ? Math.max(max, number) : max;
  }, 0);
  return String(highest + 1).padStart(4, '0');
}

function findIndex(members: Member[], id: string): number {
  const index = members.findIndex((member) => member.id === id);
  if (index === -1) throw new NotFoundError('Member not found');
  return index;
}

function assertDniAvailable(members: Member[], dni: string, ownId?: string): void {
  if (members.some((member) => member.dni === dni && member.id !== ownId)) {
    throw new ConflictError('A member with this DNI already exists');
  }
}

function replaceAt(members: Member[], index: number, member: Member): Member[] {
  return members.map((current, i) => (i === index ? member : current));
}

export function createMemberService({
  repository,
  disciplineLookup,
  disciplineHistory,
  now = () => new Date(),
}: MemberServiceDeps) {
  const timestamp = () => now().toISOString();
  const today = () => toIsoDate(now());

  // Runs only after the member write succeeded. The two JSON files cannot be written together, so a
  // failure here is logged, not raised: the member is saved and the startup reconcile repairs the history.
  async function recordDisciplines(member: Member): Promise<Member> {
    try {
      await disciplineHistory?.onDisciplinesChanged(member.id, member.disciplineIds, today());
    } catch (error) {
      console.error('Could not record the discipline history of member', member.id, error);
    }
    return member;
  }

  return {
    async create(raw: MemberInput): Promise<Member> {
      const input = validateMemberInput(raw, today());
      assertDisciplinesAssignable(input.disciplineIds, await disciplineLookup.findByIds(input.disciplineIds));
      const created = await repository.mutate((members) => {
        assertDniAvailable(members, input.dni);
        const at = timestamp();
        const member: Member = {
          ...input,
          id: randomUUID(),
          memberNumber: nextMemberNumber(members),
          status: 'active',
          createdAt: at,
          updatedAt: at,
        };
        return { members: [...members, member], result: member };
      });
      return recordDisciplines(created);
    },

    async update(id: string, raw: MemberInput): Promise<Member> {
      const input = validateMemberInput(raw, today());
      const found = await disciplineLookup.findByIds(input.disciplineIds);
      const updated = await repository.mutate((members) => {
        const index = findIndex(members, id);
        assertDisciplinesAssignable(input.disciplineIds, found, members[index]!.disciplineIds);
        assertDniAvailable(members, input.dni, id);
        const { email: _email, guardian: _guardian, ...current } = members[index]!;
        const member: Member = { ...current, ...input, updatedAt: timestamp() };
        return { members: replaceAt(members, index, member), result: member };
      });
      return recordDisciplines(updated);
    },

    async deactivate(id: string, reason: string): Promise<Member> {
      const trimmed = typeof reason === 'string' ? reason.trim() : '';
      if (!trimmed) throw new ValidationError({ reason: 'Reason is required' });
      return repository.mutate((members) => {
        const index = findIndex(members, id);
        const current = members[index]!;
        if (current.status === 'inactive') throw new ConflictError('Member is already inactive');
        const member: Member = {
          ...current,
          status: 'inactive',
          deactivation: { date: today(), reason: trimmed },
          updatedAt: timestamp(),
        };
        return { members: replaceAt(members, index, member), result: member };
      });
    },

    async reactivate(id: string): Promise<Member> {
      return repository.mutate((members) => {
        const index = findIndex(members, id);
        const { deactivation: _deactivation, ...current } = members[index]!;
        if (current.status === 'active') throw new ConflictError('Member is already active');
        const member: Member = { ...current, status: 'active', updatedAt: timestamp() };
        return { members: replaceAt(members, index, member), result: member };
      });
    },

    async getById(id: string): Promise<Member> {
      const members = await repository.list();
      return members[findIndex(members, id)]!;
    },

    async list({ search = '', status, disciplineId }: MemberListQuery = {}): Promise<Member[]> {
      const members = await repository.list();
      return members
        .filter(
          (member) =>
            (!status || member.status === status) &&
            (!disciplineId || member.disciplineIds.includes(disciplineId)) &&
            matchesSearch(member, search),
        )
        .sort(compareByName);
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
