import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisciplineForm } from './DisciplineForm';

function renderForm(overrides: Partial<React.ComponentProps<typeof DisciplineForm>> = {}) {
  const props = {
    mode: 'create' as const,
    initialValues: { name: '', teacherName: '' },
    saving: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  const view = render(<DisciplineForm {...props} />);
  return { user, props, ...view };
}

describe('DisciplineForm', () => {
  it('submits the trimmed payload', async () => {
    const { user, props } = renderForm();

    await user.type(screen.getByLabelText('Nombre'), '  Vóley ');
    await user.type(screen.getByLabelText('Profesor'), 'Ana Gómez');
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Vóley', teacherName: 'Ana Gómez' });
  });

  it('blocks an empty submit, shows the errors and focuses the first invalid field', async () => {
    const { user, props } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ingresá el nombre de la disciplina.');
    expect(screen.getByLabelText('Profesor')).toHaveAccessibleDescription('Ingresá el nombre del profesor.');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('clears a field error when the field changes', async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));
    await user.type(screen.getByLabelText('Nombre'), 'V');

    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
  });

  it('shows backend field errors and the submit error', () => {
    renderForm({
      fieldErrors: { name: 'Ya existe una disciplina con ese nombre.' },
      submitError: 'No se pudo guardar.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ya existe una disciplina con ese nombre.');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('prefills in edit mode and labels the action accordingly', () => {
    renderForm({ mode: 'edit', initialValues: { name: 'Básquet', teacherName: 'Marcos Peña' } });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Básquet');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('disables submit and Cancelar while saving, and cancels on demand otherwise', async () => {
    const { user, props, rerender } = renderForm({ saving: true });
    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancel).not.toHaveBeenCalled();

    rerender(<DisciplineForm {...props} saving={false} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});
