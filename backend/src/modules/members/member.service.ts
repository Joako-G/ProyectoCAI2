import { randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import type { MemberRepository } from './member.repository.js';
import type { Member, MemberInput, MemberListQuery } from './member.types.js';
import { toIsoDate, validateMemberInput } from './member.validation.js';

export interface MemberServiceDeps {
  repository: MemberRepository;
  now?: () => Date;
}

const DNI_QUERY = /^[\d.\s-]+$/;
const MEMBER_NUMBER_QUERY = /^\d{1,4}$/;
const MIN_DNI_DIGITS_WITHOUT_SEPARATORS = 5;

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// A bare 1-4 digit query is a member number (exact, leading zeros ignored: "7" = "0007"). Longer bare
// numbers and separated ones ("30.1") search DNIs, so a short number never matches every DNI containing it.
function matchesNumber(member: Member, query: string): boolean {
  return MEMBER_NUMBER_QUERY.test(query) && Number(query) === Number(member.memberNumber);
}

function matchesDni(member: Member, query: string): boolean {
  if (!DNI_QUERY.test(query)) return false;
  const digits = query.replace(/\D/g, '');
  const bare = /^\d+$/.test(query);
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

export function createMemberService({ repository, now = () => new Date() }: MemberServiceDeps) {
  const timestamp = () => now().toISOString();
  const today = () => toIsoDate(now());

  return {
    async create(raw: MemberInput): Promise<Member> {
      const input = validateMemberInput(raw, today());
      return repository.mutate((members) => {
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
    },

    async update(id: string, raw: MemberInput): Promise<Member> {
      const input = validateMemberInput(raw, today());
      return repository.mutate((members) => {
        const index = findIndex(members, id);
        assertDniAvailable(members, input.dni, id);
        const { email: _email, guardian: _guardian, ...current } = members[index]!;
        const member: Member = { ...current, ...input, updatedAt: timestamp() };
        return { members: replaceAt(members, index, member), result: member };
      });
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

    async list({ search = '', status }: MemberListQuery = {}): Promise<Member[]> {
      const members = await repository.list();
      return members
        .filter((member) => (!status || member.status === status) && matchesSearch(member, search))
        .sort(compareByName);
    },
  };
}

export type MemberService = ReturnType<typeof createMemberService>;
