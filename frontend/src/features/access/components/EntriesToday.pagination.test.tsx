import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EntriesTodayState } from '../hooks/useEntriesToday';
import { EntriesToday } from './EntriesToday';

function stateWith(count: number): EntriesTodayState {
  const entries = Array.from({ length: count }, (_unused, index) => ({
    id: `a${index + 1}`,
    checkedAt: '2026-10-05T23:00:00.000Z',
    memberNumber: String(index + 1).padStart(4, '0'),
    name: `Socio ${index + 1}`,
    method: 'camera',
    result: 'green',
  }));
  return { day: { entries, counts: { entered: count, warned: 0, refused: 0 } }, problem: undefined } as unknown as EntriesTodayState;
}

function shownRows() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1);
}

describe('EntriesToday pagination', () => {
  it('shows no pagination when the checks fit on one page', () => {
    render(<EntriesToday state={stateWith(10)} onRetry={() => undefined} />);
    expect(shownRows()).toHaveLength(10);
    expect(screen.queryByRole('navigation', { name: 'Paginación de accesos de hoy' })).not.toBeInTheDocument();
  });

  it('shows ten checks per page and keeps counting all of them', async () => {
    const user = userEvent.setup();
    render(<EntriesToday state={stateWith(14)} onRetry={() => undefined} />);
    expect(shownRows()).toHaveLength(10);
    expect(screen.getByText('14 registros')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(shownRows()).toHaveLength(4);
    expect(shownRows()[3]).toHaveTextContent('Socio 14');
  });
});
