import { useEffect, useState } from 'react';
import { fetchHistory } from '../../payments/services/payments-api';
import type { Payment } from '../../payments/types/payment';
import { describeReadError } from '../../payments/utils/payment-format';

export type MemberPaymentHistoryState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; payments: Payment[] };

/**
 * Reads a member's payments (`GET /api/payments/members/:id`, through the payments service) for the history of the
 * record. The caller mounts it only for users who hold `payments:read`; a failed read is reported in the state and
 * never throws.
 */
export function useMemberPaymentHistory(memberId: string): MemberPaymentHistoryState {
  const [state, setState] = useState<MemberPaymentHistoryState>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    setState({ phase: 'loading' });
    fetchHistory(memberId, controller.signal).then(
      (payments) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', payments });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ phase: 'error', message: describeReadError(error) });
      },
    );
    return () => controller.abort();
  }, [memberId]);

  return state;
}
