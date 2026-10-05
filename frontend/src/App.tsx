import { FormEvent, useEffect, useState } from 'react';
import './app.css';
import { MembersView } from './features/members/components/MembersView';
import { AppShell } from './layouts/AppShell';

interface LoginUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type LoginState = 'idle' | 'pending' | 'error' | 'success';
type Role = 'member' | 'admin';
interface ManagedUser extends LoginUser { active: boolean; }
interface UserForm { name: string; email: string; role: Role; password: string; active: boolean; }
const emptyForm: UserForm = { name: '', email: '', role: 'member', password: '', active: true };

export function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [user, setUser] = useState<LoginUser | null>(null);
  const [view, setView] = useState<'welcome' | 'users' | 'members'>('welcome');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (state !== 'success' || !user || view !== 'users') return;
    let cancelled = false;
    setUsersLoading(true);
    setUsersError('');
    fetch('/users').then(async response => {
      if (!response.ok) throw new Error();
      return await response.json() as ManagedUser[];
    }).then(result => { if (!cancelled) setUsers(result); }).catch(() => {
      if (!cancelled) setUsersError('We could not load users. Please try again.');
    }).finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, [state, user, view]);

  function openForm(target?: ManagedUser) {
    setFormOpen(true);
    setEditing(target ?? null);
    setForm(target ? { name: target.name, email: target.email, role: target.role as Role, password: '', active: target.active } : emptyForm);
    setUsersError('');
    setNotice('');
  }

  async function refreshUsers() {
    const response = await fetch('/users');
    if (!response.ok) throw new Error();
    setUsers(await response.json() as ManagedUser[]);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setUsersError(''); setNotice('');
    const payload = { name: form.name.trim(), email: form.email.trim(), role: form.role,
      ...(form.password ? { password: form.password } : {}), ...(editing ? { active: form.active } : {}) };
    try {
      const response = await fetch(editing ? `/users/${encodeURIComponent(editing.id)}` : '/users', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();
      await refreshUsers();
      setForm(emptyForm); setEditing(null); setFormOpen(false); setNotice(editing ? 'User updated successfully.' : 'User created successfully.');
    } catch { setUsersError('We could not save this user. Check the details and try again.'); }
    finally { setSaving(false); setForm(current => ({ ...current, password: '' })); }
  }

  async function setUserActive(target: ManagedUser, active: boolean) {
    setUsersError(''); setNotice('');
    try {
      const response = await fetch(`/users/${encodeURIComponent(target.id)}`, active ? {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }),
      } : { method: 'DELETE' });
      if (!response.ok) throw new Error();
      await refreshUsers(); setNotice(active ? 'User reactivated successfully.' : 'User deactivated successfully.');
    } catch { setUsersError('We could not update this user. Please try again.'); }
  }

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
      setView('members');
      setState('success');
    } catch {
      setState('error');
    }
  }

  if (state === 'success' && user && view === 'members') {
    return <AppShell title="Socios" subtitle="Búsqueda por N° de socio, DNI o nombre">
      <button className="secondary-button" onClick={() => setView('welcome')}>User administration</button>
      <MembersView />
    </AppShell>;
  }

  return (
    <main className={view === 'users' && state === 'success' ? 'login-shell users-mode' : 'login-shell'}>
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

      {view === 'welcome' && <section className="form-panel" aria-labelledby="login-title">
        <div className="mobile-brand"><span className="brand-mark" aria-hidden="true">C</span> CLUB SOCIAL</div>
        <div className="login-card">
          <div className="card-kicker"><span /> MEMBER ACCESS</div>
          <h2 id="login-title">Welcome back.</h2>
          <p className="intro">Sign in to your club account</p>

      {state === 'success' && user && view === 'welcome' ? (
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
          {state === 'success' && <><button className="secondary-button" onClick={() => setView('users')}>Manage users</button><button className="secondary-button" onClick={() => setView('members')}>Manage members</button></>}
        </div>
        <footer className="form-footer">© 2026 Club Social <span>•</span> Better together</footer>
      </section>}
      {state === 'success' && user && view === 'users' && <section className="users-screen" aria-labelledby="users-title">
        <header className="users-header"><div><p className="eyebrow">CLUB SOCIAL · ADMINISTRATION</p><h1 id="users-title">User management</h1><p>Manage demo accounts and their access status.</p></div><button className="secondary-button back-button" onClick={() => { setView('welcome'); setUsersError(''); setNotice(''); }}>← Back to welcome</button></header>
        <div className="users-toolbar"><div><strong>{users.length}</strong> accounts <span className="toolbar-hint">Role is display information only.</span></div><button className="primary-button" onClick={() => openForm()}>＋ Add user</button></div>
        {usersError && <p className="feedback error" role="alert">{usersError}</p>}{notice && <p className="feedback success" role="status" aria-live="polite">{notice}</p>}
        {formOpen && <form className="user-form" onSubmit={saveUser}>
          <div className="form-heading"><h2>{editing ? 'Edit user' : 'Create user'}</h2><button type="button" className="text-button" onClick={() => { setEditing(null); setForm(emptyForm); setFormOpen(false); }}>Cancel</button></div>
          <div className="fields-grid"><label>Full name<input required maxLength={100} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Email address<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Role<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}><option value="member">Member</option><option value="admin">Admin</option></select></label><label>Password{editing && <span className="field-hint"> Leave blank to keep current password</span>}<input required={!editing} minLength={8} type="password" autoComplete={editing ? 'new-password' : 'new-password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'Optional password reset' : 'Set an account password'} /></label></div>
          {editing && <label className="active-toggle"><input type="checkbox" checked={form.active} disabled={editing.id === user?.id} onChange={e => setForm({ ...form, active: e.target.checked })} /> Account active{editing.id === user?.id && <span className="field-hint"> (current account)</span>}</label>}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}</button>
        </form>}
        <div className="user-list" aria-busy={usersLoading}>{usersLoading ? <p className="empty-state"><span className="spinner blue-spinner" aria-hidden="true" /> Loading users…</p> : users.length === 0 ? <p className="empty-state">No user accounts found.</p> : users.map(item => <article className="user-row" key={item.id}><div className="user-avatar" aria-hidden="true">{item.name.trim().charAt(0).toUpperCase()}</div><div className="user-details"><h2>{item.name}</h2><p>{item.email}</p></div><span className="role-pill">{item.role}</span><span className={`status-pill ${item.active ? 'is-active' : 'is-inactive'}`}><span aria-hidden="true">●</span> {item.active ? 'Active' : 'Inactive'}</span><div className="row-actions"><button className="text-button" onClick={() => openForm(item)}>Edit</button>{item.active && item.id === user.id ? <span className="current-user">Signed in</span> : <button className="text-button" onClick={() => void setUserActive(item, !item.active)}>{item.active ? 'Deactivate' : 'Reactivate'}</button>}</div></article>)}</div>
        <p className="demo-disclaimer">Demo environment · Do not use real or sensitive account data.</p>
      </section>}
    </main>
  );
}
