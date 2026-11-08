import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Capability } from './features/auth/types/auth';
import { createFakeTools, FAR_FACTS } from './features/faces/test/fakes';
import { renderApp } from './test/renderApp';

// The screen opens the camera; the test never needs a real one or the heavy face models.
vi.mock('./features/faces/services/face-tools', () => {
  const fakes = createFakeTools();
  fakes.detector.look.mockResolvedValue(FAR_FACTS);
  return { faceTools: { openCamera: () => fakes.openCamera(), loadDetector: () => fakes.loadDetector() } };
});

class SilentSource {
  static urls: string[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    SilentSource.urls.push(url);
  }
  addEventListener() {}
  close() {}
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function stubSession(capabilities: Capability[] | undefined) {
  const user = { id: '1', name: 'Demo', email: 'demo@example.com', role: 'secretary' };
  vi.stubGlobal('EventSource', SilentSource);
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (input === '/auth/me') return capabilities ? json({ user, capabilities }) : json({ error: 'Authentication required' }, 401);
    return json([]);
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  SilentSource.urls = [];
});

describe('public entrance display route', () => {
  it('opens full screen at /pantalla-ingreso, without the sidebar or the header', async () => {
    stubSession(['access:check']);
    renderApp('/pantalla-ingreso');

    expect(await screen.findByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(SilentSource.urls).toEqual(['/api/access/display-events']);
  });

  it('stays behind login: a visitor without a session sees the login form and no stream is opened', async () => {
    stubSession(undefined);
    renderApp('/pantalla-ingreso');

    expect(await screen.findByRole('heading', { name: 'Bienvenido/a de nuevo' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bienvenido al club' })).not.toBeInTheDocument();
    expect(SilentSource.urls).toEqual([]);
  });

  it('refuses a role that may not check entrances, and opens no stream', async () => {
    stubSession(['members:read']);
    renderApp('/pantalla-ingreso');

    expect(await screen.findByRole('heading', { level: 2, name: 'Sin acceso' })).toBeInTheDocument();
    expect(SilentSource.urls).toEqual([]);
  });
});
