import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { disciplinesFilePath, membersFilePath, pricingConfigFilePath } from '../../src/config/paths.js';

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

describe('pricingConfigFilePath', () => {
  it('defaults to backend/data/pricing-config.json when PRICING_CONFIG_FILE is unset', () => {
    expect(pricingConfigFilePath({})).toBe(resolve(__dirname, '../../data/pricing-config.json'));
  });

  it('passes an absolute PRICING_CONFIG_FILE through and resolves a relative one against the cwd', () => {
    const absolute = resolve('/var/club/pricing-config.json');
    expect(pricingConfigFilePath({ PRICING_CONFIG_FILE: absolute })).toBe(absolute);
    expect(pricingConfigFilePath({ PRICING_CONFIG_FILE: 'tmp/p.json' })).toBe(resolve(process.cwd(), 'tmp/p.json'));
  });
});
