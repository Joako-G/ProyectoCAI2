import { describe, expect, it } from 'vitest';
import type { AccessCheck } from '../types/access';
import { greetingFromCheck } from './greeting-from-check';

const AT = '2026-11-08T15:00:00.000Z';

describe('greetingFromCheck', () => {
  it('marks the method it is given: a DNI check typed at the desk is a dni event', () => {
    const check: AccessCheck = { result: 'green', reason: 'up_to_date', member: { memberNumber: '1', name: 'Ana Prueba', unpaidPeriodCount: 0 } };
    expect(greetingFromCheck(check, AT, 'dni').method).toBe('dni');
    expect(greetingFromCheck(check, AT).method).toBe('face');
  });

  it('turns an up to date answer into the event the stream would have sent', () => {
    const check: AccessCheck = {
      result: 'green',
      reason: 'up_to_date',
      member: { memberNumber: '1042', name: 'Valentina Ríos', unpaidPeriodCount: 0, paidThrough: '2026-12', dueDate: '2027-01-10' },
    };
    expect(greetingFromCheck(check, AT)).toEqual({
      at: AT,
      tone: 'welcome',
      kind: 'up_to_date',
      method: 'face',
      firstName: 'Valentina',
      member: { id: '1042', memberNumber: '1042', fullName: 'Valentina Ríos', firstName: 'Valentina', disciplines: [] },
      paidThrough: '2026-12',
      dueDate: '2027-01-10',
      unpaidPeriodCount: 0,
    });
  });

  it('maps yellow to see_desk with the month of the debt, and red to refused', () => {
    const debtor = greetingFromCheck({ result: 'yellow', reason: 'debtor', member: { memberNumber: '7', name: 'Mateo Quiroga', unpaidPeriodCount: 2, debtSince: '2026-09' } }, AT);
    expect(debtor).toMatchObject({ tone: 'see_desk', kind: 'debtor', firstName: 'Mateo', debtSince: '2026-09', unpaidPeriodCount: 2 });
    const inactive = greetingFromCheck({ result: 'red', reason: 'inactive', member: { memberNumber: '8', name: 'Camila Sosa', unpaidPeriodCount: 0 } }, AT);
    expect(inactive).toMatchObject({ tone: 'refused', kind: 'inactive' });
    expect(inactive.firstName).toBeUndefined();
  });

  it('carries no member for a face nobody matched', () => {
    expect(greetingFromCheck({ result: 'red', reason: 'not_recognized' }, AT)).toEqual({ at: AT, tone: 'refused', kind: 'not_recognized', method: 'face' });
  });
});
