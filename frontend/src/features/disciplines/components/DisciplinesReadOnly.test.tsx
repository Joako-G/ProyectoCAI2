import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildDiscipline } from '../test/fixtures';
import { DisciplinesTable } from './DisciplinesTable';
import { DisciplinesToolbar } from './DisciplinesToolbar';

describe('disciplines without write permission', () => {
  it('hides Nueva disciplina but keeps the search', () => {
    render(<DisciplinesToolbar search="" status="all" canCreate={false} onSearchSubmit={vi.fn()} onStatusChange={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Nueva disciplina' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('lists the disciplines without edit, deactivate or reactivate actions', () => {
    const disciplines = [buildDiscipline(), buildDiscipline({ id: 'disc-2', name: 'Vóley', status: 'inactive' })];
    render(<DisciplinesTable disciplines={disciplines} canWrite={false} onEdit={vi.fn()} onDeactivate={vi.fn()} onReactivate={vi.fn()} />);

    expect(screen.getByText('Básquet')).toBeInTheDocument();
    expect(screen.getByText('Vóley')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
