import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

function setup(page: number, pageCount: number, total: number) {
  const onPageChange = vi.fn();
  render(<Pagination page={page} pageCount={pageCount} total={total} onPageChange={onPageChange} />);
  return { onPageChange, user: userEvent.setup() };
}

describe('Pagination', () => {
  it('renders nothing when everything fits on one page', () => {
    const { container } = render(<Pagination page={1} pageCount={1} total={7} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('summarises the rows shown and the position', () => {
    setup(2, 3, 25);
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 11–20 de 25');
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
  });

  it('marks the current page and offers the other ones', () => {
    setup(2, 3, 25);
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Página 1' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Página 3' })).toBeInTheDocument();
  });

  it('goes to the page that was clicked', async () => {
    const { onPageChange, user } = setup(1, 3, 25);
    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('steps back and forward', async () => {
    const { onPageChange, user } = setup(2, 3, 25);
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('disables Anterior on the first page', () => {
    setup(1, 3, 25);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('disables Siguiente on the last page', () => {
    setup(3, 3, 25);
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByText('Mostrando 21–25 de 25')).toBeInTheDocument();
  });
});
