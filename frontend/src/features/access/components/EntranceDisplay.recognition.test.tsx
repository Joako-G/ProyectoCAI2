import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraError } from '../../faces/services/camera';
import { createFakeTools, DESCRIPTOR, NO_FACE_FACTS, type FakeTools } from '../../faces/test/fakes';
import { jsonResponse } from '../../members/test/fixtures';
import { createFakeSource, FakeSource } from '../test/fake-source';
import type { AccessCheck } from '../types/access';
import type { GreetingEvent } from '../types/greeting';
import { EntranceDisplay } from './EntranceDisplay';

const tools = vi.hoisted(() => ({ current: undefined as unknown as FakeTools }));
vi.mock('../../faces/services/face-tools', () => ({
  faceTools: {
    openCamera: () => tools.current.openCamera(),
    loadDetector: () => tools.current.loadDetector(),
  },
}));

// Fast timing so the tests wait milliseconds; the pause is long enough to observe it.
const TIMING = { scanIntervalMs: 5, stableScans: 2, pauseMs: 120 };
const OTHER_PERSON = Array.from({ length: 128 }, () => 0.1);

const lucia = { id: 'm1', memberNumber: '0101', fullName: 'Lucía Prueba', firstName: 'Lucía', disciplines: [] as string[] };
const upToDate: Partial<GreetingEvent> = { tone: 'welcome', kind: 'up_to_date', firstName: 'Lucía', member: lucia, paidThrough: '2026-08' };
const greenCheck: AccessCheck = { result: 'green', reason: 'up_to_date', member: { memberNumber: '0101', name: 'Lucía Prueba', unpaidPeriodCount: 0, paidThrough: '2026-08' } };
const strangerCheck: AccessCheck = { result: 'red', reason: 'not_recognized' };

let fetchMock: ReturnType<typeof vi.fn>;
let recognize: () => Response | Promise<Response>;
const recognizeCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/faces/recognize');

beforeEach(() => {
  FakeSource.all = [];
  tools.current = createFakeTools();
  recognize = () => jsonResponse(greenCheck);
  fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/faces/recognize') return recognize();
    if (url === '/api/faces/summary') return jsonResponse({ enrolled: 312 });
    return jsonResponse({});
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  FakeSource.all = [];
  vi.unstubAllGlobals();
});

function show(props: { graceMs?: number; checkSession?: () => Promise<boolean> } = {}) {
  return render(
    <EntranceDisplay
      createSource={createFakeSource}
      holdMs={5000}
      reconnectMs={20}
      streamGraceMs={props.graceMs ?? 5000}
      timing={TIMING}
      checkSession={props.checkSession ?? (async () => true)}
    />,
  );
}

const heading = (name: string) => screen.findByRole('heading', { name });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('hands-free recognition', () => {
  it('recognizes a stable face with no button, sending only the descriptor', async () => {
    show();
    await waitFor(() => expect(recognizeCalls()).toHaveLength(1));
    const [, init] = recognizeCalls()[0]!;
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init.body))).toEqual({ descriptor: DESCRIPTOR });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the identifying state with the number of members while the server answers', async () => {
    let answer: (response: Response) => void = () => undefined;
    recognize = () => new Promise<Response>((resolve) => (answer = resolve));
    show();
    expect(await heading('Quedate quieto un segundo…')).toBeInTheDocument();
    expect(await screen.findByText('COMPARANDO CON EL PADRÓN · 312 SOCIOS')).toBeInTheDocument();
    answer(jsonResponse(greenCheck));
  });

  it('shows the result that arrives through the stream, whoever started the check', async () => {
    show();
    await waitFor(() => expect(recognizeCalls()).toHaveLength(1));
    FakeSource.latest().greet(upToDate);
    expect(await heading('Pasá, Lucía')).toBeInTheDocument();
    expect(screen.getByText('REGISTRADO EN EL SISTEMA', { exact: false })).toBeInTheDocument();
  });

  it('does not wait for the stream when the HTTP answer already came after the event', async () => {
    let answer: (response: Response) => void = () => undefined;
    recognize = () => new Promise<Response>((resolve) => (answer = resolve));
    show({ graceMs: 40 });
    await heading('Quedate quieto un segundo…');
    FakeSource.latest().greet(upToDate);
    expect(await heading('Pasá, Lucía')).toBeInTheDocument();
    answer(jsonResponse(greenCheck));
    await wait(80);
    expect(screen.getByRole('heading', { name: 'Pasá, Lucía' })).toBeInTheDocument();
  });

  it('answers from the HTTP response when the stream is disconnected', async () => {
    show();
    FakeSource.latest().fail(false);
    expect(screen.getByText('Reconectando…')).toBeInTheDocument();
    expect(await heading('Pasá, Lucía')).toBeInTheDocument();
    expect(screen.getByText('Lucía Prueba')).toBeInTheDocument();
  });

  it('answers from the HTTP response when the stream is up but the event never arrives', async () => {
    show({ graceMs: 40 });
    FakeSource.latest().open();
    expect(await heading('Pasá, Lucía')).toBeInTheDocument();
    expect(screen.getByText('Tu cuota está paga hasta agosto 2026.')).toBeInTheDocument();
  });

  it('shows "try again" for a face nobody matched', async () => {
    recognize = () => jsonResponse(strangerCheck);
    show();
    FakeSource.latest().fail(false);
    expect(await heading('Probá otra vez')).toBeInTheDocument();
    expect(screen.queryByTestId('kiosk-card')).not.toBeInTheDocument();
  });

  it('does not announce the same person again while they stay in front of the camera', async () => {
    show({ graceMs: 20 });
    await heading('Pasá, Lucía');
    await wait(TIMING.pauseMs * 4);
    expect(recognizeCalls()).toHaveLength(1);
  });

  it('recognizes a different person at once', async () => {
    show({ graceMs: 20 });
    await waitFor(() => expect(recognizeCalls()).toHaveLength(1));
    tools.current.detector.describe.mockResolvedValue(OTHER_PERSON);
    await waitFor(() => expect(recognizeCalls()).toHaveLength(2), { timeout: 2000 });
    expect(JSON.parse(String(recognizeCalls()[1]![1].body))).toEqual({ descriptor: OTHER_PERSON });
  });

  it('tries again for somebody who was not recognized, because nobody was remembered', async () => {
    recognize = () => jsonResponse(strangerCheck);
    show({ graceMs: 20 });
    await waitFor(() => expect(recognizeCalls().length).toBeGreaterThanOrEqual(2), { timeout: 2000 });
  });

  it('replaces the result on screen with the waiting state when a different person steps up', async () => {
    show({ graceMs: 5000 });
    await waitFor(() => expect(recognizeCalls()).toHaveLength(1));
    FakeSource.latest().greet(upToDate);
    await heading('Pasá, Lucía');
    let answer: (response: Response) => void = () => undefined;
    recognize = () => new Promise<Response>((resolve) => (answer = resolve));
    tools.current.detector.describe.mockResolvedValue(OTHER_PERSON);
    expect(await heading('Quedate quieto un segundo…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pasá, Lucía' })).not.toBeInTheDocument();
    answer(jsonResponse(strangerCheck));
  });

  it('stays at the welcome and waits when nobody is in front of the camera', async () => {
    tools.current.detector.look.mockResolvedValue(NO_FACE_FACTS);
    show();
    await wait(80);
    expect(recognizeCalls()).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
  });
});

describe('recognition problems', () => {
  it('says the recognition is not available on a 503 and stops asking', async () => {
    recognize = () => jsonResponse({ error: 'faces_unavailable', message: 'x' }, 503);
    show();
    expect(await heading('Reconocimiento no disponible: pedí ayuda en secretaría')).toBeInTheDocument();
    const calls = recognizeCalls().length;
    await wait(TIMING.pauseMs * 3);
    expect(recognizeCalls()).toHaveLength(calls);
    expect(screen.getByTestId('kiosk-stage')).toHaveAttribute('data-tone', 'gray');
  });

  it('still shows a result from the secretary while the recognition is not available', async () => {
    recognize = () => jsonResponse({ error: 'faces_unavailable', message: 'x' }, 503);
    show();
    await heading('Reconocimiento no disponible: pedí ayuda en secretaría');
    FakeSource.latest().greet({ ...upToDate, method: 'dni' });
    expect(await heading('Pasá, Lucía')).toBeInTheDocument();
  });

  it('says the session ended when the recognition answers 401, and releases the camera', async () => {
    recognize = () => jsonResponse({ error: 'unauthorized', message: 'x' }, 401);
    show();
    expect(await heading('Sesión vencida: iniciá sesión en esta PC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/pantalla-ingreso');
    await waitFor(() => expect(tools.current.cam.stop).toHaveBeenCalled());
    const calls = recognizeCalls().length;
    await wait(TIMING.pauseMs * 3);
    expect(recognizeCalls()).toHaveLength(calls);
  });

  it('checks the session when the stream is closed, and stops reconnecting when it ended', async () => {
    tools.current.detector.look.mockResolvedValue(NO_FACE_FACTS);
    const checkSession = vi.fn(async () => false);
    show({ checkSession });
    FakeSource.latest().fail(true);
    expect(await heading('Sesión vencida: iniciá sesión en esta PC')).toBeInTheDocument();
    expect(checkSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.queryByText('Reconectando…')).not.toBeInTheDocument();
    await wait(80);
    expect(FakeSource.all).toHaveLength(1);
    await waitFor(() => expect(tools.current.cam.stop).toHaveBeenCalled());
  });

  it('keeps reconnecting when the session is still valid', async () => {
    tools.current.detector.look.mockResolvedValue(NO_FACE_FACTS);
    const checkSession = vi.fn(async () => true);
    show({ checkSession });
    FakeSource.latest().fail(true);
    await waitFor(() => expect(FakeSource.all).toHaveLength(2));
    expect(screen.queryByRole('heading', { name: 'Sesión vencida: iniciá sesión en esta PC' })).not.toBeInTheDocument();
  });

  it('keeps the welcome and says what is wrong when the camera is denied, without recognizing anything', async () => {
    tools.current.openCamera.mockRejectedValue(new CameraError('denied'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Se denegó el permiso de la cámara');
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
    await wait(60);
    expect(recognizeCalls()).toHaveLength(0);
  });

  it('keeps asking after a network failure', async () => {
    let calls = 0;
    recognize = () => {
      calls += 1;
      if (calls === 1) throw new TypeError('network down');
      return jsonResponse(greenCheck);
    };
    show({ graceMs: 20 });
    expect(await heading('Pasá, Lucía')).toBeInTheDocument();
  });
});
