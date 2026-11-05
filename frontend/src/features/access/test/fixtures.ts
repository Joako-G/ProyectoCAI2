import type { AccessCheck } from '../types/access';

export function buildAccessCheck(overrides: Partial<AccessCheck> = {}): AccessCheck {
  return {
    result: 'green',
    reason: 'up_to_date',
    member: { memberNumber: '101', name: 'Lucía Prueba', unpaidPeriodCount: 0 },
    ...overrides,
  };
}
