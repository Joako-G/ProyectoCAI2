import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeTools, FAR_FACTS, type FakeTools } from '../../faces/test/fakes';
import { jsonResponse } from '../../members/test/fixtures';
import { createFakeSource, FakeSource } from '../test/fake-source';
import type { GreetingEvent } from '../types/greeting';
import { EntranceDisplay } from './EntranceDisplay';

const tools = vi.hoisted(() => ({ current: undefined as unknown as FakeTools }));
vi.mock('../../faces/services/face-tools', () => ({
  faceTools: {
    openCamera: () => tools.current.openCamera(),
    loadDetector: () => tools.current.loadDetector(),
  },
}));

const createSource = createFakeSource;
const latest = FakeSource.latest;

const lucia = { id: 'm1', memberNumber: '0101', fullName: 'Lucía Prueba', firstName: 'Lucía', disciplines: ['Natación'] };
const upToDate: Partial<GreetingEvent> = { tone: 'welcome', kind: 'up_to_date', firstName: 'Lucía', member: lucia, paidThrough: '2026-08', dueDate: '2026-09-10' };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  FakeSource.all = [];
  tools.current = createFakeTools();
  // A face that is too far to be captured: the camera has something to follow but never starts a recognition.
  tools.current.detector.look.mockResolvedValue(FAR_FACTS);
  fetchMock = vi.fn(async (url: string) => (url === '/api/faces/summary' ? jsonResponse({ enrolled: 312 }) : jsonResponse({})));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  FakeSource.all = [];
  vi.unstubAllGlobals();
});

function show(props: { holdMs?: number; reconnectMs?: number } = {}) {
  return render(<EntranceDisplay createSource={createSource} holdMs={props.holdMs ?? 5000} reconnectMs={props.reconnectMs ?? 20} timing={{ scanIntervalMs: 5 }} checkSession={async () => true} />);
}

describe('EntranceDisplay', () => {
  it('connects to the greeting stream and waits with a welcome', () => {
    show();
    expect(latest().url).toBe('/api/access/display-events?screen=public');
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
  });

  it('shows an up to date member with the full name, number, month and due date', () => {
    show();
    latest().greet(upToDate);
    expect(screen.getByRole('heading', { name: 'Pasá, Lucía' })).toBeInTheDocument();
    expect(screen.getByText('Lucía Prueba')).toBeInTheDocument();
    expect(screen.getByText('0101')).toBeInTheDocument();
    expect(screen.getByText('AL DÍA')).toBeInTheDocument();
    expect(screen.getByText('Tu cuota está paga hasta agosto 2026. Disciplinas: Natación.')).toBeInTheDocument();
    expect(screen.getByText('10/09/2026')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bienvenido al club' })).not.toBeInTheDocument();
  });

  it('asks a member who owes to pass by the desk, without an amount or a count of months', () => {
    show();
    latest().greet({ tone: 'see_desk', kind: 'debtor', firstName: 'Lucía', member: lucia, debtSince: '2026-06', unpaidPeriodCount: 5 });
    expect(screen.getByText('Hola, Lucía Prueba. Tenés cuotas pendientes desde junio 2026. Pasá por secretaría.')).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE')).toBeInTheDocument();
    expect(screen.getByText('ACCESO AUTORIZADO · AVISO')).toBeInTheDocument();
  });

  it('shows a deregistered and an inactive member in their own states', () => {
    show();
    latest().greet({ tone: 'refused', kind: 'deregistered', member: lucia, debtSince: '2026-01' });
    expect(screen.getByRole('heading', { name: 'Lucía, pasá por secretaría' })).toBeInTheDocument();
    latest().greet({ tone: 'refused', kind: 'inactive', member: lucia });
    expect(screen.getByRole('heading', { name: 'Lucía, hablá con secretaría' })).toBeInTheDocument();
  });

  it('asks to try again, with no member data, when nobody was recognized', () => {
    show();
    latest().greet({ tone: 'refused', kind: 'not_recognized' });
    expect(screen.getByRole('heading', { name: 'Probá otra vez' })).toBeInTheDocument();
    expect(screen.queryByTestId('kiosk-card')).not.toBeInTheDocument();
  });

  it('never shows more than the screen knows, even if the event carries more', () => {
    show();
    latest().greet({}, JSON.stringify({ at: '2026-11-07T15:00:00.000Z', tone: 'refused', kind: 'not_found', method: 'dni', firstName: 'Lucía', memberNumber: '101', reason: 'deregistered', debt: 90000, dni: '30111222' }));
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/Lucía Prueba|90000|30111222|deregistered/);
  });

  it('shows the same result when the check came from the secretary by DNI', () => {
    show();
    latest().greet({ ...upToDate, method: 'dni' });
    expect(screen.getByRole('heading', { name: 'Pasá, Lucía' })).toBeInTheDocument();
  });

  it('returns to the welcome after the result has been shown for a while', async () => {
    show({ holdMs: 40 });
    latest().greet(upToDate);
    expect(screen.getByRole('heading', { name: 'Pasá, Lucía' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument());
  });

  it('replaces a result with the next one and restarts the time', async () => {
    show({ holdMs: 60 });
    latest().greet(upToDate);
    await new Promise((resolve) => setTimeout(resolve, 40));
    latest().greet({ ...upToDate, firstName: 'Mateo', member: { ...lucia, firstName: 'Mateo', fullName: 'Mateo Quiroga' } });
    expect(screen.getByRole('heading', { name: 'Pasá, Mateo' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(screen.getByRole('heading', { name: 'Pasá, Mateo' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument());
  });

  it('ignores a message that is not a greeting', () => {
    show();
    latest().greet({}, 'not json');
    latest().greet({}, JSON.stringify({ tone: 'party' }));
    latest().greet({}, JSON.stringify({ at: 'x', tone: 'welcome', firstName: 'Lucía' }));
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
  });

  it('shows a quiet reconnecting notice while the stream is down, and clears it when it is back', () => {
    show();
    latest().open();
    expect(screen.queryByText('Reconectando…')).not.toBeInTheDocument();
    latest().fail(false);
    expect(screen.getByText('Reconectando…')).toBeInTheDocument();
    latest().open();
    expect(screen.queryByText('Reconectando…')).not.toBeInTheDocument();
  });

  it('opens a new connection when the browser gave up on the old one', async () => {
    show({ reconnectMs: 20 });
    const first = latest();
    first.fail(true);
    await waitFor(() => expect(FakeSource.all).toHaveLength(2));
    expect(first.readyState).toBe(2);
    expect(latest()).not.toBe(first);
  });

  it('does not open a second connection when the browser is already retrying by itself', async () => {
    show({ reconnectMs: 20 });
    latest().fail(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(FakeSource.all).toHaveLength(1);
  });

  it('closes the connection and stops reconnecting when the screen goes away', async () => {
    const { unmount } = show({ reconnectMs: 20 });
    const first = latest();
    first.fail(true);
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(first.readyState).toBe(2);
    expect(FakeSource.all).toHaveLength(1);
  });
});

describe('EntranceDisplay camera', () => {
  it('starts the camera when the screen opens and releases it when it closes', async () => {
    const { unmount } = show();
    await waitFor(() => expect(tools.current.openCamera).toHaveBeenCalledTimes(1));
    expect(await screen.findByLabelText('Vista de la cámara')).toBeInTheDocument();
    unmount();
    expect(tools.current.cam.stop).toHaveBeenCalled();
  });

  it('shows the live hint of the capture guide under the camera', async () => {
    tools.current.detector.look.mockResolvedValue({ faceCount: 1, box: { x: 0.4, y: 0.35, width: 0.2, height: 0.3 }, score: 0.95, yaw: 0, pitch: 0, brightness: 130, surroundBrightness: 120 });
    show();
    expect(await screen.findByText('Acercate')).toBeInTheDocument();
  });

  it('moves the framing rectangle to the detected face', async () => {
    show();
    const frame = screen.getByTestId('kiosk-frame');
    expect(frame).toHaveStyle({ left: '224px', top: '201px' });
    await waitFor(() => expect(frame).not.toHaveStyle({ left: '224px', top: '201px' }));
  });

  it('keeps the welcome and says what is wrong when the camera cannot be used', async () => {
    tools.current.openCamera.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    show();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
  });

  it('asks how many faces are enrolled, once, and survives a failure', async () => {
    fetchMock.mockImplementation(async () => new Response('x', { status: 503 }));
    show();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url === '/api/faces/summary')).toHaveLength(1));
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
  });
});

describe('EntranceDisplay layout', () => {
  it('scales the stage to the window and keeps it centered', () => {
    vi.stubGlobal('innerWidth', 590);
    vi.stubGlobal('innerHeight', 2000);
    show();
    expect(screen.getByTestId('kiosk-stage')).toHaveStyle({ transform: 'scale(0.5)' });
    act(() => {
      vi.stubGlobal('innerWidth', 2360);
      vi.stubGlobal('innerHeight', 1400);
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByTestId('kiosk-stage')).toHaveStyle({ transform: 'scale(2)' });
  });
});
