import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraError } from '../../faces/services/camera';
import { createFakeTools, DESCRIPTOR, type FakeTools } from '../../faces/test/fakes';
import { jsonResponse } from '../../members/test/fixtures';
import { buildAccessCheck } from '../test/fixtures';
import type { AccessCheck } from '../types/access';
import { AccessView } from './AccessView';

const tools = vi.hoisted(() => ({ current: undefined as unknown as FakeTools }));
vi.mock('../../faces/services/face-tools', () => ({
  faceTools: {
    openCamera: () => tools.current.openCamera(),
    loadDetector: () => tools.current.loadDetector(),
  },
}));

// Fast timing so the tests wait milliseconds, not seconds; the pause is long enough to observe it.
const TIMING = { scanIntervalMs: 5, stableScans: 2, pauseMs: 150 };

let fetchMock: ReturnType<typeof vi.fn>;
const recognizeCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/faces/recognize');

function stubApi(recognize: () => Response | Promise<Response> = () => jsonResponse(buildAccessCheck())) {
  fetchMock = vi.fn(async (url: string) => (url === '/api/faces/recognize' ? recognize() : jsonResponse(buildAccessCheck({ result: 'red', reason: 'not_found' }))));
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  tools.current = createFakeTools();
});
afterEach(() => vi.unstubAllGlobals());

const cameraButton = () => screen.getByRole('button', { name: 'Cámara' });

describe('AccessView camera mode', () => {
  it('stays off until "Cámara" is pressed, and the DNI field is always there', () => {
    stubApi();
    render(<AccessView timing={TIMING} />);
    expect(screen.getByLabelText('DNI del socio')).toBeInTheDocument();
    expect(cameraButton()).toHaveAttribute('aria-pressed', 'false');
    expect(tools.current.openCamera).not.toHaveBeenCalled();
    expect(tools.current.loadDetector).not.toHaveBeenCalled();
  });

  it('recognizes a stable single face, sending only the descriptor, and shows the same result panel', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());

    expect(await screen.findByText('Puede ingresar')).toBeInTheDocument();
    expect(cameraButton()).toHaveAttribute('aria-pressed', 'true');
    const [, init] = recognizeCalls()[0]!;
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init.body))).toEqual({ descriptor: DESCRIPTOR });
    expect(screen.getByText(/Lucía Prueba/)).toBeInTheDocument();
  });

  it('shows "No reconocido — ingrese el DNI" in red when nobody matches', async () => {
    const answer: AccessCheck = { result: 'red', reason: 'not_recognized' };
    stubApi(() => jsonResponse(answer));
    const user = userEvent.setup();
    render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());

    expect(await screen.findByText('No reconocido — ingrese el DNI')).toBeInTheDocument();
    expect(document.querySelector('.access-live')).toHaveAttribute('data-result', 'red');
  });

  it('pauses after an answer before looking again, so one face is not sent repeatedly', async () => {
    stubApi();
    const user = userEvent.setup();
    render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());
    await screen.findByText('Puede ingresar');

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(recognizeCalls()).toHaveLength(1);
    await waitFor(() => expect(recognizeCalls().length).toBeGreaterThanOrEqual(2), { timeout: 2000 });
  });

  it('does not send anything when the face is not stable or there are several faces', async () => {
    stubApi();
    const scans = [{ kind: 'one' as const, descriptor: DESCRIPTOR }, { kind: 'none' as const }];
    let index = 0;
    tools.current.detector.detect.mockImplementation(async () => scans[index++ % 2]!);
    const user = userEvent.setup();
    render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());
    await waitFor(() => expect(tools.current.detector.detect.mock.calls.length).toBeGreaterThan(6));
    tools.current.detector.detect.mockImplementation(async () => ({ kind: 'many' as const }));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(recognizeCalls()).toHaveLength(0);
  });

  it('keeps the DNI field working while the camera is on', async () => {
    stubApi();
    tools.current.detector.detect.mockResolvedValue({ kind: 'none' });
    const user = userEvent.setup();
    render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());
    await user.type(screen.getByLabelText('DNI del socio'), '30111222{Enter}');

    expect(await screen.findByText('No puede ingresar — DNI no registrado')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/access/check')).toBe(true);
  });

  it('stops the camera when switching mode off and when leaving the screen', async () => {
    stubApi();
    tools.current.detector.detect.mockResolvedValue({ kind: 'none' });
    const user = userEvent.setup();
    const { unmount } = render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());
    await waitFor(() => expect(tools.current.detector.detect).toHaveBeenCalled());
    await user.click(cameraButton());
    expect(tools.current.cam.stop).toHaveBeenCalledTimes(1);
    expect(cameraButton()).toHaveAttribute('aria-pressed', 'false');

    await user.click(cameraButton());
    await waitFor(() => expect(tools.current.openCamera).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(cameraButton()).toHaveAttribute('aria-pressed', 'true'));
    await waitFor(() => expect(tools.current.detector.detect.mock.calls.length).toBeGreaterThan(1));
    unmount();
    expect(tools.current.cam.stop).toHaveBeenCalledTimes(2);
  });

  it('says the recognition is unavailable on 503 and releases the camera', async () => {
    stubApi(() => jsonResponse({ error: 'faces_unavailable', message: 'x' }, 503));
    const user = userEvent.setup();
    render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Reconocimiento facial no disponible — use el DNI');
    await waitFor(() => expect(tools.current.cam.stop).toHaveBeenCalled());
    expect(cameraButton()).toHaveAttribute('aria-pressed', 'false');
    expect(recognizeCalls()).toHaveLength(1);
  });

  it('explains a camera that cannot be opened and leaves the DNI usable', async () => {
    stubApi();
    tools.current.openCamera.mockRejectedValue(new CameraError('denied'));
    const user = userEvent.setup();
    render(<AccessView timing={TIMING} />);
    await user.click(cameraButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Se denegó el permiso de la cámara. Habilítelo en el navegador.');
    expect(screen.getByLabelText('DNI del socio')).toBeEnabled();
  });
});
