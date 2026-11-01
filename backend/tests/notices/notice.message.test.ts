import { describe, expect, it } from 'vitest';
import { buildDebtMessage } from '../../src/modules/notices/notice.message.js';

const base = {
  clubName: 'Club Independiente',
  memberName: 'Tomás Gómez',
  addressee: { kind: 'member' as const, name: 'Tomás Gómez' },
  unpaidPeriods: ['2026-08', '2026-09'],
  total: 43000,
  asOf: '2026-11-01',
};

describe('buildDebtMessage', () => {
  it('greets the member, names the club, lists the unpaid months and states the total as of today', () => {
    const message = buildDebtMessage(base);
    expect(message).toContain('Hola Tomás Gómez');
    expect(message).toContain('Club Independiente');
    expect(message).toContain('agosto de 2026');
    expect(message).toContain('septiembre de 2026');
    expect(message).toContain('$ 43.000');
    expect(message).toContain('01/11/2026');
  });

  it('says the amount can change with the payment date', () => {
    expect(buildDebtMessage(base)).toMatch(/puede (cambiar|variar)/);
  });

  it('writes to the guardian about the member when the guardian is the addressee', () => {
    const message = buildDebtMessage({ ...base, addressee: { kind: 'guardian', name: 'Ana Gómez' } });
    expect(message).toContain('Hola Ana Gómez');
    expect(message).toContain('Tomás Gómez');
    expect(message).toMatch(/a cargo de|de Tomás Gómez/);
  });

  it('uses the singular for one month', () => {
    const message = buildDebtMessage({ ...base, unpaidPeriods: ['2026-10'] });
    expect(message).toContain('octubre de 2026');
    expect(message).not.toContain('y octubre');
  });

  it('joins three months with commas and a final "y"', () => {
    const message = buildDebtMessage({ ...base, unpaidPeriods: ['2026-07', '2026-08', '2026-09'] });
    expect(message).toContain('julio de 2026, agosto de 2026 y septiembre de 2026');
  });

  it('does not mention re-registration', () => {
    expect(buildDebtMessage({ ...base, unpaidPeriods: ['2026-05', '2026-06', '2026-07', '2026-08'] })).not.toMatch(/reinscrib|reinscrip|baja/i);
  });
});
