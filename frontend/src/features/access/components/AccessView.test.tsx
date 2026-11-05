import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildAccessCheck } from '../test/fixtures';
import type { AccessCheck } from '../types/access';
import { AccessView } from './AccessView';

afterEach(() => vi.unstubAllGlobals());

function stubCheck(answer: AccessCheck) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(answer));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const input = () => screen.getByLabelText('DNI del socio');
const panel = () => screen.getByRole('status');

describe('AccessView', () => {
  it('starts with the DNI field focused and nothing announced', () => {
    stubCheck(buildAccessCheck());
    render(<AccessView />);

    expect(input()).toHaveFocus();
    expect(panel()).toBeEmptyDOMElement();
  });

  it('checks the typed DNI on Enter through the body, never the URL, and shows a green result', async () => {
    const fetchMock = stubCheck(buildAccessCheck());
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '30111222{Enter}');

    expect(await screen.findByText('Puede ingresar')).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Lucía Prueba');
    expect(panel()).toHaveTextContent('N° 101');
    expect(panel()).toHaveAttribute('data-result', 'green');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/access/check');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ dni: '30111222' }) });
  });

  it('clears the field and focuses it again once the answer is in, ready for the next person', async () => {
    stubCheck(buildAccessCheck());
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '30111222{Enter}');
    await screen.findByText('Puede ingresar');

    expect(input()).toHaveValue('');
    expect(input()).toHaveFocus();
  });

  it('lets a member in with the months owed, in singular and plural (yellow)', async () => {
    const fetchMock = stubCheck(buildAccessCheck({ result: 'yellow', reason: 'debtor', member: { memberNumber: '101', name: 'Lucía Prueba', unpaidPeriodCount: 1 } }));
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '30111222{Enter}');
    expect(await screen.findByText('Puede ingresar — tiene 1 mes adeudado')).toBeInTheDocument();
    expect(panel()).toHaveAttribute('data-result', 'yellow');

    fetchMock.mockResolvedValueOnce(jsonResponse(buildAccessCheck({ result: 'yellow', reason: 'debtor', member: { memberNumber: '101', name: 'Lucía Prueba', unpaidPeriodCount: 3 } })));
    await user.type(input(), '30111222{Enter}');
    expect(await screen.findByText('Puede ingresar — tiene 3 meses adeudados')).toBeInTheDocument();
  });

  it.each([
    ['deregistered', 'No puede ingresar — dado de baja'],
    ['inactive', 'No puede ingresar — inactivo'],
  ] as const)('keeps a %s member out with the name and number (red)', async (reason, text) => {
    stubCheck(buildAccessCheck({ result: 'red', reason, member: { memberNumber: '202', name: 'Tomás Prueba', unpaidPeriodCount: 6 } }));
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '30111222{Enter}');

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(panel()).toHaveAttribute('data-result', 'red');
    expect(panel()).toHaveTextContent('Tomás Prueba');
    expect(panel()).toHaveTextContent('N° 202');
  });

  it('says the DNI is not registered, with no member and without repeating the DNI', async () => {
    stubCheck({ result: 'red', reason: 'not_found' });
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '29999999{Enter}');

    expect(await screen.findByText('No puede ingresar — DNI no registrado')).toBeInTheDocument();
    expect(panel()).not.toHaveTextContent('N°');
    expect(panel()).not.toHaveTextContent('29999999');
  });

  it('shows a loading message while the check is pending and ignores a second Enter meanwhile', async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '30111222{Enter}{Enter}');
    expect(panel()).toHaveTextContent('Verificando…');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    finish(jsonResponse(buildAccessCheck()));
    expect(await screen.findByText('Puede ingresar')).toBeInTheDocument();
  });

  it('does nothing for an empty field', async () => {
    const fetchMock = stubCheck(buildAccessCheck());
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '   {Enter}');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replaces the previous result with the next one', async () => {
    const fetchMock = stubCheck(buildAccessCheck());
    const user = userEvent.setup();
    render(<AccessView />);
    await user.type(input(), '30111222{Enter}');
    await screen.findByText('Puede ingresar');

    fetchMock.mockResolvedValueOnce(jsonResponse({ result: 'red', reason: 'not_found' }));
    await user.type(input(), '29999999{Enter}');

    expect(await screen.findByText('No puede ingresar — DNI no registrado')).toBeInTheDocument();
    expect(screen.queryByText('Puede ingresar')).not.toBeInTheDocument();
  });

  it('asks for a valid DNI when the server refuses it, keeping what was typed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'validation_error', message: 'Validation failed', fieldErrors: { dni: 'DNI must have 7 or 8 digits' } }, 400)));
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '123{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Ingrese un DNI de 7 u 8 dígitos.');
    expect(input()).toHaveValue('123');
    expect(input()).toHaveFocus();
  });

  it('explains a missing permission and a lost connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'forbidden', message: 'Forbidden' }, 403)));
    const user = userEvent.setup();
    const { unmount } = render(<AccessView />);
    await user.type(input(), '30111222{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para controlar el ingreso.');
    unmount();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    render(<AccessView />);
    await user.type(input(), '30111222{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
  });

  it('removes an error once the next check succeeds', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(jsonResponse(buildAccessCheck()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<AccessView />);

    await user.type(input(), '30111222{Enter}');
    await screen.findByRole('alert');
    await user.type(input(), '{Enter}');

    expect(await screen.findByText('Puede ingresar')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
