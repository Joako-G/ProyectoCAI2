import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildCashCount, buildPreview } from '../test/fixtures';
import type { CashCount, CashCountPreview } from '../types/cashcount';
import { ArqueoView } from './ArqueoView';

afterEach(() => vi.unstubAllGlobals());

/** A server that starts the day open and closes it on the first POST, like the real one. */
function stubServer({ preview = buildPreview(), history = [buildCashCount()] }: { preview?: CashCountPreview; history?: CashCount[] } = {}) {
  let state = { preview, history };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/cashcount/today') return jsonResponse(state.preview);
    if (url === '/api/cashcount' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { countedCash: number; varianceNote?: string };
      const close = buildCashCount({
        id: 'close-2',
        businessDate: state.preview.businessDate,
        expected: state.preview.expected,
        countedCash: body.countedCash,
        variance: body.countedCash - state.preview.expected.cash,
        ...(body.varianceNote ? { varianceNote: body.varianceNote } : { varianceNote: undefined }),
        closedAt: '2026-10-05T21:00:00.000Z',
      });
      state = { preview: { ...state.preview, closed: close }, history: [close, ...state.history] };
      return jsonResponse(close, 201);
    }
    if (url === '/api/cashcount') return jsonResponse(state.history);
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof stubServer>) => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');

describe('ArqueoView: the open day', () => {
  it('shows what is expected today by payment method and concept, and the closed days', async () => {
    stubServer();
    render(<ArqueoView />);

    expect(await screen.findByRole('heading', { name: 'Arqueo del 05/10/2026' })).toBeInTheDocument();
    expect(screen.getByTestId('expected-cash')).toHaveTextContent('$ 4.000');
    const methods = screen.getByRole('table', { name: 'Esperado por medio de pago' });
    expect(within(methods).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['Efectivo$ 4.000', 'QR$ 500']);
    const concepts = screen.getByRole('table', { name: 'Esperado por concepto' });
    expect(within(concepts).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['Cuotas sociales$ 1.500', 'Cuotas de actividades$ 3.000']);
    const history = screen.getByRole('table', { name: 'Cierres anteriores' });
    expect(within(history).getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual(['04/10/2026$ 2.000$ 1.900Faltante de $ 100Vuelto mal dado']);
  });

  it('shows the difference as the cash is typed, and asks for a reason only when there is one', async () => {
    stubServer();
    const user = userEvent.setup();
    render(<ArqueoView />);
    const counted = await screen.findByLabelText('Efectivo contado');

    await user.type(counted, '3900');
    expect(screen.getByTestId('variance')).toHaveTextContent('Faltante de $ 100');
    expect(screen.getByLabelText('Motivo de la diferencia (opcional)')).toBeInTheDocument();

    await user.clear(counted);
    await user.type(counted, '4000');
    expect(screen.getByTestId('variance')).toHaveTextContent('Sin diferencia');
    expect(screen.queryByLabelText('Motivo de la diferencia (opcional)')).not.toBeInTheDocument();

    await user.clear(counted);
    await user.type(counted, '4150');
    expect(screen.getByTestId('variance')).toHaveTextContent('Sobrante de $ 150');
  });

  it('cannot be closed without a valid whole number of pesos', async () => {
    stubServer();
    const user = userEvent.setup();
    render(<ArqueoView />);
    const counted = await screen.findByLabelText('Efectivo contado');
    const close = screen.getByRole('button', { name: 'Cerrar el día' });

    expect(close).toBeDisabled();
    await user.type(counted, '12a');
    expect(close).toBeDisabled();
    await user.clear(counted);
    await user.type(counted, '0');
    expect(close).toBeEnabled();
  });

  it('asks to confirm before closing, and sends nothing when cancelled', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    render(<ArqueoView />);
    await user.type(await screen.findByLabelText('Efectivo contado'), '3900');

    await user.click(screen.getByRole('button', { name: 'Cerrar el día' }));
    expect(screen.getByText('El cierre no se puede modificar después. ¿Cerrar el día con $ 3.900 contados?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(posts(fetchMock)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Cerrar el día' })).toBeInTheDocument();
  });

  it('closes the day with the counted cash and the reason, and then shows the day closed', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    render(<ArqueoView />);
    await user.type(await screen.findByLabelText('Efectivo contado'), '3900');
    await user.type(screen.getByLabelText('Motivo de la diferencia (opcional)'), 'Vuelto mal dado');

    await user.click(screen.getByRole('button', { name: 'Cerrar el día' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }));

    expect(await screen.findByText('El día está cerrado.')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(1);
    expect(JSON.parse(String(posts(fetchMock)[0]![1]!.body))).toEqual({ countedCash: 3900, varianceNote: 'Vuelto mal dado' });
    expect(screen.queryByLabelText('Efectivo contado')).not.toBeInTheDocument();
    expect(screen.getByTestId('closed-counted')).toHaveTextContent('$ 3.900');
    expect(screen.getByTestId('closed-variance')).toHaveTextContent('Faltante de $ 100');
  });

  it('sends no reason when none was written', async () => {
    const fetchMock = stubServer();
    const user = userEvent.setup();
    render(<ArqueoView />);
    await user.type(await screen.findByLabelText('Efectivo contado'), '4000');
    await user.click(screen.getByRole('button', { name: 'Cerrar el día' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }));

    await screen.findByText('El día está cerrado.');
    expect(JSON.parse(String(posts(fetchMock)[0]![1]!.body))).toEqual({ countedCash: 4000 });
  });

  it('says so and refreshes when the day turns out to be closed already', async () => {
    const closed = buildCashCount({ id: 'close-9', businessDate: '2026-10-05', countedCash: 4000, variance: 0, varianceNote: undefined });
    let reads = 0;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/cashcount/today') return jsonResponse(reads++ === 0 ? buildPreview() : buildPreview({ closed }));
      if (init?.method === 'POST') return jsonResponse({ error: 'conflict', message: 'The day 2026-10-05 is already closed' }, 409);
      return jsonResponse([]);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ArqueoView />);
    await user.type(await screen.findByLabelText('Efectivo contado'), '4000');
    await user.click(screen.getByRole('button', { name: 'Cerrar el día' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }));

    expect(await screen.findByText('El día está cerrado.')).toBeInTheDocument();
    expect(screen.getByText('Otra persona ya cerró el día. Se muestra el cierre registrado.')).toBeInTheDocument();
  });
});

describe('ArqueoView: a closed day and failures', () => {
  it('shows the close of today instead of the form', async () => {
    stubServer({ preview: buildPreview({ closed: buildCashCount({ businessDate: '2026-10-05', countedCash: 4000, variance: 0, varianceNote: undefined }) }) });
    render(<ArqueoView />);

    expect(await screen.findByText('El día está cerrado.')).toBeInTheDocument();
    expect(screen.getByTestId('closed-variance')).toHaveTextContent('Sin diferencia');
    expect(screen.queryByRole('button', { name: 'Cerrar el día' })).not.toBeInTheDocument();
  });

  it('shows an error with a retry that loads again', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (fetchMock.mock.calls.length <= 2) throw new TypeError('offline');
      return jsonResponse(url === '/api/cashcount/today' ? buildPreview() : []);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ArqueoView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Arqueo del 05/10/2026' })).toBeInTheDocument();
  });
});
