import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { CameraError } from '../services/camera';
import { createFakeTools, type FakeTools } from '../test/fakes';
import type { EnrollmentSession } from '../types/enrollment';
import { FaceEnrollment } from './FaceEnrollment';

const tools = vi.hoisted(() => ({ current: undefined as unknown as FakeTools }));
vi.mock('../services/face-tools', () => ({
  faceTools: {
    openCamera: () => tools.current.openCamera(),
    loadDetector: () => tools.current.loadDetector(),
  },
}));

const CONSENT = 'El socio (o su tutor, si es menor) autorizó el uso de su imagen para reconocimiento facial';
const session = (overrides: Partial<EnrollmentSession> = {}): EnrollmentSession => ({
  id: 's1',
  memberId: 'm1',
  firstName: 'Ana',
  status: 'waiting',
  hint: '',
  captures: 0,
  total: 3,
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  ...overrides,
});

let fetchMock: ReturnType<typeof vi.fn>;
let displayConnected: boolean;
let current: EnrollmentSession;
let active: EnrollmentSession | null;
let open: () => Response;
let enrolled: boolean;
const callsTo = (suffix: string, method?: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(suffix) && (!method || (init?.method ?? 'GET') === method));

beforeEach(() => {
  tools.current = createFakeTools();
  displayConnected = true;
  current = session();
  active = null;
  enrolled = false;
  open = () => jsonResponse({ session: current }, 201);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/faces/enrollments/display') return jsonResponse({ connected: displayConnected });
    if (url === '/api/faces/enrollments/active') return jsonResponse({ session: active });
    if (url === '/api/faces/enrollments' && method === 'POST') return open();
    if (url === '/api/faces/enrollments/s1' && method === 'GET') return jsonResponse(current);
    if (url === '/api/faces/enrollments/s1/cancel') {
      current = { ...current, status: 'cancelled' };
      return new Response(null, { status: 204 });
    }
    if (url === '/api/faces/m1') return jsonResponse(enrolled ? { enrolled: true, enrolledAt: '2026-11-09T15:00:00.000Z' } : { enrolled: false });
    return jsonResponse({});
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function show() {
  return render(<FaceEnrollment memberId="m1" followIntervalMs={10} />);
}

async function startOnPublicScreen(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(callsTo('/display')).not.toHaveLength(0));
  await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
  await user.click(await screen.findByLabelText(CONSENT));
  await user.click(screen.getByRole('button', { name: 'Registrar en la pantalla pública' }));
}

describe('FaceEnrollment with a public screen connected', () => {
  it('offers both places only when a public screen is connected, and keeps the camera closed until chosen', async () => {
    const user = userEvent.setup();
    show();
    await waitFor(() => expect(callsTo('/display')).not.toHaveLength(0));
    await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
    expect(await screen.findByRole('button', { name: 'Registrar en la pantalla pública' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Registrar en esta pantalla' })).toBeEnabled();
    expect(tools.current.openCamera).not.toHaveBeenCalled();
  });

  it('requires the consent before opening the session, and sends it with the member', async () => {
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    expect(await screen.findByText('Esperando a que Ana mire la pantalla pública…')).toBeInTheDocument();
    const [[, init]] = callsTo('', 'POST').filter(([url]) => url === '/api/faces/enrollments');
    expect(JSON.parse(String(init.body))).toEqual({ memberId: 'm1', consent: true });
    expect(tools.current.openCamera).not.toHaveBeenCalled();
  });

  it('follows the progress: the hint the member reads, and the capture they are on', async () => {
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    await screen.findByText('Esperando a que Ana mire la pantalla pública…');
    current = session({ status: 'capturing', hint: 'Acercate', captures: 1 });
    expect(await screen.findByText('Captura 2 de 3')).toBeInTheDocument();
    expect(screen.getByText('La pantalla le indica a Ana: Acercate')).toBeInTheDocument();
  });

  it('shows the face as registered when the session completes', async () => {
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    await screen.findByText('Esperando a que Ana mire la pantalla pública…');
    enrolled = true;
    current = session({ status: 'completed', captures: 3 });
    expect(await screen.findByText('Cara registrada en la pantalla pública.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Cara registrada')).toBeInTheDocument());
    expect(screen.queryByText('Registro en la pantalla pública')).not.toBeInTheDocument();
  });

  it('cancels from the secretary screen and says so', async () => {
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    await user.click(await screen.findByRole('button', { name: 'Cancelar registro' }));
    expect(await screen.findByText('El registro se canceló.')).toBeInTheDocument();
    expect(callsTo('/cancel', 'POST')).toHaveLength(1);
    expect(await screen.findByRole('button', { name: 'Registrar cara' })).toBeInTheDocument();
  });

  it('says what happened when the session fails or times out', async () => {
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    await screen.findByText('Esperando a que Ana mire la pantalla pública…');
    current = session({ status: 'expired' });
    expect(await screen.findByText('Se agotó el tiempo del registro. Intente de nuevo.')).toBeInTheDocument();
  });

  it('tells the secretary when the server refuses to open it, and offers the in-window path again', async () => {
    open = () => jsonResponse({ error: 'conflict', message: 'Another face enrollment is in progress' }, 409);
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    expect(await screen.findByText('No se pudo iniciar el registro: hay otro registro en curso o la pantalla pública no está conectada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar en esta pantalla' })).toBeEnabled();
  });

  it('keeps the in-window enrollment: "Registrar en esta pantalla" opens the camera here', async () => {
    const user = userEvent.setup();
    show();
    await waitFor(() => expect(callsTo('/display')).not.toHaveLength(0));
    await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
    await user.click(await screen.findByRole('button', { name: 'Registrar en esta pantalla' }));
    expect(await screen.findByRole('button', { name: 'Capturar y guardar' })).toBeInTheDocument();
    await waitFor(() => expect(tools.current.openCamera).toHaveBeenCalled());
  });

  it('follows again a session already running for this member after a reload', async () => {
    active = session({ status: 'capturing', hint: 'Centrá la cara', captures: 0 });
    show();
    expect(await screen.findByText('La pantalla le indica a Ana: Centrá la cara')).toBeInTheDocument();
  });

  it('ignores a running session that belongs to another member', async () => {
    active = session({ memberId: 'other' });
    show();
    expect(await screen.findByRole('button', { name: 'Registrar cara' })).toBeInTheDocument();
    expect(screen.queryByText('Registro en la pantalla pública')).not.toBeInTheDocument();
  });

  it('tells the secretary when the follow-up is lost', async () => {
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    await screen.findByText('Esperando a que Ana mire la pantalla pública…');
    fetchMock.mockImplementation(async (url: string) => (url === '/api/faces/enrollments/s1' ? jsonResponse({ error: 'not_found', message: 'x' }, 404) : jsonResponse({ connected: true })));
    expect(await screen.findByText('Se perdió el seguimiento del registro. Verifique si la cara quedó registrada.')).toBeInTheDocument();
  });
});

describe('local camera preview', () => {
  it('is off until asked, shows only the video (no detector) and releases the camera when hidden', async () => {
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    await screen.findByText('Esperando a que Ana mire la pantalla pública…');
    expect(tools.current.openCamera).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ver cámara' }));
    await waitFor(() => expect(tools.current.openCamera).toHaveBeenCalledTimes(1));
    expect(tools.current.loadDetector).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ocultar cámara' }));
    await waitFor(() => expect(tools.current.cam.stop).toHaveBeenCalled());
  });

  it('says there is no camera on a PC without one, and the follow-up keeps working', async () => {
    tools.current.openCamera.mockRejectedValue(new CameraError('not_found'));
    const user = userEvent.setup();
    show();
    await startOnPublicScreen(user);
    await user.click(await screen.findByRole('button', { name: 'Ver cámara' }));
    expect(await screen.findByText(/No hay una cámara disponible en esta PC/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar registro' })).toBeEnabled();
  });
});

describe('FaceEnrollment without a public screen', () => {
  it('opens the camera here as before and never offers the public screen', async () => {
    displayConnected = false;
    const user = userEvent.setup();
    show();
    await waitFor(() => expect(callsTo('/display')).not.toHaveLength(0));
    await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
    expect(await screen.findByRole('button', { name: 'Capturar y guardar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar en la pantalla pública' })).not.toBeInTheDocument();
  });
});
