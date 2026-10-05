import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildMember } from '../test/fixtures';
import { MemberDetail } from './MemberDetail';

const TODAY = '2026-10-05';

function renderDetail(member = buildMember()) {
  const handlers = {
    onBack: vi.fn(),
    onEdit: vi.fn(),
    onDeactivate: vi.fn(),
    onReactivate: vi.fn(),
  };
  const user = userEvent.setup();
  render(<MemberDetail member={member} today={TODAY} {...handlers} />);
  return { user, ...handlers };
}

describe('MemberDetail', () => {
  it('shows the personal data of an active member', () => {
    renderDetail(buildMember({ email: 'lucia@club.test' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Lucía Ríos' })).toBeInTheDocument();
    expect(screen.getByText('Mayor · 36 años')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    const facts = {
      'N° de socio': '0001',
      DNI: '30123456',
      'Fecha de nacimiento': '15/03/1990',
      'Socio desde': '01/02/2015',
      WhatsApp: '1155551234',
      Email: 'lucia@club.test',
    };
    for (const [term, value] of Object.entries(facts)) {
      expect(screen.getByText(term).nextElementSibling).toHaveTextContent(value);
    }
  });

  it('shows the guardian of a minor and a dash for missing optional data', () => {
    renderDetail(
      buildMember({
        birthDate: '2015-04-01',
        category: 'Infantil',
        guardian: { name: 'Silvia Ríos', contact: '3815442019' },
      }),
    );

    expect(screen.getByText('Tutor').nextElementSibling).toHaveTextContent('Silvia Ríos · 3815442019');
    expect(screen.getByText('Email').nextElementSibling).toHaveTextContent('—');
  });

  it('omits the guardian row for an adult without guardian', () => {
    renderDetail();

    expect(screen.queryByText('Tutor')).not.toBeInTheDocument();
  });

  it('does not show deactivation data for an active member', () => {
    renderDetail();

    expect(screen.queryByText(/Motivo/)).not.toBeInTheDocument();
  });

  it('shows the deactivation date and reason for an inactive member', () => {
    renderDetail(
      buildMember({ status: 'inactive', deactivation: { date: '2026-09-30', reason: 'Se mudó de ciudad' } }),
    );

    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText('Fecha de baja').nextElementSibling).toHaveTextContent('30/09/2026');
    expect(screen.getByText('Motivo de la baja').nextElementSibling).toHaveTextContent('Se mudó de ciudad');
  });

  it('offers Dar de baja, not Reactivar, for an active member', async () => {
    const { user, onDeactivate, onEdit, onBack } = renderDetail();

    expect(screen.queryByRole('button', { name: 'Reactivar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Volver al listado' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('offers Reactivar, not Dar de baja, for an inactive member', async () => {
    const { user, onReactivate } = renderDetail(
      buildMember({ status: 'inactive', deactivation: { date: '2026-09-30', reason: 'Mudanza' } }),
    );

    expect(screen.queryByRole('button', { name: 'Dar de baja' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reactivar' }));

    expect(onReactivate).toHaveBeenCalledTimes(1);
  });
});
