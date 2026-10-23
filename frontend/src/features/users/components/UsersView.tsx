import { useUsersAdmin } from '../hooks/useUsersAdmin';
import { UserForm } from './UserForm';
import { UserRow } from './UserRow';

interface UsersViewProps {
  /** Id of the signed-in user, who cannot deactivate their own account. */
  currentUserId: string;
}

/** Container of the users feature: toolbar, feedback, create/edit form and the account list. */
export function UsersView({ currentUserId }: UsersViewProps) {
  const admin = useUsersAdmin();

  return <section className="users-screen" aria-label="Administración de usuarios">
    <div className="users-toolbar"><div><strong>{admin.users.length}</strong> usuarios <span className="toolbar-hint">El rol es solo informativo.</span></div><button className="primary-button" onClick={() => admin.openForm()}>＋ Crear usuario</button></div>
    {admin.error && <p className="feedback error" role="alert">{admin.error}</p>}{admin.notice && <p className="feedback success" role="status" aria-live="polite">{admin.notice}</p>}
    {admin.formOpen && <UserForm form={admin.form} editing={admin.editing} currentUserId={currentUserId} saving={admin.saving} onChange={admin.setForm} onSubmit={() => void admin.submit()} onCancel={admin.closeForm} />}
    <div className="user-list" aria-busy={admin.loading}>{admin.loading ? <p className="empty-state"><span className="spinner blue-spinner" aria-hidden="true" />Cargando usuarios…</p> : admin.users.length === 0 ? <p className="empty-state">No se encontraron cuentas de usuario.</p> : admin.users.map(item => <UserRow key={item.id} user={item} isCurrentUser={item.id === currentUserId} onEdit={admin.openForm} onToggleActive={(target, active) => void admin.changeActive(target, active)} />)}</div>
    <p className="demo-disclaimer">Entorno de demostración · No utilice datos reales ni sensibles.</p>
  </section>;
}
