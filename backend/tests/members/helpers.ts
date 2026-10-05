import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJsonMemberRepository } from '../../src/modules/members/json-member.repository.js';
import { createMemberService } from '../../src/modules/members/member.service.js';
import type { MemberInput } from '../../src/modules/members/member.types.js';

export const TODAY = new Date('2026-10-05T15:00:00Z');

export const adultInput: MemberInput = {
  firstName: 'Lucía',
  lastName: 'Ríos',
  dni: '30.123.456',
  birthDate: '1990-03-15',
  category: 'Mayor',
  memberSince: '2015-02-01',
  whatsapp: '+54 9 11 5555-1234',
};

export const minorInput: MemberInput = {
  firstName: 'Tomás',
  lastName: 'Gómez',
  dni: '50111222',
  birthDate: '2015-06-10',
  category: 'Infantil',
  memberSince: '2022-03-01',
  whatsapp: '1155551111',
  guardian: { name: 'Ana Gómez', contact: '1155552222' },
};

export async function createTestContext(now: () => Date = () => TODAY) {
  const dir = await mkdtemp(join(tmpdir(), 'members-'));
  const repository = createJsonMemberRepository(join(dir, 'members.json'));
  const service = createMemberService({ repository, now });
  return { service, repository, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
