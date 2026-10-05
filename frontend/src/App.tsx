import { FormEvent, useEffect, useState } from 'react';
import './app.css';
import { MembersView } from './features/members/components/MembersView';
import { AppShell } from './layouts/AppShell';

interface LoginUser { id: string; name: string; email: string; role: string; }
type LoginState = 'idle' | 'pending' | 'error' | 'success';
type Role = 'member' | 'admin';
interface ManagedUser extends LoginUser { active: boolean; }
interface UserForm { name: string; email: string; role: Role; password: string; active: boolean; }
const emptyForm: UserForm = { name: '', email: '', role: 'member', password: '', active: true };
const roleLabels: Record<string, string> = { member: 'Socio', admin: 'Administrador' };

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
      if (!cancelled) setUsersError('No se pudieron cargar los usuarios. Inténtelo nuevamente.');
    }).finally(() => { if (!cancelled) setUsersLoading(false); });
    return () => { cancelled = true; };
  }, [state, user, view]);

  function openForm(target?: ManagedUser) {
    setFormOpen(true); setEditing(target ?? null);
    setForm(target ? { name: target.name, email: target.email, role: target.role as Role, password: '', active: target.active } : emptyForm);
    setUsersError(''); setNotice('');
  }
  async function refreshUsers() {
    const response = await fetch('/users');
    if (!response.ok) throw new Error();
    setUsers(await response.json() as ManagedUser[]);
  }
  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setUsersError(''); setNotice('');
    const payload = { name: form.name.trim(), email: form.email.trim(), role: form.role, ...(form.password ? { password: form.password } : {}), ...(editing ? { active: form.active } : {}) };
    try {
      const response = await fetch(editing ? `/users/${encodeURIComponent(editing.id)}` : '/users', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error();
      await refreshUsers(); setForm(emptyForm); setEditing(null); setFormOpen(false); setNotice(editing ? 'El usuario se actualizó correctamente.' : 'El usuario se creó correctamente.');
    } catch { setUsersError('No se pudo guardar el usuario. Revise los datos e inténtelo nuevamente.'); }
    finally { setSaving(false); setForm(current => ({ ...current, password: '' })); }
  }
  async function setUserActive(target: ManagedUser, active: boolean) {
    setUsersError(''); setNotice('');
    try {
      const response = await fetch(`/users/${encodeURIComponent(target.id)}`, active ? { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) } : { method: 'DELETE' });
      if (!response.ok) throw new Error();
      await refreshUsers(); setNotice(active ? 'El usuario se reactivó correctamente.' : 'El usuario se desactivó correctamente.');
    } catch { setUsersError('No se pudo actualizar el usuario. Inténtelo nuevamente.'); }
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState('pending'); setUser(null);
    try {
      const response = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error('Login failed');
      const result = await response.json() as { user: LoginUser };
      setUser(result.user); setPassword(''); setView('members'); setState('success');
    } catch { setState('error'); }
  }

  if (state === 'success' && user) {
    return <AppShell title={view === 'members' ? 'Socios' : 'Usuarios'} subtitle={view === 'members' ? 'Búsqueda por N° de socio, DNI o nombre' : 'Administración de cuentas de demostración'} activeSection={view === 'users' ? 'users' : 'members'} onSectionChange={section => setView(section)}>
      {view === 'members' ? <MembersView /> : <section className="users-screen" aria-label="Administración de usuarios">
        <div className="users-toolbar"><div><strong>{users.length}</strong> usuarios <span className="toolbar-hint">El rol es solo informativo.</span></div><button className="primary-button" onClick={() => openForm()}>＋ Crear usuario</button></div>
        {usersError && <p className="feedback error" role="alert">{usersError}</p>}{notice && <p className="feedback success" role="status" aria-live="polite">{notice}</p>}
        {formOpen && <form className="user-form" onSubmit={saveUser}>
          <div className="form-heading"><h2>{editing ? 'Editar usuario' : 'Crear usuario'}</h2><button type="button" className="text-button" onClick={() => { setEditing(null); setForm(emptyForm); setFormOpen(false); }}>Cancelar</button></div>
          <div className="fields-grid"><label>Nombre completo<input required maxLength={100} autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Correo electrónico<input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label><label>Rol<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}><option value="member">Socio</option><option value="admin">Administrador</option></select></label><label>Contraseña{editing && <span className="field-hint"> Déjela en blanco para conservar la actual</span>}<input required={!editing} minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'Restablecimiento opcional' : 'Defina una contraseña'} /></label></div>
          {editing && <label className="active-toggle"><input type="checkbox" checked={form.active} disabled={editing.id === user.id} onChange={e => setForm({ ...form, active: e.target.checked })} /> Cuenta activa{editing.id === user.id && <span className="field-hint"> (cuenta actual)</span>}</label>}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}</button>
        </form>}
        <div className="user-list" aria-busy={usersLoading}>{usersLoading ? <p className="empty-state"><span className="spinner blue-spinner" aria-hidden="true" />Cargando usuarios…</p> : users.length === 0 ? <p className="empty-state">No se encontraron cuentas de usuario.</p> : users.map(item => <article className="user-row" key={item.id}><div className="user-avatar" aria-hidden="true">{item.name.trim().charAt(0).toUpperCase()}</div><div className="user-details"><h2>{item.name}</h2><p>{item.email}</p></div><span className="role-pill">{roleLabels[item.role] ?? item.role}</span><span className={`status-pill ${item.active ? 'is-active' : 'is-inactive'}`}><span aria-hidden="true">●</span> {item.active ? 'Activo' : 'Inactivo'}</span><div className="row-actions"><button className="text-button" onClick={() => openForm(item)}>Editar</button>{item.active && item.id === user.id ? <span className="current-user">Sesión actual</span> : <button className="text-button" onClick={() => void setUserActive(item, !item.active)}>{item.active ? 'Desactivar' : 'Reactivar'}</button>}</div></article>)}</div>
        <p className="demo-disclaimer">Entorno de demostración · No utilice datos reales ni sensibles.</p>
      </section>}
    </AppShell>;
  }

  return <main className="login-shell"><aside className="brand-panel" aria-label="Club Social"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">C</span><span>CLUB<br />SOCIAL</span></div><div className="brand-message"><span className="eyebrow">UN SOLO EQUIPO</span><h1>Un club.<br />Una comunidad.</h1><p>Un espacio para encontrarnos y compartir nuestra pasión.</p></div><div className="brand-footer"><span className="gold-dot" /> Comunidad · Deporte · Historia</div></aside>
    <section className="form-panel" aria-labelledby="login-title"><div className="mobile-brand"><span className="brand-mark" aria-hidden="true">C</span> CLUB SOCIAL</div><div className="login-card"><div className="card-kicker"><span /> ACCESO DE SOCIOS</div><h2 id="login-title">Bienvenido/a de nuevo</h2><p className="intro">Ingrese a su cuenta del club</p><form onSubmit={handleSubmit}><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" placeholder="nombre@ejemplo.com" required value={email} onChange={event => setEmail(event.target.value)} disabled={state === 'pending'} /><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Ingrese su contraseña" required value={password} onChange={event => setPassword(event.target.value)} disabled={state === 'pending'} />{state === 'error' && <p className="feedback error" role="alert">No se pudo iniciar sesión. Verifique sus datos e inténtelo nuevamente.</p>}<button type="submit" disabled={state === 'pending'}>{state === 'pending' ? <><span className="spinner" aria-hidden="true" />Ingresando…</> : <>Ingresar <span aria-hidden="true">→</span></>}</button><p className="demo-note"><span aria-hidden="true">✦</span> Acceso de demostración · Utilice una cuenta de prueba</p></form></div><footer className="form-footer">© 2026 Club Social <span>•</span> Unidos por el club</footer></section></main>;
}
