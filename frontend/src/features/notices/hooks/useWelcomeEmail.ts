import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../members/services/members-api';
import { fetchWelcomeNotice, sendWelcomeEmail } from '../services/notices-api';
import type { EmailLastSend } from '../types/notice';

export type WelcomeEmailState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  /** `at` is missing when the server only said the email was already sent. */
  | { phase: 'sent'; maskedAddress: string; at?: string }
  /** A timeout or a lost connection: the message may already have arrived. */
  | { phase: 'uncertain' }
  /** The server is sending this payment's email right now (another screen or an earlier click). */
  | { phase: 'inProgress' }
  | { phase: 'failed' };

function initialState(lastSend?: EmailLastSend): WelcomeEmailState {
  if (lastSend?.status === 'sent') return { phase: 'sent', maskedAddress: lastSend.to, at: lastSend.at };
  if (lastSend?.status === 'uncertain') return { phase: 'uncertain' };
  if (lastSend?.status === 'sending') return { phase: 'inProgress' };
  return { phase: 'idle' };
}

/**
 * Sends the welcome email on demand. Nothing is sent until `send` is called, and a failure never throws: it is a state
 * to retry from. It starts from the last send the server knows, so a remounted screen does not offer a second send.
 */
export function useWelcomeEmail(paymentId: string, maskedAddress: string, lastSend?: EmailLastSend) {
  const [state, setState] = useState<WelcomeEmailState>(() => initialState(lastSend));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const send = useCallback(
    (resend = false) => {
      setState({ phase: 'sending' });
      sendWelcomeEmail(paymentId, { resend })
        .then((result) => {
          if (mounted.current) setState({ phase: 'sent', maskedAddress: result.maskedAddress, at: result.sentAt });
        })
        .catch((error: unknown) => {
          if (!mounted.current) return;
          if (error instanceof ApiError && error.code === 'mail_send_in_progress') setState({ phase: 'inProgress' });
          // The 409 says a send exists, not how it ended: ask the welcome for the state the server holds (sent or uncertain).
          else if (error instanceof ApiError && error.code === 'mail_already_sent') {
            fetchWelcomeNotice(paymentId).then(
              (notice) => {
                const known = notice.email?.available ? notice.email.lastSend : undefined;
                if (mounted.current) setState(known ? initialState(known) : { phase: 'sent', maskedAddress });
              },
              () => {
                if (mounted.current) setState({ phase: 'sent', maskedAddress });
              },
            );
          }
          else if (error instanceof ApiError && error.code === 'mail_send_uncertain') setState({ phase: 'uncertain' });
          // The client gave up waiting: the server may still have sent it.
          else if (error instanceof DOMException && error.name === 'AbortError') setState({ phase: 'uncertain' });
          else setState({ phase: 'failed' });
        });
    },
    [paymentId, maskedAddress],
  );

  return { state, send };
}
