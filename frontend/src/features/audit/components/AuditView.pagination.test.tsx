import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildEntry } from '../test/fixtures';
import { AuditView } from './AuditView';

afterEach(() => vi.unstubAllGlobals());

function stubEntries(count: number) {
  const entries = Array.from({ length: count }, (_unused, index) => buildEntry({ id: `e${index + 1}`, entityLabel: `Registro ${index + 1}` }));
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ entries, failedWrites: { count: 0, lastFailedAt: null } })));
}

function shownRecords() {
  const table = screen.getByRole('table', { name: 'Registro de auditoría' });
  return within(table).getAllByRole('row').slice(1).map((row) => row.textContent ?? '');
}

describe('AuditView pagination', () => {
  it('shows no pagination when the log fits on one page', async () => {
    stubEntries(10);
    render(<AuditView />);

    await screen.findByRole('table');
    expect(shownRecords()).toHaveLength(10);
    expect(screen.queryByRole('navigation', { name: 'Paginación de la auditoría' })).not.toBeInTheDocument();
  });

  it('shows ten entries per page and moves between pages when there are more', async () => {
    stubEntries(23);
    const user = userEvent.setup();
    render(<AuditView />);

    await screen.findByRole('table');
    expect(shownRecords()).toHaveLength(10);
    expect(shownRecords()[0]).toContain('Registro 1');
    expect(screen.getByText('Mostrando 1–10 de 23')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(shownRecords()[0]).toContain('Registro 11');
    expect(screen.getByText('Mostrando 11–20 de 23')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(shownRecords()).toHaveLength(3);
    expect(shownRecords()[2]).toContain('Registro 23');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });
});
