import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../members/test/fixtures';
import { CameraError } from '../services/camera';
import { createFakeTools, DESCRIPTOR, FAR_FACTS, NO_FACE_FACTS, TWO_FACES_FACTS, type FakeTools } from '../test/fakes';
import { FaceEnrollment } from './FaceEnrollment';

const tools = vi.hoisted(() => ({ current: undefined as unknown as FakeTools }));
vi.mock('../services/face-tools', () => ({
  faceTools: {
    openCamera: () => tools.current.openCamera(),
    loadDetector: () => tools.current.loadDetector(),
  },
}));

const CONSENT = 'El socio (o su tutor, si es menor) autorizó el uso de su imagen para reconocimiento facial';
const UNAVAILABLE = 'El reconocimiento facial no está disponible en este momento.';

let fetchMock: ReturnType<typeof vi.fn>;

interface Api {
  enrolled?: boolean;
  put?: () => Response;
  del?: () => Response;
  get?: () => Response;
}

/** Routes by method; `enrolled` is what GET answers, and `put` / `del` / `get` let a test change an outcome. */
function stubApi({ enrolled = false, put = () => new Response(null, { status: 204 }), del = () => new Response(null, { status: 204 }), get }: Api = {}) {
  let state = enrolled;
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (method === 'PUT') {
      const response = put();
      if (response.ok) state = true;
      return response;
    }
    if (method === 'DELETE') {
      const response = del();
      if (response.ok) state = false;
      return response;
    }
    return get ? get() : jsonResponse(state ? { enrolled: true, enrolledAt: '2026-11-07T15:00:00.000Z' } : { enrolled: false });
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  tools.current = createFakeTools();
});
afterEach(() => vi.unstubAllGlobals());

const writes = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT' || init?.method === 'DELETE');

async function openAndTick(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
  await user.click(await screen.findByLabelText(CONSENT));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Capturar y guardar' })).toBeEnabled());
}

describe('FaceEnrollment', () => {
  it('says there is no face yet and does not touch the camera until asked', async () => {
    stubApi();
    render(<FaceEnrollment memberId="m1" />);
    expect(await screen.findByText('Sin cara registrada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reconocimiento facial' })).toBeInTheDocument();
    expect(tools.current.openCamera).not.toHaveBeenCalled();
    expect(tools.current.loadDetector).not.toHaveBeenCalled();
  });

  it('says a face is registered and offers to delete it', async () => {
    stubApi({ enrolled: true });
    render(<FaceEnrollment memberId="m1" />);
    expect(await screen.findByText('Cara registrada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrar cara' })).toBeInTheDocument();
  });

  it('opens the camera, needs the consent ticked, and then enrolls only the descriptor with the consent', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<FaceEnrollment memberId="m1" />);
    await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));

    const capture = await screen.findByRole('button', { name: 'Capturar y guardar' });
    expect(capture).toBeDisabled();
    expect(screen.getByLabelText(CONSENT)).not.toBeChecked();
    await user.click(screen.getByLabelText(CONSENT));
    await waitFor(() => expect(capture).toBeEnabled());
    await user.click(capture);

    expect(await screen.findByText('Cara registrada')).toBeInTheDocument();
    const [url, init] = writes()[0]!;
    expect(url).toBe('/api/faces/m1');
    expect(JSON.parse(String(init.body))).toEqual({ descriptor: DESCRIPTOR, consent: true });
    // The camera is released once the face is saved.
    expect(tools.current.cam.stop).toHaveBeenCalled();
  });

  it.each([
    [NO_FACE_FACTS, 'No veo ninguna cara'],
    [TWO_FACES_FACTS, 'Debe haber una sola persona frente a la cámara'],
    [FAR_FACTS, 'Acercate'],
  ])('guides the person and keeps the capture locked while the frame is not good (%j)', async (facts, hint) => {
    stubApi();
    tools.current.detector.look.mockResolvedValue(facts);
    const user = userEvent.setup();
    render(<FaceEnrollment memberId="m1" />);
    await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
    await user.click(await screen.findByLabelText(CONSENT));

    expect(await screen.findByText(hint)).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Capturar y guardar' })).toBeDisabled();
    expect(tools.current.detector.describe).not.toHaveBeenCalled();
    expect(writes()).toHaveLength(0);
  });

  it('says so when the descriptor cannot be computed at the moment of the capture', async () => {
    stubApi();
    tools.current.detector.describe.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<FaceEnrollment memberId="m1" />);
    await openAndTick(user);
    await user.click(screen.getByRole('button', { name: 'Capturar y guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se detectó ninguna cara. Mire a la cámara e intente de nuevo.');
    expect(writes()).toHaveLength(0);
  });

  it.each([
    ['denied', 'Se denegó el permiso de la cámara. Habilítelo en el navegador.'],
    ['not_found', 'No se encontró ninguna cámara en este equipo.'],
    ['unsupported', 'Este navegador no permite usar la cámara. Use localhost o HTTPS.'],
  ] as const)('explains a camera failure (%s)', async (code, message) => {
    stubApi();
    tools.current.openCamera.mockRejectedValue(new CameraError(code));
    const user = userEvent.setup();
    render(<FaceEnrollment memberId="m1" />);
    await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('shows the Spanish unavailable message when the server answers 503 faces_unavailable on save', async () => {
    stubApi({ put: () => jsonResponse({ error: 'faces_unavailable', message: 'x' }, 503) });
    const user = userEvent.setup();
    render(<FaceEnrollment memberId="m1" />);
    await openAndTick(user);
    await user.click(screen.getByRole('button', { name: 'Capturar y guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(UNAVAILABLE);
  });

  it('shows the unavailable message when the status cannot be read', async () => {
    stubApi({ get: () => jsonResponse({ error: 'faces_unavailable', message: 'x' }, 503) });
    render(<FaceEnrollment memberId="m1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(UNAVAILABLE);
    expect(screen.queryByRole('button', { name: 'Registrar cara' })).not.toBeInTheDocument();
  });

  it('asks before deleting the face, and deletes it on confirmation', async () => {
    stubApi({ enrolled: true });
    const user = userEvent.setup();
    render(<FaceEnrollment memberId="m1" />);
    await user.click(await screen.findByRole('button', { name: 'Borrar cara' }));
    expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Sí, borrar' }));
    expect(await screen.findByText('Sin cara registrada')).toBeInTheDocument();
    expect(writes()[0]![1]).toMatchObject({ method: 'DELETE' });
  });

  it('keeps the face when the deletion is cancelled', async () => {
    stubApi({ enrolled: true });
    const user = userEvent.setup();
    render(<FaceEnrollment memberId="m1" />);
    await user.click(await screen.findByRole('button', { name: 'Borrar cara' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(writes()).toHaveLength(0);
    expect(screen.getByText('Cara registrada')).toBeInTheDocument();
  });

  it('stops the camera stream when the panel is closed and when the screen unmounts', async () => {
    stubApi();
    const user = userEvent.setup();
    const { unmount } = render(<FaceEnrollment memberId="m1" />);
    await user.click(await screen.findByRole('button', { name: 'Registrar cara' }));
    await screen.findByRole('button', { name: 'Capturar y guardar' });
    await user.click(screen.getByRole('button', { name: 'Cerrar cámara' }));
    expect(tools.current.cam.stop).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Registrar cara' }));
    await screen.findByRole('button', { name: 'Capturar y guardar' });
    unmount();
    expect(tools.current.cam.stop).toHaveBeenCalledTimes(2);
  });
});
