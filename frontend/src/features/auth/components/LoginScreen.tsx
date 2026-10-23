import { useLogin } from '../hooks/useLogin';
import type { AuthUser } from '../types/auth';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

/** Sign-in screen: club branding panel plus the email/password form. */
export function LoginScreen({ onLogin }: LoginScreenProps) {
  const { email, setEmail, password, setPassword, status, submit } = useLogin(onLogin);
  const pending = status === 'pending';

  return <main className="login-shell"><aside className="brand-panel" aria-label="Club Social"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">C</span><span>CLUB<br />SOCIAL</span></div><div className="brand-message"><span className="eyebrow">UN SOLO EQUIPO</span><h1>Un club.<br />Una comunidad.</h1><p>Un espacio para encontrarnos y compartir nuestra pasión.</p></div><div className="brand-footer"><span className="gold-dot" /> Comunidad · Deporte · Historia</div></aside>
    <section className="form-panel" aria-labelledby="login-title"><div className="mobile-brand"><span className="brand-mark" aria-hidden="true">C</span> CLUB SOCIAL</div><div className="login-card"><div className="card-kicker"><span /> ACCESO DE SOCIOS</div><h2 id="login-title">Bienvenido/a de nuevo</h2><p className="intro">Ingrese a su cuenta del club</p><form onSubmit={event => void submit(event)}><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" placeholder="nombre@ejemplo.com" required value={email} onChange={event => setEmail(event.target.value)} disabled={pending} /><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Ingrese su contraseña" required value={password} onChange={event => setPassword(event.target.value)} disabled={pending} />{status === 'error' && <p className="feedback error" role="alert">No se pudo iniciar sesión. Verifique sus datos e inténtelo nuevamente.</p>}<button type="submit" disabled={pending}>{pending ? <><span className="spinner" aria-hidden="true" />Ingresando…</> : <>Ingresar <span aria-hidden="true">→</span></>}</button><p className="demo-note"><span aria-hidden="true">✦</span> Acceso de demostración · Utilice una cuenta de prueba</p></form></div><footer className="form-footer">© 2026 Club Social <span>•</span> Unidos por el club</footer></section></main>;
}
