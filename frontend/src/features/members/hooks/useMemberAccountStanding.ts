import { useEffect, useState } from 'react';
import { fetchAccount } from '../../payments/services/payments-api';
import type { MemberAccount } from '../../payments/types/payment';
import { describeReadError } from '../../payments/utils/payment-format';

export type MemberAccountStandingState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; account: MemberAccount };

/**
 * Reads a member's account (`GET /api/payments/members/:id/account`, through the payments service) for the "Cuenta"
 * card of the record. Only the account: the payment history Cobros also loads is not needed here. The caller mounts
 * it only for users who hold `payments:read`; a failed read is reported in the state and never throws.
 */
export function useMemberAccountStanding(memberId: string): MemberAccountStandingState {
  const [state, setState] = useState<MemberAccountStandingState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    fetchAccount(memberId, controller.signal).then(
      (account) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', account });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeReadError(error) });
      },
    );
    return () => controller.abort();
  }, [memberId]);

  return state;
}
