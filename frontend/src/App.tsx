import { FormEvent, useState } from 'react';
import './app.css';

interface LoginUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type LoginState = 'idle' | 'pending' | 'error' | 'success';

export function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [user, setUser] = useState<LoginUser | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('pending');
    setUser(null);
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error('Login failed');
      const result = (await response.json()) as { user: LoginUser };
      setUser(result.user);
      setPassword('');
      setState('success');
    } catch {
      setState('error');
    }
  }

  return (
    <main className="login-shell">
      <aside className="brand-panel" aria-label="Club Social">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">C</span>
          <span>CLUB<br />SOCIAL</span>
        </div>
        <div className="brand-message">
          <span className="eyebrow">ALWAYS A TEAM</span>
          <h1>One club.<br />One community.</h1>
          <p>A place to connect and share our passion.</p>
        </div>
        <div className="brand-footer"><span className="gold-dot" /> Community · Sport · History</div>
      </aside>

      <section className="form-panel" aria-labelledby="login-title">
        <div className="mobile-brand"><span className="brand-mark" aria-hidden="true">C</span> CLUB SOCIAL</div>
        <div className="login-card">
          <div className="card-kicker"><span /> MEMBER ACCESS</div>
          <h2 id="login-title">Welcome back.</h2>
          <p className="intro">Sign in to your club account</p>

          {state === 'success' && user ? (
            <div className="feedback success" role="status" aria-live="polite">
              <span className="feedback-icon" aria-hidden="true">✓</span>
              <div><strong>Welcome, {user.name}!</strong><p>You are signed in as {user.role}.</p></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="username" placeholder="name@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={state === 'pending'} />
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={state === 'pending'} />
              {state === 'error' && <p className="feedback error" role="alert">We could not sign you in. Check your details and try again.</p>}
              <button type="submit" disabled={state === 'pending'}>{state === 'pending' ? <><span className="spinner" aria-hidden="true" />Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}</button>
              <p className="demo-note"><span aria-hidden="true">✦</span> Demo access · Use your test account</p>
            </form>
          )}
          {state === 'success' && <button className="secondary-button" onClick={() => { setState('idle'); setUser(null); }}>Back to sign in</button>}
        </div>
        <footer className="form-footer">© 2026 Club Social <span>•</span> Better together</footer>
      </section>
    </main>
  );
}
