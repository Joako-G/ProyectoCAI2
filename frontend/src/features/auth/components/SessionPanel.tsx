import { roleLabel, userInitial } from '../../users/utils/user-format';
import type { AuthUser } from '../types/auth';

interface SessionPanelProps {
  user: AuthUser;
  onLogout: () => void;
}

/** Shows who is signed in (read-only) and lets them end the session. */
export function SessionPanel({ user, onLogout }: SessionPanelProps) {
  return (
    <section className="sidebar__session" aria-label="Sesión actual">
      <div className="sidebar__session-user">
        <div className="user-avatar" aria-hidden="true">{userInitial(user.name)}</div>
        <div className="sidebar__session-details">
          <p className="sidebar__session-name" title={user.name}>{user.name}</p>
          <p className="sidebar__session-email" title={user.email}>{user.email}</p>
          <p className="sidebar__session-role">{roleLabel(user.role)}</p>
        </div>
      </div>
      <button type="button" className="sidebar__logout" onClick={onLogout}>Cerrar sesión</button>
    </section>
  );
}
