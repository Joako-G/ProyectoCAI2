import { FormEvent, useState } from 'react';
import { login } from '../services/auth-api';
import type { AuthUser, LoginStatus } from '../types/auth';

/** Owns the login form values and submission status; reports the signed-in user through `onSuccess`. */
export function useLogin(onSuccess: (user: AuthUser) => void) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<LoginStatus>('idle');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus('pending');
    try {
      const user = await login(email, password);
      setPassword(''); setStatus('idle');
      onSuccess(user);
    } catch { setStatus('error'); }
  }

  return { email, setEmail, password, setPassword, status, submit };
}
