import type { ManagedUser } from '../types/user';
import { roleLabel, userInitial } from '../utils/user-format';

interface UserRowProps {
  user: ManagedUser;
  isCurrentUser: boolean;
  onEdit: (user: ManagedUser) => void;
  onToggleActive: (user: ManagedUser, active: boolean) => void;
}

export function UserRow({ user, isCurrentUser, onEdit, onToggleActive }: UserRowProps) {
  return <article className="user-row"><div className="user-avatar" aria-hidden="true">{userInitial(user.name)}</div><div className="user-details"><h2>{user.name}</h2><p>{user.email}</p></div><span className="role-pill">{roleLabel(user.role)}</span><span className={`status-pill ${user.active ? 'is-active' : 'is-inactive'}`}><span aria-hidden="true">●</span> {user.active ? 'Activo' : 'Inactivo'}</span><div className="row-actions"><button className="text-button" onClick={() => onEdit(user)}>Editar</button>{user.active && isCurrentUser ? <span className="current-user">Sesión actual</span> : <button className="text-button" onClick={() => onToggleActive(user, !user.active)}>{user.active ? 'Desactivar' : 'Reactivar'}</button>}</div></article>;
}
