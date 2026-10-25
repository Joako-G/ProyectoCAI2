import type { ManagedUser, UserFormValues, UserPayload, UserRole } from '../types/user';

export const roleOptions: ReadonlyArray<{ value: UserRole; label: string }> = [
  { value: 'secretary', label: 'Secretaria' },
  { value: 'head_secretary', label: 'Jefa de secretaría' },
  { value: 'teacher', label: 'Docente' },
];

const roleLabels: Record<string, string> = Object.fromEntries(roleOptions.map(({ value, label }) => [value, label]));

export const emptyUserForm: UserFormValues = { name: '', email: '', role: 'secretary', password: '', active: true };

export function roleLabel(role: string): string {
  return roleLabels[role] ?? role;
}

export function userInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function toFormValues(user: ManagedUser): UserFormValues {
  return { name: user.name, email: user.email, role: user.role as UserRole, password: '', active: user.active };
}

/** A blank password keeps the current one; `active` is only sent when editing. */
export function toUserPayload(form: UserFormValues, editing: boolean): UserPayload {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    role: form.role,
    ...(form.password ? { password: form.password } : {}),
    ...(editing ? { active: form.active } : {}),
  };
}
