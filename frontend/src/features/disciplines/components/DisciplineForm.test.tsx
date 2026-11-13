import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DisciplineForm } from './DisciplineForm';

const TEACHERS = [
  { id: 't1', name: 'Ana Gómez' },
  { id: 't2', name: 'Eva Ríos' },
  { id: 't3', name: 'Luis Sosa' },
];

function renderForm(overrides: Partial<React.ComponentProps<typeof DisciplineForm>> = {}) {
  const props = {
    mode: 'create' as const,
    initialValues: { name: '', teacherIds: [] as string[], leadId: '' },
    teacherOptions: TEACHERS,
    saving: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup();
  const view = render(<DisciplineForm {...props} />);
  return { user, props, ...view };
}

const lead = (name: string) => screen.getByRole('radio', { name: `A cargo: ${name}` });

describe('DisciplineForm', () => {
  it('lists the teacher accounts and submits the picked one, who is in charge', async () => {
    const { user, props } = renderForm();

    expect(screen.getAllByRole('checkbox').map((box) => box.closest('label')!.textContent)).toEqual(['Ana Gómez', 'Eva Ríos', 'Luis Sosa']);
    await user.type(screen.getByLabelText('Nombre'), '  Vóley ');
    await user.click(screen.getByRole('checkbox', { name: 'Ana Gómez' }));
    expect(lead('Ana Gómez')).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('1 profesor elegido');
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Vóley', teacherIds: ['t1'], leadTeacherId: 't1' });
  });

  it('picks several teachers and chooses the one in charge among them only', async () => {
    const { user, props } = renderForm();

    await user.type(screen.getByLabelText('Nombre'), 'Vóley');
    await user.click(screen.getByRole('checkbox', { name: 'Ana Gómez' }));
    await user.click(screen.getByRole('checkbox', { name: 'Luis Sosa' }));
    expect(lead('Eva Ríos')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('2 profesores elegidos');

    await user.click(lead('Luis Sosa'));
    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Vóley', teacherIds: ['t1', 't3'], leadTeacherId: 't3' });
  });

  it('hands the charge to the first teacher left when the one in charge is taken off', async () => {
    const { user, props } = renderForm({ mode: 'edit', initialValues: { name: 'Vóley', teacherIds: ['t1', 't3'], leadId: 't3' } });

    await user.click(screen.getByRole('checkbox', { name: 'Luis Sosa' }));
    expect(lead('Ana Gómez')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Vóley', teacherIds: ['t1'], leadTeacherId: 't1' });
  });

  it('keeps the one in charge when another teacher is taken off', async () => {
    const { user, props } = renderForm({ mode: 'edit', initialValues: { name: 'Vóley', teacherIds: ['t1', 't2', 't3'], leadId: 't3' } });

    await user.click(screen.getByRole('checkbox', { name: 'Ana Gómez' }));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(props.onSubmit).toHaveBeenCalledWith({ name: 'Vóley', teacherIds: ['t2', 't3'], leadTeacherId: 't3' });
  });

  it('blocks an empty submit, shows the errors and focuses the first invalid field', async () => {
    const { user, props } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ingresá el nombre de la disciplina.');
    expect(screen.getByRole('group', { name: 'Profesores' })).toHaveAccessibleDescription('Elegí al menos un profesor.');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('clears the teachers error when a teacher is picked', async () => {
    const { user } = renderForm({ initialValues: { name: 'Vóley', teacherIds: [], leadId: '' } });

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));
    expect(screen.getByRole('checkbox', { name: 'Ana Gómez' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox', { name: 'Ana Gómez' })).toHaveFocus();
    await user.click(screen.getByRole('checkbox', { name: 'Eva Ríos' }));

    expect(screen.getByRole('checkbox', { name: 'Ana Gómez' })).not.toHaveAttribute('aria-invalid');
  });

  it('clears a field error when the field changes', async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear disciplina' }));
    await user.type(screen.getByLabelText('Nombre'), 'V');

    expect(screen.getByLabelText('Nombre')).not.toHaveAttribute('aria-invalid');
  });

  it('shows backend field errors and the submit error', () => {
    renderForm({
      initialValues: { name: 'Vóley', teacherIds: ['t2'], leadId: 't2' },
      fieldErrors: {
        name: 'Ya existe una disciplina con ese nombre.',
        teachers: 'Every teacher must be an active teacher account',
        leadTeacher: 'Lead teacher must be one of the teachers',
      },
      submitError: 'No se pudo guardar.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Ya existe una disciplina con ese nombre.');
    expect(screen.getByRole('group', { name: 'Profesores' })).toHaveAccessibleDescription('Every teacher must be an active teacher account');
    expect(lead('Eva Ríos')).toHaveAccessibleDescription('Lead teacher must be one of the teachers');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
  });

  it('prefills in edit mode and labels the action accordingly', () => {
    renderForm({ mode: 'edit', initialValues: { name: 'Básquet', teacherIds: ['t1', 't2'], leadId: 't2' } });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Básquet');
    expect(screen.getByRole('checkbox', { name: 'Ana Gómez' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Eva Ríos' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Luis Sosa' })).not.toBeChecked();
    expect(lead('Eva Ríos')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
  });

  it('names the teachers typed in before they were accounts, so their users can be picked', () => {
    renderForm({ mode: 'edit', initialValues: { name: 'Básquet', teacherIds: [], leadId: '' }, legacyTeachers: ['Marcos Peña', 'Carla Ibarra'] });

    expect(screen.getByText(/Antes figuraban/)).toHaveTextContent('Antes figuraban: Marcos Peña, Carla Ibarra.');
  });

  it('says so when there is no teacher account to pick', () => {
    renderForm({ teacherOptions: [] });

    expect(screen.getByText(/Todavía no hay usuarios con rol profesor/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
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
