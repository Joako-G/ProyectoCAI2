import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraError } from '../../faces/services/camera';
import { createFakeTools, DESCRIPTOR, GOOD_FACTS, NO_FACE_FACTS, type FakeTools } from '../../faces/test/fakes';
import { jsonResponse } from '../../members/test/fixtures';
import { createFakeSource, FakeSource } from '../test/fake-source';
import type { AccessCheck } from '../types/access';
import { EntranceDisplay } from './EntranceDisplay';

const tools = vi.hoisted(() => ({ current: undefined as unknown as FakeTools }));
vi.mock('../../faces/services/face-tools', () => ({
  faceTools: {
    openCamera: () => tools.current.openCamera(),
    loadDetector: () => tools.current.loadDetector(),
  },
}));

const TIMING = { scanIntervalMs: 5, stableScans: 2, pauseMs: 40 };
const FAR_AWAY = Array.from({ length: 128 }, () => 0.1);
const greenCheck: AccessCheck = { result: 'green', reason: 'up_to_date', member: { memberNumber: '0101', name: 'Lucía Prueba', unpaidPeriodCount: 0, paidThrough: '2026-08' } };

const startEvent = (overrides: Record<string, unknown> = {}) => ({
  type: 'start',
  sessionId: 's1',
  firstName: 'Ana',
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
  captures: 3,
  ...overrides,
});

let fetchMock: ReturnType<typeof vi.fn>;
let active: unknown;
let complete: () => Response;
const callsTo = (suffix: string) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix));
const progressBodies = () => callsTo('/progress').map(([, init]) => JSON.parse(String(init.body)) as Record<string, unknown>);

beforeEach(() => {
  FakeSource.all = [];
  tools.current = createFakeTools();
  // Nobody is in front of the camera until a test says so, so recognition has nothing to ask about.
  tools.current.detector.look.mockResolvedValue(NO_FACE_FACTS);
  active = { session: null };
  complete = () => new Response(null, { status: 204 });
  fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/faces/recognize') return jsonResponse(greenCheck);
    if (url === '/api/faces/summary') return jsonResponse({ enrolled: 312 });
    if (url === '/api/faces/enrollments/active') return jsonResponse(active);
    if (url.endsWith('/progress')) return jsonResponse({});
    if (url.endsWith('/complete')) return complete();
    return jsonResponse({});
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  FakeSource.all = [];
  vi.unstubAllGlobals();
});

function show() {
  return render(<EntranceDisplay createSource={createFakeSource} holdMs={5000} reconnectMs={20} streamGraceMs={5000} timing={TIMING} enrollmentDoneMs={60} checkSession={async () => true} />);
}

const faceInFront = () => tools.current.detector.look.mockResolvedValue(GOOD_FACTS);

describe('face enrollment on the public screen', () => {
  it('switches to the registration screen with the first name, the guide and the capture count', async () => {
    show();
    FakeSource.latest().enroll(startEvent());
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getAllByText('REGISTRO DE ROSTRO').length).toBeGreaterThan(0);
    expect(screen.getByText('Captura 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('Mirá a la cámara y poné tu cara dentro del óvalo')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bienvenido al club' })).not.toBeInTheDocument();
    // The stream carries the first name only.
    expect(document.body.textContent).not.toMatch(/DNI|m1/);
  });

  it('shows the live hint of the capture guide in large type', async () => {
    tools.current.detector.look.mockResolvedValue({ ...GOOD_FACTS, box: { x: 0.4, y: 0.35, width: 0.2, height: 0.3 } });
    show();
    FakeSource.latest().enroll(startEvent());
    expect(await screen.findByText('Acercate')).toBeInTheDocument();
  });

  it('pauses recognition while it runs, even with a face in front of the camera', async () => {
    faceInFront();
    show();
    FakeSource.latest().enroll(startEvent());
    await screen.findByRole('heading', { name: 'Hola, Ana' });
    await waitFor(() => expect(callsTo('/complete')).toHaveLength(1), { timeout: 3000 });
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/faces/recognize')).toHaveLength(0);
  });

  it('reports the progress, delivers only the mean descriptor after three captures, confirms, and goes back to recognition', async () => {
    faceInFront();
    tools.current.detector.describe.mockResolvedValue(FAR_AWAY);
    show();
    FakeSource.latest().enroll(startEvent());
    expect(await screen.findByText('Listo, tu rostro quedó registrado', undefined, { timeout: 3000 })).toBeInTheDocument();

    const [[url, init]] = callsTo('/complete');
    expect(url).toBe('/api/faces/enrollments/s1/complete');
    const body = JSON.parse(String(init.body)) as { descriptor: number[] };
    // Only the descriptor travels (the mean of three identical captures, up to rounding), never an image.
    expect(Object.keys(body)).toEqual(['descriptor']);
    expect(body.descriptor).toHaveLength(128);
    expect(body.descriptor.every((value) => Math.abs(value - 0.1) < 1e-9)).toBe(true);
    // Progress went out as the member advanced: first at zero, then after each accepted capture.
    expect(progressBodies().map((body) => body.captures)).toEqual(expect.arrayContaining([0, 1, 2]));
    expect(progressBodies().every((body) => body.status === 'capturing')).toBe(true);

    // After the confirmation the screen recognizes again.
    expect(await screen.findByRole('heading', { name: 'Bienvenido al club' }, { timeout: 3000 })).toBeInTheDocument();
    tools.current.detector.describe.mockResolvedValue(DESCRIPTOR);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/faces/recognize').length).toBeGreaterThan(0), { timeout: 3000 });
  });

  it('retakes a capture that does not match the earlier ones and says so', async () => {
    faceInFront();
    tools.current.detector.describe.mockResolvedValueOnce(DESCRIPTOR).mockResolvedValueOnce(FAR_AWAY).mockResolvedValue(DESCRIPTOR);
    show();
    FakeSource.latest().enroll(startEvent());
    expect(await screen.findByText('Esa captura no coincide con las anteriores. Probemos de nuevo.', undefined, { timeout: 3000 })).toBeInTheDocument();
    await waitFor(() => expect(callsTo('/complete')).toHaveLength(1), { timeout: 3000 });
    expect(JSON.parse(String(callsTo('/complete')[0]![1].body))).toEqual({ descriptor: DESCRIPTOR });
  });

  it('goes back to recognition when staff cancel, and ignores the end of another session', async () => {
    show();
    FakeSource.latest().enroll(startEvent());
    await screen.findByRole('heading', { name: 'Hola, Ana' });
    FakeSource.latest().enroll({ type: 'end', sessionId: 'other', outcome: 'cancelled' });
    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    FakeSource.latest().enroll({ type: 'end', sessionId: 's1', outcome: 'cancelled' });
    expect(await screen.findByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
    expect(callsTo('/complete')).toHaveLength(0);
  });

  it('resumes recognition after the time limit even if the end message never arrives', async () => {
    show();
    FakeSource.latest().enroll(startEvent({ expiresAt: new Date(Date.now() + 80).toISOString() }));
    await screen.findByRole('heading', { name: 'Hola, Ana' });
    expect(await screen.findByRole('heading', { name: 'Bienvenido al club' }, { timeout: 2000 })).toBeInTheDocument();
  });

  it('finds a session that started while the screen was not connected', async () => {
    active = { session: { id: 's9', memberId: 'm1', firstName: 'Bruno', status: 'waiting', hint: '', captures: 0, total: 3, expiresAt: new Date(Date.now() + 60_000).toISOString() } };
    show();
    expect(await screen.findByRole('heading', { name: 'Hola, Bruno' })).toBeInTheDocument();
    await waitFor(() => expect(progressBodies().length).toBeGreaterThan(0));
    expect(callsTo('/progress')[0]![0]).toBe('/api/faces/enrollments/s9/progress');
  });

  it('tells the secretary and gives the screen back when the camera cannot open', async () => {
    tools.current.openCamera.mockRejectedValue(new CameraError('denied'));
    show();
    FakeSource.latest().enroll(startEvent());
    await waitFor(() => expect(progressBodies().some((body) => body.status === 'failed')).toBe(true));
    expect(progressBodies().find((body) => body.status === 'failed')).toEqual({ status: 'failed', message: expect.stringContaining('cámara') });
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Hola, Ana' })).not.toBeInTheDocument());
  });

  it('tells the secretary when the face could not be saved, and goes back to recognition', async () => {
    complete = () => jsonResponse({ error: 'internal', message: 'boom' }, 500);
    faceInFront();
    show();
    FakeSource.latest().enroll(startEvent());
    await waitFor(() => expect(progressBodies().some((body) => body.status === 'failed')).toBe(true), { timeout: 3000 });
    expect(await screen.findByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
    expect(screen.queryByText('Listo, tu rostro quedó registrado')).not.toBeInTheDocument();
  });

  it('opens the stream as the public screen, so the server can count it', () => {
    show();
    expect(FakeSource.latest().url).toBe('/api/access/display-events?screen=public');
  });
});
