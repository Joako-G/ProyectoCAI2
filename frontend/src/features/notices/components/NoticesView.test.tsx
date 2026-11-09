import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { buildNotice, buildNoticeList } from '../test/fixtures';
import type { DebtNoticeList } from '../types/notice';
import { NoticesView } from './NoticesView';

afterEach(() => vi.unstubAllGlobals());

function stubList(list: DebtNoticeList) {
  const fetchMock = vi.fn(async () => jsonResponse(list));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('NoticesView', () => {
  it('shows a loading message, then the members with debt and the date the totals are for', async () => {
    stubList(buildNoticeList([buildNotice()]));
    render(<NoticesView />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando los avisos');
    expect(await screen.findByRole('heading', { name: 'Avisos de deuda al 01/11/2026' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Socios con deuda' });
    const [row] = within(table).getAllByRole('row').slice(1);
    expect(row).toHaveTextContent('101');
    expect(row).toHaveTextContent('Lucía Prueba');
    expect(row).toHaveTextContent('Deudor');
    expect(row).toHaveTextContent('2');
    expect(row).toHaveTextContent('$ 80.000');
    expect(screen.getByText(/puede cambiar según la fecha de pago/)).toBeInTheDocument();
  });

  it('opens the WhatsApp link of a usable row in a new tab', async () => {
    stubList(buildNoticeList([buildNotice({ link: 'https://wa.me/5493815550101?text=Hola' })]));
    render(<NoticesView />);

    const link = await screen.findByRole('link', { name: /Enviar por WhatsApp/ });
    expect(link).toHaveAttribute('href', 'https://wa.me/5493815550101?text=Hola');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('identifies deregistered members', async () => {
    stubList(buildNoticeList([buildNotice({ standing: 'deregistered', unpaidPeriodCount: 5 })]));
    render(<NoticesView />);

    expect(await screen.findByText('Dado de baja')).toBeInTheDocument();
    expect(screen.queryByText('Deudor')).not.toBeInTheDocument();
  });

  it('names the guardian as the recipient of a minor', async () => {
    stubList(buildNoticeList([buildNotice({ name: 'Tomás Prueba', recipient: 'guardian', recipientName: 'Ana Prueba', recipientContact: '1155552222' })]));
    render(<NoticesView />);

    const row = (await screen.findAllByRole('row'))[1]!;
    expect(row).toHaveTextContent('Responsable: Ana Prueba · 1155552222');
  });

  it('shows a correction notice and no link when the number cannot be used', async () => {
    stubList(buildNoticeList([buildNotice({ link: null, numberIssue: true })]));
    render(<NoticesView />);

    expect(await screen.findByText(/Número de WhatsApp no válido/)).toBeInTheDocument();
    expect(screen.getByText(/Corríjalo en la ficha del socio/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Enviar por WhatsApp/ })).not.toBeInTheDocument();
  });

  it('asks to correct the guardian contact when the guardian is the recipient', async () => {
    stubList(buildNoticeList([buildNotice({ link: null, numberIssue: true, recipient: 'guardian', recipientName: 'Ana Prueba' })]));
    render(<NoticesView />);

    expect(await screen.findByText(/contacto del responsable/)).toBeInTheDocument();
  });

  it('shows an empty state when nobody owes anything', async () => {
    stubList(buildNoticeList([]));
    render(<NoticesView />);

    expect(await screen.findByText('No hay socios con deuda para avisar.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an error with a retry that loads the list again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'internal_error', message: 'boom' }, 500))
      .mockResolvedValueOnce(jsonResponse(buildNoticeList([buildNotice()])));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<NoticesView />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los avisos');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('link', { name: /Enviar por WhatsApp/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('explains a missing permission and a lost connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'forbidden', message: 'Forbidden' }, 403)));
    const { unmount } = render(<NoticesView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso para ver los avisos.');
    unmount();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network'); }));
    render(<NoticesView />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con el servidor.');
  });
});
