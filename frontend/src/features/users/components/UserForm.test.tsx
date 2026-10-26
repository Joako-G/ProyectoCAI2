import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildDiscipline } from '../../disciplines/test/fixtures';
import type { UserRole } from '../types/user';
import { emptyUserForm } from '../utils/user-format';
import { UserForm } from './UserForm';

describe('UserForm role select', () => {
  it('lists the three current roles with Spanish labels and selects the form role', () => {
    render(<UserForm form={{ ...emptyUserForm, role: 'teacher' }} editing={null} currentUserId="1" saving={false} disciplines={[]}
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
    currentUserId={currentUserId} saving={false} disciplines={[]} onChange={() => {}} onSubmit={() => {}} onCancel={() => {}} />);

  it('disables the role select when editing the signed-in account', () => {
    renderEditing('7');
    expect(screen.getByLabelText('Rol')).toBeDisabled();
  });

  it('keeps the role select enabled when editing another account', () => {
    renderEditing('8');
    expect(screen.getByLabelText('Rol')).toBeEnabled();
  });
});

describe('UserForm discipline assignment', () => {
  const disciplines = [
    buildDiscipline(),
    buildDiscipline({ id: 'disc-2', name: 'Vóley' }),
    buildDiscipline({ id: 'disc-3', name: 'Natación', status: 'inactive' }),
  ];
  const renderForm = (role: UserRole, disciplineIds: string[] = [], onChange = vi.fn()) => {
    render(<UserForm form={{ ...emptyUserForm, role, disciplineIds }} editing={null} currentUserId="1" saving={false}
      disciplines={disciplines} onChange={onChange} onSubmit={() => {}} onCancel={() => {}} />);
    return onChange;
  };

  it('offers the active disciplines to assign only when the role is teacher', () => {
    renderForm('teacher', ['disc-2']);
    const group = screen.getByRole('group', { name: 'Disciplinas que dicta' });
    expect(within(group).getAllByRole('checkbox').map((box) => [box.parentElement?.textContent, (box as HTMLInputElement).checked]))
      .toEqual([['Básquet', false], ['Vóley', true]]);
  });

  it('keeps an already assigned discipline listed even when it was deactivated', () => {
    renderForm('teacher', ['disc-3']);
    expect(screen.getByRole('checkbox', { name: 'Natación' })).toBeChecked();
  });

  it.each(['secretary', 'head_secretary'] as const)('hides the discipline selector for %s', (role) => {
    renderForm(role);
    expect(screen.queryByRole('group', { name: 'Disciplinas que dicta' })).not.toBeInTheDocument();
  });

  it('reports the toggled disciplines through onChange', async () => {
    const user = userEvent.setup();
    const onChange = renderForm('teacher', ['disc-2']);
    await user.click(screen.getByLabelText('Básquet'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ disciplineIds: ['disc-2', 'disc-1'] }));
    await user.click(screen.getByLabelText('Vóley'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ disciplineIds: [] }));
  });
});
