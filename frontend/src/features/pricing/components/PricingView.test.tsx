import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildPricingConfig, buildTariff } from '../test/fixtures';
import type { PricingConfig } from '../types/pricing';
import { PricingView } from './PricingView';

beforeEach(() => {
  // Only Date is faked, so promises and timers keep working; "today" is 26 Oct 2026.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 26));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Serves GETs from `config`, answers writes with `writes` (keyed `METHOD url`) or echoes them. */
function stubApi(config: PricingConfig = buildPricingConfig(), writes: Record<string, Response> = {}) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const forced = writes[`${method} ${String(url)}`];
    if (forced) return forced;
    if (method === 'GET') return jsonResponse(config);
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse(JSON.parse(String(init?.body)));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const writesMade = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');

const tariffsRegion = () => screen.getByRole('region', { name: 'Tarifas' });
const tiersRegion = () => screen.getByRole('region', { name: 'Recargos por pago tardío' });
const prorationRegion = () => screen.getByRole('region', { name: 'Prorrateo para socios nuevos' });

describe('PricingView', () => {
  it('lists the tariffs by date as the price history and marks the one in force', async () => {
    stubApi();
    render(<PricingView canWrite />);

    const table = await within(await screen.findByRole('region', { name: 'Tarifas' })).findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent))
      .toEqual(['Vigente desde', 'Matrícula', 'Cuota social', 'Cuota por actividad', 'Reposición de carnet', 'Estado', 'Acciones']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['01/2026', '10/2026', '12/2026']);
    expect(within(rows[1]).getAllByRole('cell').slice(1, 6).map((cell) => cell.textContent))
      .toEqual(['$ 20.000', '$ 15.000', '$ 18.000', '$ 13.000', 'Vigente']);
    expect(within(rows[0]).getByText('Anterior')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Próxima')).toBeInTheDocument();
    expect(within(table).getAllByText('Vigente')).toHaveLength(1);
  });

  it('lets a head secretary change current and future tariffs but never a past one', async () => {
    stubApi();
    render(<PricingView canWrite />);

    await screen.findByRole('table', { name: 'Tarifas' });
    expect(screen.queryByRole('button', { name: 'Editar tarifa 01/2026' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar tarifa 01/2026' })).not.toBeInTheDocument();
    for (const period of ['10/2026', '12/2026']) {
      expect(screen.getByRole('button', { name: `Editar tarifa ${period}` })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Eliminar tarifa ${period}` })).toBeInTheDocument();
    }
  });

  it('shows a secretary the whole configuration with no way to change it', async () => {
    const fetchMock = stubApi();
    render(<PricingView canWrite={false} />);

    await screen.findByRole('table', { name: 'Tarifas' });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(tiersRegion()).getByRole('table')).toHaveTextContent('$ 10.000');
    expect(prorationRegion()).toHaveTextContent('50 %');
    expect(writesMade(fetchMock)).toHaveLength(0);
  });

  it('adds a future tariff and reloads the configuration', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    const form = within(screen.getByRole('group', { name: 'Nueva tarifa' }));
    fireEvent.change(form.getByLabelText('Vigente desde'), { target: { value: '2027-02' } });
    await user.type(form.getByLabelText('Matrícula'), '21000');
    await user.type(form.getByLabelText('Cuota social'), '18000');
    await user.type(form.getByLabelText('Cuota por actividad'), '19000');
    await user.type(form.getByLabelText('Reposición de carnet'), '14000');
    await user.click(form.getByRole('button', { name: 'Agregar tarifa' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tarifa guardada.');
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/tariffs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ effectiveFrom: '2027-02', enrollment: 21000, socialFee: 18000, activityFee: 19000, carnetReplacement: 14000 }),
    });
    expect(fetchMock.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2);
  });

  it('rejects a past month and bad amounts on the client without sending anything', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    const form = within(screen.getByRole('group', { name: 'Nueva tarifa' }));
    fireEvent.change(form.getByLabelText('Vigente desde'), { target: { value: '2026-09' } });
    await user.type(form.getByLabelText('Matrícula'), '1.5');
    await user.click(form.getByRole('button', { name: 'Agregar tarifa' }));

    expect(form.getByText('Elija el mes actual o uno posterior.')).toBeInTheDocument();
    expect(form.getAllByText('Ingrese un monto entero en pesos.')).toHaveLength(4);
    expect(writesMade(fetchMock)).toHaveLength(0);
  });

  it('edits a future tariff in place, with its date fixed', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    await user.click(screen.getByRole('button', { name: 'Editar tarifa 12/2026' }));
    const form = within(screen.getByRole('group', { name: 'Editar tarifa 12/2026' }));
    expect(form.getByLabelText('Cuota social')).toHaveValue('17000');
    expect(form.queryByLabelText('Vigente desde')).not.toBeInTheDocument();
    await user.clear(form.getByLabelText('Cuota social'));
    await user.type(form.getByLabelText('Cuota social'), '19000');
    await user.click(form.getByRole('button', { name: 'Guardar tarifa' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tarifa guardada.');
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/tariffs/2026-12', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ effectiveFrom: '2026-12', enrollment: 20000, socialFee: 19000, activityFee: 18000, carnetReplacement: 13000 }),
    }));
  });

  it('shows the backend conflicts in Spanish next to the tariff form', async () => {
    stubApi(buildPricingConfig(), {
      'POST /api/pricing/tariffs': jsonResponse({ error: 'conflict', message: 'A tariff already starts on 2027-02' }, 409),
    });
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    const form = within(screen.getByRole('group', { name: 'Nueva tarifa' }));
    fireEvent.change(form.getByLabelText('Vigente desde'), { target: { value: '2027-02' } });
    for (const label of ['Matrícula', 'Cuota social', 'Cuota por actividad', 'Reposición de carnet']) {
      await user.type(form.getByLabelText(label), '1000');
    }
    await user.click(form.getByRole('button', { name: 'Agregar tarifa' }));

    expect(await within(tariffsRegion()).findByRole('alert')).toHaveTextContent('Ya existe una tarifa para ese mes.');
  });

  it('maps the past-month conflict to Spanish copy', async () => {
    stubApi(buildPricingConfig(), {
      'PUT /api/pricing/tariffs/2026-12': jsonResponse({ error: 'conflict', message: 'The tariff starting on 2026-12 is in the past and cannot be replaced' }, 409),
    });
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    await user.click(screen.getByRole('button', { name: 'Editar tarifa 12/2026' }));
    await user.click(screen.getByRole('button', { name: 'Guardar tarifa' }));

    expect(await within(tariffsRegion()).findByRole('alert')).toHaveTextContent('Las tarifas de meses pasados no se pueden modificar.');
  });

  it('asks for confirmation before deleting and explains a refused delete', async () => {
    const fetchMock = stubApi(buildPricingConfig(), {
      'DELETE /api/pricing/tariffs/2026-10': jsonResponse({ error: 'conflict', message: 'Deleting this tariff would leave no tariff in force for the current month' }, 409),
    });
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    await user.click(screen.getByRole('button', { name: 'Eliminar tarifa 12/2026' }));
    expect(writesMade(fetchMock)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Confirmar eliminación' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar tarifa 10/2026' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    expect(await within(tariffsRegion()).findByRole('alert')).toHaveTextContent('No se puede eliminar: el mes actual quedaría sin tarifa vigente.');
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/tariffs/2026-10', { method: 'DELETE' });
  });

  it('validates the surcharge tiers before sending and then saves them', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    const tiers = within(tiersRegion());
    await user.clear(tiers.getByLabelText('Desde el día, tramo 1'));
    await user.type(tiers.getByLabelText('Desde el día, tramo 1'), '2');
    await user.click(tiers.getByRole('button', { name: 'Guardar recargos' }));
    expect(tiers.getByRole('alert')).toHaveTextContent('El primer tramo debe empezar el día 1.');
    expect(writesMade(fetchMock)).toHaveLength(0);

    await user.clear(tiers.getByLabelText('Desde el día, tramo 1'));
    await user.type(tiers.getByLabelText('Desde el día, tramo 1'), '1');
    await user.click(tiers.getByRole('button', { name: 'Agregar tramo' }));
    await user.type(tiers.getByLabelText('Desde el día, tramo 3'), '21');
    await user.type(tiers.getByLabelText('Recargo, tramo 3'), '20000');
    await user.click(tiers.getByRole('button', { name: 'Guardar recargos' }));

    expect(await tiers.findByRole('status')).toHaveTextContent('Recargos guardados.');
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/surcharge-tiers', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify([{ fromDay: 1, amount: 0 }, { fromDay: 11, amount: 10000 }, { fromDay: 21, amount: 20000 }]),
    }));
  });

  it('removes a tier row', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    await user.click(within(tiersRegion()).getByRole('button', { name: 'Quitar tramo 2' }));
    expect(within(tiersRegion()).queryByLabelText('Desde el día, tramo 2')).not.toBeInTheDocument();
  });

  it('validates the proration rule, states the social fee is never discounted, and saves it', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    const proration = within(prorationRegion());
    expect(prorationRegion()).toHaveTextContent('La cuota social nunca se descuenta.');
    await user.clear(proration.getByLabelText('Porcentaje de la cuota por actividad'));
    await user.type(proration.getByLabelText('Porcentaje de la cuota por actividad'), '120');
    await user.click(proration.getByRole('button', { name: 'Guardar prorrateo' }));
    expect(proration.getByText('Ingrese un porcentaje entero entre 0 y 100.')).toBeInTheDocument();
    expect(writesMade(fetchMock)).toHaveLength(0);

    await user.clear(proration.getByLabelText('Porcentaje de la cuota por actividad'));
    await user.type(proration.getByLabelText('Porcentaje de la cuota por actividad'), '60');
    await user.click(proration.getByRole('button', { name: 'Guardar prorrateo' }));
    expect(await proration.findByRole('status')).toHaveTextContent('Prorrateo guardado.');
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/proration-rule', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ afterDay: 15, activityPercent: 60 }),
    }));
  });

  const fillNewTariff = async (user: ReturnType<typeof userEvent.setup>, month = '2027-02') => {
    const form = within(screen.getByRole('group', { name: 'Nueva tarifa' }));
    fireEvent.change(form.getByLabelText('Vigente desde'), { target: { value: month } });
    for (const label of ['Matrícula', 'Cuota social', 'Cuota por actividad', 'Reposición de carnet']) {
      await user.type(form.getByLabelText(label), '1000');
    }
    await user.click(form.getByRole('button', { name: 'Agregar tarifa' }));
  };

  it('keeps the screen and the success notice when the re-read after a saved write fails', async () => {
    const config = buildPricingConfig();
    const retry = { ok: false };
    let reads = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse(JSON.parse(String(init.body)), 201);
      reads += 1;
      if (reads > 1 && !retry.ok) throw new TypeError('offline');
      return jsonResponse(config);
    }));
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    await fillNewTariff(user);

    expect(await within(tariffsRegion()).findByRole('status')).toHaveTextContent('Tarifa guardada.');
    expect(screen.getByRole('alert')).toHaveTextContent('El cambio se guardó, pero no se pudo actualizar la lista. Reintentá para ver los datos al día.');
    expect(screen.getByRole('table', { name: 'Tarifas' })).toBeInTheDocument();
    expect(tiersRegion()).toBeInTheDocument();

    retry.ok = true;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(tariffsRegion()).toBeInTheDocument();
  });

  it('re-reads after a write that failed with a network error and keeps the error visible', async () => {
    const config = buildPricingConfig();
    const fetchMock = stubApi(config);
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, init) => {
      if (init?.method === 'POST') throw new TypeError('offline');
      return base(url, init);
    });
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });
    config.tariffs.push(buildTariff({ effectiveFrom: '2027-03' }));

    await fillNewTariff(user);

    expect(await screen.findByRole('row', { name: /03\/2027/ })).toBeInTheDocument();
    expect(within(tariffsRegion()).getByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
  });

  it('re-reads after a 409 so the table matches the server, keeping the message', async () => {
    const config = buildPricingConfig();
    stubApi(config, {
      'POST /api/pricing/tariffs': jsonResponse({ error: 'conflict', message: 'A tariff already starts on 2027-02' }, 409),
    });
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });
    config.tariffs.push(buildTariff({ effectiveFrom: '2027-02' }));

    await fillNewTariff(user);

    expect(await screen.findByRole('row', { name: /02\/2027/ })).toBeInTheDocument();
    expect(within(tariffsRegion()).getByRole('alert')).toHaveTextContent('Ya existe una tarifa para ese mes.');
  });

  it('does not re-read after a 400 or a 403', async () => {
    const fetchMock = stubApi(buildPricingConfig(), {
      'POST /api/pricing/tariffs': jsonResponse({ error: 'validation_error', message: 'Invalid', fieldErrors: {} }, 400),
      'PUT /api/pricing/proration-rule': jsonResponse({ error: 'forbidden', message: 'Forbidden' }, 403),
    });
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });

    await fillNewTariff(user);
    expect(await within(tariffsRegion()).findByRole('alert')).toHaveTextContent('El servidor rechazó los valores ingresados.');
    await user.click(within(prorationRegion()).getByRole('button', { name: 'Guardar prorrateo' }));
    expect(await within(prorationRegion()).findByRole('alert')).toHaveTextContent('No tiene permiso para modificar los precios.');
    expect(fetchMock.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(1);
  });

  it('deletes a tariff, shows the notice and the refreshed list without it', async () => {
    const config = buildPricingConfig();
    const fetchMock = stubApi(config);
    const user = userEvent.setup();
    render(<PricingView canWrite />);
    await screen.findByRole('table', { name: 'Tarifas' });
    config.tariffs = config.tariffs.filter((tariff) => tariff.effectiveFrom !== '2026-12');

    await user.click(screen.getByRole('button', { name: 'Editar tarifa 12/2026' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar tarifa 12/2026' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));

    expect(await within(tariffsRegion()).findByRole('status')).toHaveTextContent('Tarifa eliminada.');
    expect(screen.queryByRole('row', { name: /12\/2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Editar tarifa 12/2026' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/pricing/tariffs/2026-12', { method: 'DELETE' });
  });

  it('shows a loading state, then an error with a retry that reloads', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse(buildPricingConfig()));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<PricingView canWrite />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los precios.');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table', { name: 'Tarifas' })).toBeInTheDocument();
  });

  it('tells when there are no tariffs yet', async () => {
    stubApi(buildPricingConfig({ tariffs: [] }));
    render(<PricingView canWrite={false} />);
    expect(await screen.findByText('Todavía no hay tarifas cargadas.')).toBeInTheDocument();
  });
});
