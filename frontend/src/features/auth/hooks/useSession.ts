import { useCallback, useEffect, useState } from 'react';
import { fetchCurrentUser, logout } from '../services/auth-api';
import type { AuthUser } from '../types/auth';

/** Owns the signed-in user: restores the server session on mount and ends it on sign-out. */
export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let active = true;
    // Any failure to read the session is treated as signed out, so the login screen always shows.
    fetchCurrentUser().catch(() => null).then((current) => {
      if (!active) return;
      setUser(current); setRestoring(false);
    });
    return () => { active = false; };
  }, []);

  const signOut = useCallback(async () => {
    // The user chose to leave: the screen returns to login even if the server could not be reached.
    try { await logout(); } catch { /* The session cookie expires with the browser session. */ }
    setUser(null);
  }, []);

  return { user, restoring, signIn: setUser, signOut };
}
