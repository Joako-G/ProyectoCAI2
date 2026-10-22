import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisciplineForm } from './DisciplineForm';

function renderForm(overrides: Partial<React.ComponentProps<typeof DisciplineForm>> = {}) {
  const props = {
    mode: 'create' as const,
    initialValues: { name: '', teachers: [''], leadIndex: 0 },
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
  it('submits the trimmed payload with a single teacher in charge', async () => {
    const { user, props } = renderForm();

    await user.type(screen.getByLabelText('Nombre'), '  Vóley ');
    await user.type(screen.getByLabelText('Profesor 1'), 'Ana Gómez');
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Vóley', teachers: ['Ana Gómez'], leadTeacher: 'Ana Gómez' });
  });

  it('adds teacher rows and picks the one in charge', async () => {
    const { user, props } = renderForm();

    await user.type(screen.getByLabelText('Nombre'), 'Vóley');
    await user.type(screen.getByLabelText('Profesor 1'), 'Ana Gómez');
    await user.click(screen.getByRole('button', { name: 'Agregar profesor' }));
    expect(screen.getByLabelText('Profesor 2')).toHaveFocus();
    await user.type(screen.getByLabelText('Profesor 2'), 'Luis Sosa');

    expect(screen.getByRole('radio', { name: 'A cargo: profesor 1' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'A cargo: profesor 2' }));
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).toHaveBeenCalledWith({
      name: 'Vóley',
      teachers: ['Ana Gómez', 'Luis Sosa'],
      leadTeacher: 'Luis Sosa',
    });
  });

  it('cannot remove the last teacher row', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Quitar profesor 1' })).toBeDisabled();
  });

  it('removes a row and keeps the lead teacher pointing at the same person', async () => {
    const { user, props } = renderForm({
      mode: 'edit',
      initialValues: { name: 'Vóley', teachers: ['Ana Gómez', 'Luis Sosa', 'Eva Ríos'], leadIndex: 2 },
    });

    await user.click(screen.getByRole('button', { name: 'Quitar profesor 1' }));
    expect(screen.queryByLabelText('Profesor 3')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Profesor 1')).toHaveValue('Luis Sosa');
    expect(screen.getByRole('radio', { name: 'A cargo: profesor 2' })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(props.onSubmit).toHaveBeenCalledWith({
      name: 'Vóley',
      teachers: ['Luis Sosa', 'Eva Ríos'],
      leadTeacher: 'Eva Ríos',
    });
  });

  it('moves the lead to the first row when the lead row is removed', async () => {
    const { user, props } = renderForm({
      mode: 'edit',
      initialValues: { name: 'Vóley', teachers: ['Ana Gómez', 'Luis Sosa'], leadIndex: 1 },
    });

    await user.click(screen.getByRole('button', { name: 'Quitar profesor 2' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Vóley', teachers: ['Ana Gómez'], leadTeacher: 'Ana Gómez' });
  });

  it('blocks an empty submit, shows the errors and focuses the first invalid field', async () => {
    const { user, props } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ingresá el nombre de la disciplina.');
    expect(screen.getByRole('group', { name: 'Profesores' })).toHaveAccessibleDescription(
      'Completá el nombre de cada profesor o quitá la fila vacía.',
    );
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('clears the teachers error when a teacher changes', async () => {
    const { user } = renderForm({ initialValues: { name: 'Vóley', teachers: [''], leadIndex: 0 } });

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));
    expect(screen.getByLabelText('Profesor 1')).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByLabelText('Profesor 1'), 'A');

    expect(screen.getByLabelText('Profesor 1')).not.toHaveAttribute('aria-invalid');
  });

  it('clears a field error when the field changes', async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));
    await user.type(screen.getByLabelText('Nombre'), 'V');

    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
  });

  it('shows backend field errors and the submit error', () => {
    renderForm({
      fieldErrors: {
        name: 'Ya existe una disciplina con ese nombre.',
        teachers: 'Teachers must not be repeated',
        leadTeacher: 'Lead teacher must be one of the teachers',
      },
      submitError: 'No se pudo guardar.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ya existe una disciplina con ese nombre.');
    expect(screen.getByRole('group', { name: 'Profesores' })).toHaveAccessibleDescription(
      'Teachers must not be repeated',
    );
    expect(screen.getByRole('radio', { name: 'A cargo: profesor 1' })).toHaveAccessibleDescription(
      'Lead teacher must be one of the teachers',
    );
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('prefills in edit mode and labels the action accordingly', () => {
    renderForm({
      mode: 'edit',
      initialValues: { name: 'Básquet', teachers: ['Marcos Peña', 'Ana Gómez'], leadIndex: 1 },
    });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Básquet');
    expect(screen.getByLabelText('Profesor 1')).toHaveValue('Marcos Peña');
    expect(screen.getByLabelText('Profesor 2')).toHaveValue('Ana Gómez');
    expect(screen.getByRole('radio', { name: 'A cargo: profesor 2' })).toBeChecked();
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
