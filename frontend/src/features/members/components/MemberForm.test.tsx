import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildMember } from '../test/fixtures';
import { emptyMemberForm, memberToFormValues } from '../utils/member-validation';
import { MemberForm } from './MemberForm';

const TODAY = '2026-10-05';

function renderForm(overrides: Partial<React.ComponentProps<typeof MemberForm>> = {}) {
  const props = {
    mode: 'create' as const,
    initialValues: emptyMemberForm(TODAY),
    today: TODAY,
    saving: false,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const user = userEvent.setup({ delay: null });
  render(<MemberForm {...props} />);
  return { user, ...props };
}

async function fillAdult(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nombre'), 'Lucía');
  await user.type(screen.getByLabelText('Apellido'), 'Ríos');
  await user.type(screen.getByLabelText('DNI'), '30123456');
  await user.type(screen.getByLabelText('Fecha de nacimiento'), '1990-03-15');
  await user.selectOptions(screen.getByLabelText('Categoría'), 'Mayor');
  await user.type(screen.getByLabelText('WhatsApp'), '1155551234');
}

describe('MemberForm', () => {
  it('renders the personal data fields with the member-since date defaulting to today', () => {
    renderForm();

    for (const label of ['Nombre', 'Apellido', 'DNI', 'Fecha de nacimiento', 'Categoría', 'WhatsApp']) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText('Email (opcional)')).not.toBeRequired();
    expect(screen.getByLabelText('Socio desde')).toHaveValue(TODAY);
    expect(screen.getByRole('button', { name: 'Crear socio' })).toBeEnabled();
  });

  it('submits the validated payload', async () => {
    const { user, onSubmit } = renderForm();

    await fillAdult(user);
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Lucía',
      lastName: 'Ríos',
      dni: '30123456',
      birthDate: '1990-03-15',
      category: 'Mayor',
      memberSince: TODAY,
      whatsapp: '1155551234',
    });
  });

  it('blocks the submit, shows the errors and focuses the first invalid field', async () => {
    const { user, onSubmit } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(onSubmit).not.toHaveBeenCalled();
    const firstName = screen.getByLabelText('Nombre');
    expect(firstName).toBeInvalid();
    expect(firstName).toHaveAccessibleDescription('Ingresá el nombre.');
    expect(screen.getByLabelText('DNI')).toHaveAccessibleDescription('El DNI debe tener 7 u 8 dígitos.');
    expect(firstName).toHaveFocus();
  });

  it('clears a field error once the field is edited', async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    await user.type(screen.getByLabelText('Nombre'), 'L');

    expect(screen.getByLabelText('Nombre')).toBeValid();
    expect(screen.queryByText('Ingresá el nombre.')).not.toBeInTheDocument();
  });

  it('shows the guardian fields only while the birth date makes the person a minor', async () => {
    const { user } = renderForm();
    const birthDate = screen.getByLabelText('Fecha de nacimiento');
    expect(screen.queryByLabelText('Nombre del tutor')).not.toBeInTheDocument();

    await user.type(birthDate, '2015-04-01');
    expect(screen.getByLabelText('Nombre del tutor')).toBeRequired();
    expect(screen.getByLabelText('Contacto del tutor')).toBeRequired();

    await user.clear(birthDate);
    await user.type(birthDate, '1990-03-15');
    expect(screen.queryByLabelText('Nombre del tutor')).not.toBeInTheDocument();
  });

  it('requires the guardian for a minor and submits it', async () => {
    const { user, onSubmit } = renderForm();
    await user.type(screen.getByLabelText('Nombre'), 'Mateo');
    await user.type(screen.getByLabelText('Apellido'), 'Quiroga');
    await user.type(screen.getByLabelText('DNI'), '57201998');
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '2015-04-01');
    await user.selectOptions(screen.getByLabelText('Categoría'), 'Infantil');
    await user.type(screen.getByLabelText('WhatsApp'), '3816128874');

    await user.click(screen.getByRole('button', { name: 'Crear socio' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Nombre del tutor')).toHaveAccessibleDescription('Ingresá el nombre del tutor.');

    await user.type(screen.getByLabelText('Nombre del tutor'), 'Darío Quiroga');
    await user.type(screen.getByLabelText('Contacto del tutor'), '3816128874');
    await user.click(screen.getByRole('button', { name: 'Crear socio' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ guardian: { name: 'Darío Quiroga', contact: '3816128874' } }),
    );
  });

  it('prefills an existing member in edit mode', () => {
    const member = buildMember({ email: 'lucia@club.test' });
    renderForm({ mode: 'edit', initialValues: memberToFormValues(member) });

    expect(screen.getByLabelText('Nombre')).toHaveValue('Lucía');
    expect(screen.getByLabelText('Email (opcional)')).toHaveValue('lucia@club.test');
    expect(screen.getByLabelText('Categoría')).toHaveValue('Mayor');
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('shows backend field errors, including dotted guardian keys', () => {
    renderForm({
      initialValues: { ...emptyMemberForm(TODAY), birthDate: '2015-04-01' },
      fieldErrors: { dni: 'Este DNI ya está registrado.', 'guardian.name': 'Falta el tutor.' },
    });

    expect(screen.getByLabelText('DNI')).toBeInvalid();
    expect(screen.getByLabelText('DNI')).toHaveAccessibleDescription('Este DNI ya está registrado.');
    expect(screen.getByLabelText('Nombre del tutor')).toHaveAccessibleDescription('Falta el tutor.');
  });

  it('announces a general submit error', () => {
    renderForm({ submitError: 'No se pudo conectar con el servidor.' });

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
  });

  it('disables the submit button while saving', () => {
    renderForm({ saving: true });

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('calls onCancel from the Cancelar button', async () => {
    const { user, onCancel } = renderForm();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
