import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { disciplinesFilePath, membersFilePath } from '../../src/config/paths.js';

describe('membersFilePath', () => {
  it('defaults to backend/data/members.json when MEMBERS_FILE is unset', () => {
    expect(membersFilePath({})).toBe(resolve(__dirname, '../../data/members.json'));
  });

  it('passes an absolute MEMBERS_FILE through', () => {
    const absolute = resolve('/var/club/members.json');
    expect(membersFilePath({ MEMBERS_FILE: absolute })).toBe(absolute);
  });

  it('resolves a relative MEMBERS_FILE against the cwd', () => {
    expect(membersFilePath({ MEMBERS_FILE: 'tmp/members.json' })).toBe(resolve(process.cwd(), 'tmp/members.json'));
  });
});

describe('disciplinesFilePath', () => {
  it('defaults to backend/data/disciplines.json when DISCIPLINES_FILE is unset', () => {
    expect(disciplinesFilePath({})).toBe(resolve(__dirname, '../../data/disciplines.json'));
  });

  it('passes an absolute DISCIPLINES_FILE through', () => {
    const absolute = resolve('/var/club/disciplines.json');
    expect(disciplinesFilePath({ DISCIPLINES_FILE: absolute })).toBe(absolute);
  });

  it('resolves a relative DISCIPLINES_FILE against the cwd', () => {
    expect(disciplinesFilePath({ DISCIPLINES_FILE: 'tmp/d.json' })).toBe(resolve(process.cwd(), 'tmp/d.json'));
  });
});
