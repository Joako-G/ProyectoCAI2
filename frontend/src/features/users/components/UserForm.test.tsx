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
});
