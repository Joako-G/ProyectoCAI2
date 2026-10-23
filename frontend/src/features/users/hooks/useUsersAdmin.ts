import { useEffect, useState } from 'react';
import { fetchUsers, saveUser, setUserActive } from '../services/users-api';
import type { ManagedUser, UserFormValues } from '../types/user';
import { emptyUserForm, toFormValues, toUserPayload } from '../utils/user-format';

/** Owns the user list, the create/edit form, and the feedback messages of the users screen. */
export function useUsersAdmin() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserFormValues>(emptyUserForm);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchUsers().then(result => { if (!cancelled) setUsers(result); }).catch(() => {
      if (!cancelled) setError('No se pudieron cargar los usuarios. Inténtelo nuevamente.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openForm(target?: ManagedUser) {
    setFormOpen(true); setEditing(target ?? null);
    setForm(target ? toFormValues(target) : emptyUserForm);
    setError(''); setNotice('');
  }

  function closeForm() {
    setEditing(null); setForm(emptyUserForm); setFormOpen(false);
  }

  async function submit() {
    setSaving(true); setError(''); setNotice('');
    try {
      await saveUser(toUserPayload(form, editing !== null), editing?.id);
      setUsers(await fetchUsers()); closeForm();
      setNotice(editing ? 'El usuario se actualizó correctamente.' : 'El usuario se creó correctamente.');
    } catch { setError('No se pudo guardar el usuario. Revise los datos e inténtelo nuevamente.'); }
    finally { setSaving(false); setForm(current => ({ ...current, password: '' })); }
  }

  async function changeActive(target: ManagedUser, active: boolean) {
    setError(''); setNotice('');
    try {
      await setUserActive(target.id, active);
      setUsers(await fetchUsers());
      setNotice(active ? 'El usuario se reactivó correctamente.' : 'El usuario se desactivó correctamente.');
    } catch { setError('No se pudo actualizar el usuario. Inténtelo nuevamente.'); }
  }

  return { users, loading, error, notice, editing, form, setForm, saving, formOpen, openForm, closeForm, submit, changeActive };
}
