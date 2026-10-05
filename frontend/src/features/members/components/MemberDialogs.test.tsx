import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeactivateDialog, ReactivateDialog } from './MemberDialogs';

function renderDeactivate(overrides: Partial<React.ComponentProps<typeof DeactivateDialog>> = {}) {
  const props = {
    memberName: 'Lucía Ríos',
    saving: false,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  const view = render(
    <>
      <button type="button">Abrir</button>
      <DeactivateDialog {...props} />
    </>,
  );
  return { user, ...props, ...view };
}

describe('DeactivateDialog', () => {
  it('is a labelled dialog that names the member and focuses the reason field', () => {
    renderDeactivate();

    const dialog = screen.getByRole('dialog', { name: 'Dar de baja a Lucía Ríos' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Motivo de la baja')).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription(/no se elimina/i);
  });

  it('requires a non-empty reason before confirming', async () => {
    const { user, onConfirm } = renderDeactivate();

    await user.type(screen.getByLabelText('Motivo de la baja'), '   ');
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Motivo de la baja')).toHaveAccessibleDescription(
      'Ingresá el motivo de la baja.',
    );
    expect(screen.getByLabelText('Motivo de la baja')).toHaveFocus();
  });

  it('confirms with the trimmed reason', async () => {
    const { user, onConfirm } = renderDeactivate();

    await user.type(screen.getByLabelText('Motivo de la baja'), '  Se mudó  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar baja' }));

    expect(onConfirm).toHaveBeenCalledWith('Se mudó');
  });

  it('closes on Cancelar and on Escape', async () => {
    const { user, onCancel } = renderDeactivate();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('keeps Tab focus inside the dialog', async () => {
    const { user } = renderDeactivate();
    const reason = screen.getByLabelText('Motivo de la baja');
    const cancel = screen.getByRole('button', { name: 'Cancelar' });

    await user.tab();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(reason).toHaveFocus();
    await user.tab({ shift: true });
    expect(cancel).toHaveFocus();
  });

  it('restores focus to the element that opened it when it closes', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(
      <DeactivateDialog memberName="Lucía Ríos" saving={false} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(opener).not.toHaveFocus();

    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });

  it('shows a server error and disables the actions while saving', () => {
    renderDeactivate({ saving: true, error: 'No se pudo conectar con el servidor.' });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    expect(screen.getByRole('button', { name: 'Dando de baja…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});

describe('DeactivateDialog busy keyboard handling', () => {
  function renderPair(saving: boolean, error?: string) {
    return (
      <DeactivateDialog memberName="Lucía Ríos" saving={saving} error={error} onConfirm={vi.fn()} onCancel={onCancelSpy} />
    );
  }
  const onCancelSpy = vi.fn();

  it('keeps focus inside the dialog while busy and restores Escape and Tab trapping afterwards', async () => {
    onCancelSpy.mockClear();
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(renderPair(false));
    await user.type(screen.getByLabelText('Motivo de la baja'), 'Se mudó');
    screen.getByRole('button', { name: 'Confirmar baja' }).focus();

    rerender(renderPair(true));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toBeEnabled();
    await user.keyboard('{Escape}');
    expect(onCancelSpy).not.toHaveBeenCalled();

    rerender(renderPair(false, 'No se pudo conectar con el servidor.'));
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).not.toBe(document.body);
    await user.keyboard('{Escape}');
    expect(onCancelSpy).toHaveBeenCalledTimes(1);
  });
});

describe('ReactivateDialog', () => {
  it('asks for confirmation, warns about the previous deactivation record and confirms', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ReactivateDialog memberName="Ana Álvarez" saving={false} onConfirm={onConfirm} onCancel={onCancel} />);

    const dialog = screen.getByRole('alertdialog', { name: 'Reactivar a Ana Álvarez' });
    expect(dialog).toHaveAccessibleDescription(/registro de la baja/i);

    await user.click(screen.getByRole('button', { name: 'Confirmar reactivación' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
