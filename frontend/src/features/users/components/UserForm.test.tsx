import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyUserForm } from '../utils/user-format';
import { UserForm } from './UserForm';

describe('UserForm role select', () => {
  it('lists the three current roles with Spanish labels and selects the form role', () => {
    render(<UserForm form={{ ...emptyUserForm, role: 'teacher' }} editing={null} currentUserId="1" saving={false}
      onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />);
    const select = screen.getByLabelText('Rol');
    expect(within(select).getAllByRole('option').map((option) => [option.getAttribute('value'), option.textContent])).toEqual([
      ['secretary', 'Secretaria'],
      ['head_secretary', 'Jefa de secretaría'],
      ['teacher', 'Docente'],
    ]);
    expect(select).toHaveValue('teacher');
  });

  const account = { id: '7', name: 'Ana', email: 'ana@club.test', role: 'head_secretary', active: true };
  const renderEditing = (currentUserId: string) => render(<UserForm form={{ ...emptyUserForm, role: 'head_secretary' }} editing={account}
    currentUserId={currentUserId} saving={false} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />);

  it('disables the role select when editing the signed-in account', () => {
    renderEditing('7');
    expect(screen.getByLabelText('Rol')).toBeDisabled();
  });

  it('keeps the role select enabled when editing another account', () => {
    renderEditing('8');
    expect(screen.getByLabelText('Rol')).toBeEnabled();
  });
});
