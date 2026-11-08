import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../../members/test/fixtures';
import { buildAccount } from '../test/fixtures';
import { PaymentsRoute } from './PaymentsRoute';

afterEach(() => vi.unstubAllGlobals());

function stub() {
  const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
    const target = String(url);
    if (target.startsWith('/api/members?')) return jsonResponse([buildMember()]);
    if (target.endsWith('/account')) return jsonResponse(buildAccount());
    return jsonResponse([]);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('PaymentsRoute', () => {
  it('opens the member whose DNI is in the address (?dni=)', async () => {
    const fetchMock = stub();
    render(<MemoryRouter initialEntries={['/cobros?dni=30123456']}><PaymentsRoute canCollect canAnnul={false} /></MemoryRouter>);

    expect(await screen.findByRole('region', { name: 'Socio' })).toHaveTextContent('Lucía Ríos');
    expect(fetchMock).toHaveBeenCalledWith('/api/members?search=30123456', expect.anything());
  });

  it('opens empty, searching nothing, when the address has no DNI', () => {
    const fetchMock = stub();
    render(<MemoryRouter initialEntries={['/cobros']}><PaymentsRoute canCollect canAnnul={false} /></MemoryRouter>);

    expect(screen.getByLabelText('DNI del socio')).toHaveValue('');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
