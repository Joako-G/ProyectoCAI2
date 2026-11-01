import type { Role as RoleName } from '../../src/modules/users/user.types.js';

export const both: readonly RoleName[] = ['head_secretary', 'secretary'];
export const headOnly: readonly RoleName[] = ['head_secretary'];
export const teacherOnly: readonly RoleName[] = ['teacher'];

/** Every route the API serves, with the roles allowed past the authorization layer, as [method, path, roles]. A new route must be added here. */
export const routes: Array<[string, string, readonly RoleName[]]> = [
  ['GET', '/users', headOnly],
  ['POST', '/users', headOnly],
  ['PATCH', '/users/missing', headOnly],
  ['DELETE', '/users/missing', headOnly],
  ['GET', '/api/members', both],
  ['GET', '/api/members/missing', both],
  ['POST', '/api/members', both],
  ['PUT', '/api/members/missing', both],
  ['POST', '/api/members/missing/deactivate', both],
  ['POST', '/api/members/missing/reactivate', both],
  ['GET', '/api/disciplines', both],
  ['GET', '/api/disciplines/missing', both],
  ['POST', '/api/disciplines', headOnly],
  ['PUT', '/api/disciplines/missing', headOnly],
  ['POST', '/api/disciplines/missing/deactivate', headOnly],
  ['POST', '/api/disciplines/missing/reactivate', headOnly],
  ['GET', '/api/memberships', both],
  ['GET', '/api/memberships/missing', both],
  ['GET', '/api/roster', teacherOnly],
  ['GET', '/api/pricing', both],
  ['POST', '/api/pricing/tariffs', headOnly],
  ['PUT', '/api/pricing/tariffs/2030-01', headOnly],
  ['DELETE', '/api/pricing/tariffs/2030-01', headOnly],
  ['PUT', '/api/pricing/surcharge-tiers', headOnly],
  ['PUT', '/api/pricing/proration-rule', headOnly],
  ['GET', '/api/payments/members/missing/account', both],
  ['GET', '/api/payments/members/missing', both],
  ['GET', '/api/payments/receipts/1', both],
  ['POST', '/api/payments/preview', both],
  ['POST', '/api/payments/enrollment-preview', both],
  ['POST', '/api/payments', both],
  ['POST', '/api/payments/missing/annul', headOnly],
  ['GET', '/api/reports/revenue', both],
  ['GET', '/api/reports/discipline-settlement', both],
  ['GET', '/api/notices/debt', both],
  ['GET', '/api/cashcount/today', headOnly],
  ['GET', '/api/cashcount', headOnly],
  ['POST', '/api/cashcount', headOnly],
  ['GET', '/api/audit', headOnly],
];
