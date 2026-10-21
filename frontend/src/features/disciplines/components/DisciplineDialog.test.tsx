import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisciplineStatusDialog } from './DisciplineDialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof DisciplineStatusDialog>> = {}) {
  const props = {
    action: 'deactivate' as const,
    disciplineName: 'Básquet',
    saving: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  render(<DisciplineStatusDialog {...props} />);
  return { user, ...props };
}

describe('DisciplineStatusDialog', () => {
  it('asks to confirm the deactivation and focuses the first control', () => {
    renderDialog();

    const dialog = screen.getByRole('alertdialog', { name: 'Dar de baja Básquet' });
    expect(dialog).toHaveAccessibleDescription(/no se elimina/i);
    expect(screen.getByRole('button', { name: 'Confirmar baja' })).toHaveFocus();
  });

  it('asks to confirm the reactivation', () => {
    renderDialog({ action: 'reactivate' });

    expect(screen.getByRole('alertdialog', { name: 'Reactivar Básquet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar reactivación' })).toBeInTheDocument();
  });

  it('confirms and cancels', async () => {
    const { user, onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables the actions while saving and shows the error', () => {
    renderDialog({ saving: true, error: 'Boom' });

    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    expect(screen.getByRole('button', { name: 'Dando de baja…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
