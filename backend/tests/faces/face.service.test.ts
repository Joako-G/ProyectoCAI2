import { describe, expect, it, vi } from 'vitest';
import type { AccessCheck } from '../../src/modules/access/access.types.js';
import { createFaceService, RECOGNITION_MAX_DISTANCE } from '../../src/modules/faces/face.service.js';
import { ConflictError, NotFoundError } from '../../src/shared/errors.js';
import { createFakeFaceRepository, descriptor } from './helpers.js';

const NOW = new Date('2026-11-07T15:00:00.000Z');
const green: AccessCheck = { result: 'green', reason: 'up_to_date', member: { memberNumber: '0001', name: 'Ana Prueba', unpaidPeriodCount: 0 } };

function setup(options: { memberStatus?: 'active' | 'inactive'; access?: AccessCheck } = {}) {
  const { repository, profiles } = createFakeFaceRepository();
  const members = {
    getById: vi.fn(async (id: string) => {
      if (id === 'missing') throw new NotFoundError('Member not found');
      return { id, status: options.memberStatus ?? ('active' as const) };
    }),
  };
  const access = { checkMember: vi.fn(async (_id: string) => options.access ?? green) };
  const audit = { record: vi.fn(async (_input: unknown) => undefined) };
  const service = createFaceService({ repository, members, access, audit, now: () => NOW });
  return { service, repository, profiles, members, access, audit };
}

describe('enroll', () => {
  it('stores the descriptor with the consent time and the staff member, and audits a create', async () => {
    const { service, profiles, audit } = setup();
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    expect(profiles.get('m1')).toMatchObject({ memberId: 'm1', consentedAt: NOW.toISOString(), consentedBy: 'user-1', enrolledAt: NOW.toISOString() });
    expect(audit.record).toHaveBeenCalledWith({ actorId: 'user-1', action: 'create', entityType: 'face_profile', entityId: 'm1' });
  });

  it('audits an update when the member is enrolled again', async () => {
    const { service, audit } = setup();
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    await service.enroll('m1', { descriptor: descriptor(0.2) }, 'user-2');
    expect(audit.record).toHaveBeenLastCalledWith({ actorId: 'user-2', action: 'update', entityType: 'face_profile', entityId: 'm1' });
  });

  it('refuses an unknown member and writes nothing', async () => {
    const { service, profiles, audit } = setup();
    await expect(service.enroll('missing', { descriptor: descriptor() }, 'user-1')).rejects.toBeInstanceOf(NotFoundError);
    expect(profiles.size).toBe(0);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses an inactive member and writes nothing', async () => {
    const { service, profiles, audit } = setup({ memberStatus: 'inactive' });
    await expect(service.enroll('m1', { descriptor: descriptor() }, 'user-1')).rejects.toBeInstanceOf(ConflictError);
    expect(profiles.size).toBe(0);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('audits no personal data: the entry never holds the descriptor', async () => {
    const { service, audit } = setup();
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain('0.4242424242');
  });
});

describe('remove', () => {
  it('deletes the profile and audits a delete', async () => {
    const { service, profiles, audit } = setup();
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    await service.remove('m1', 'user-2');
    expect(profiles.size).toBe(0);
    expect(audit.record).toHaveBeenLastCalledWith({ actorId: 'user-2', action: 'delete', entityType: 'face_profile', entityId: 'm1' });
  });

  it('answers not found, without an audit entry, when nothing was enrolled', async () => {
    const { service, audit } = setup();
    await expect(service.remove('m1', 'user-1')).rejects.toBeInstanceOf(NotFoundError);
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('status', () => {
  it('says whether a face is enrolled and when, never the descriptor', async () => {
    const { service } = setup();
    expect(await service.status('m1')).toEqual({ enrolled: false });
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    expect(await service.status('m1')).toEqual({ enrolled: true, enrolledAt: NOW.toISOString() });
  });
});

describe('recognize', () => {
  it('returns exactly the access answer of the nearest member within the threshold', async () => {
    const { service, access } = setup();
    await service.enroll('m1', { descriptor: descriptor(0.1) }, 'user-1');
    await service.enroll('m2', { descriptor: descriptor(0.9) }, 'user-1');
    expect(await service.recognize(descriptor(0.1001))).toEqual(green);
    expect(access.checkMember).toHaveBeenCalledWith('m1');
  });

  it('accepts a distance exactly at the threshold', async () => {
    const { service, repository, access } = setup();
    vi.spyOn(repository, 'nearest').mockResolvedValue({ memberId: 'm1', distance: RECOGNITION_MAX_DISTANCE });
    expect(await service.recognize(descriptor())).toEqual(green);
    expect(access.checkMember).toHaveBeenCalledWith('m1');
  });

  it('answers not recognized beyond the threshold, without checking access or naming anyone', async () => {
    const { service, repository, access } = setup();
    vi.spyOn(repository, 'nearest').mockResolvedValue({ memberId: 'm1', distance: RECOGNITION_MAX_DISTANCE + 0.01 });
    const answer = await service.recognize(descriptor());
    expect(answer).toEqual({ result: 'red', reason: 'not_recognized' });
    expect(access.checkMember).not.toHaveBeenCalled();
  });

  it('answers not recognized when nobody is enrolled', async () => {
    const { service } = setup();
    expect(await service.recognize(descriptor())).toEqual({ result: 'red', reason: 'not_recognized' });
  });

  it('answers not recognized when the matched member no longer exists', async () => {
    const { service } = setup({ access: { result: 'red', reason: 'not_found' } });
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    expect(await service.recognize(descriptor())).toEqual({ result: 'red', reason: 'not_recognized' });
  });

  it('writes nothing', async () => {
    const { service, audit, repository } = setup();
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    audit.record.mockClear();
    const upsert = vi.spyOn(repository, 'upsert');
    await service.recognize(descriptor());
    expect(audit.record).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('discardForDeactivatedMember', () => {
  it('deletes the profile and audits it as the staff member who deactivated', async () => {
    const { service, profiles, audit } = setup();
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    await service.discardForDeactivatedMember('m1', 'user-2');
    expect(profiles.size).toBe(0);
    expect(audit.record).toHaveBeenLastCalledWith({ actorId: 'user-2', action: 'delete', entityType: 'face_profile', entityId: 'm1' });
  });

  it('does nothing, quietly, when the member had no face profile', async () => {
    const { service, audit } = setup();
    await expect(service.discardForDeactivatedMember('m1', 'user-2')).resolves.toBeUndefined();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('recognize an inactive member', () => {
  it('never matches: it answers not_recognized and names nobody', async () => {
    const inactive: AccessCheck = { result: 'red', reason: 'inactive', member: { memberNumber: '0002', name: 'Baja Prueba', unpaidPeriodCount: 0 } };
    const { service } = setup({ access: inactive });
    await service.enroll('m1', { descriptor: descriptor() }, 'user-1');
    expect(await service.recognize(descriptor())).toEqual({ result: 'red', reason: 'not_recognized' });
  });
});
