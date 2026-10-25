import type { FormEvent } from 'react';
import type { ManagedUser, UserFormValues, UserRole } from '../types/user';
import { roleOptions } from '../utils/user-format';

interface UserFormProps {
  form: UserFormValues;
  editing: ManagedUser | null;
  currentUserId: string;
  saving: boolean;
  onChange: (form: UserFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function UserForm({ form, editing, currentUserId, saving, onChange, onSubmit, onCancel }: UserFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return <form className="user-form" onSubmit={handleSubmit}>
    <div className="form-heading"><h2>{editing ? 'Editar usuario' : 'Crear usuario'}</h2><button type="button" className="text-button" onClick={onCancel}>Cancelar</button></div>
    <div className="fields-grid"><label>Nombre completo<input required maxLength={100} autoComplete="name" value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} /></label><label>Correo electrónico<input required type="email" autoComplete="email" value={form.email} onChange={e => onChange({ ...form, email: e.target.value })} /></label><label>Rol<select value={form.role} disabled={editing?.id === currentUserId} onChange={e => onChange({ ...form, role: e.target.value as UserRole })}>{roleOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label><label>Contraseña{editing && <span className="field-hint"> Déjela en blanco para conservar la actual</span>}<input required={!editing} minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e => onChange({ ...form, password: e.target.value })} placeholder={editing ? 'Restablecimiento opcional' : 'Defina una contraseña'} /></label></div>
    {editing && <label className="active-toggle"><input type="checkbox" checked={form.active} disabled={editing.id === currentUserId} onChange={e => onChange({ ...form, active: e.target.checked })} /> Cuenta activa{editing.id === currentUserId && <span className="field-hint"> (cuenta actual)</span>}</label>}
    <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}</button>
  </form>;
}
