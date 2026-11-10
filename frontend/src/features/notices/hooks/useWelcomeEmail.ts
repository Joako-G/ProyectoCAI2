import { useCallback, useEffect, useRef, useState } from 'react';
import { sendWelcomeEmail } from '../services/notices-api';

export type WelcomeEmailState = { phase: 'idle' } | { phase: 'sending' } | { phase: 'sent'; maskedAddress: string } | { phase: 'failed' };

/** Sends the welcome email on demand. Nothing is sent until `send` is called, and a failure never throws: it is a state to retry from. */
export function useWelcomeEmail(paymentId: string) {
  const [state, setState] = useState<WelcomeEmailState>({ phase: 'idle' });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const send = useCallback(() => {
    setState({ phase: 'sending' });
    sendWelcomeEmail(paymentId)
      .then((result) => {
        if (mounted.current) setState({ phase: 'sent', maskedAddress: result.maskedAddress });
      })
      .catch(() => {
        if (mounted.current) setState({ phase: 'failed' });
      });
  }, [paymentId]);

  return { state, send };
}
