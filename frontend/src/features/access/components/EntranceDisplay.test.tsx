import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GreetingEvent } from '../types/greeting';
import { EntranceDisplay } from './EntranceDisplay';

/** Stands in for EventSource: the test decides when events and errors arrive. */
class FakeSource {
  static all: FakeSource[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private handlers = new Map<string, Array<(event: MessageEvent<string>) => void>>();

  constructor(readonly url: string) {
    FakeSource.all.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  close() {
    this.readyState = 2;
  }

  open() {
    this.readyState = 1;
    act(() => this.onopen?.());
  }

  greet(event: Partial<GreetingEvent> & Pick<GreetingEvent, 'tone'>, raw?: string) {
    const data = raw ?? JSON.stringify({ at: '2026-11-07T15:00:00.000Z', ...event });
    act(() => (this.handlers.get('greeting') ?? []).forEach((handler) => handler({ data } as MessageEvent<string>)));
  }

  fail(closed: boolean) {
    this.readyState = closed ? 2 : 0;
    act(() => this.onerror?.());
  }
}

const createSource = (url: string) => new FakeSource(url);
const latest = () => FakeSource.all[FakeSource.all.length - 1]!;

beforeEach(() => {
  FakeSource.all = [];
});

afterEach(() => {
  FakeSource.all = [];
});

function show(props: { holdMs?: number; reconnectMs?: number } = {}) {
  return render(<EntranceDisplay createSource={createSource} holdMs={props.holdMs ?? 5000} reconnectMs={props.reconnectMs ?? 20} />);
}

describe('EntranceDisplay', () => {
  it('connects to the greeting stream and waits with a welcome', () => {
    show();
    expect(latest().url).toBe('/api/access/display-events');
    expect(screen.getByText('Bienvenidos al club')).toBeInTheDocument();
  });

  it('greets a member who may enter by first name', () => {
    show();
    latest().greet({ tone: 'welcome', firstName: 'Lucía' });
    expect(screen.getByText('¡Bienvenido/a, Lucía!')).toBeInTheDocument();
    expect(screen.queryByText('Bienvenidos al club')).not.toBeInTheDocument();
  });

  it('asks a yellow member to pass by the desk', () => {
    show();
    latest().greet({ tone: 'see_desk', firstName: 'Lucía' });
    expect(screen.getByText('¡Bienvenido/a, Lucía! Pasá por secretaría')).toBeInTheDocument();
  });

  it('refuses with no name and no reason', () => {
    show();
    latest().greet({ tone: 'refused' });
    expect(screen.getByText('Acercate a secretaría')).toBeInTheDocument();
    expect(screen.queryByText(/Bienvenido\/a/)).not.toBeInTheDocument();
  });

  it('never shows more than the name it was given, even if the event carries more', () => {
    show();
    latest().greet({ tone: 'refused' }, JSON.stringify({ at: '2026-11-07T15:00:00.000Z', tone: 'refused', firstName: 'Lucía', memberNumber: '101', reason: 'deregistered', debt: 90000 }));
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/Lucía|101|deregistered|90000/);
  });

  it('returns to the welcome after the greeting has been shown for a while', async () => {
    show({ holdMs: 40 });
    latest().greet({ tone: 'welcome', firstName: 'Lucía' });
    expect(screen.getByText('¡Bienvenido/a, Lucía!')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Bienvenidos al club')).toBeInTheDocument());
  });

  it('replaces a greeting with the next one and restarts the time', async () => {
    show({ holdMs: 60 });
    latest().greet({ tone: 'welcome', firstName: 'Lucía' });
    await new Promise((resolve) => setTimeout(resolve, 40));
    latest().greet({ tone: 'welcome', firstName: 'Mateo' });
    expect(screen.getByText('¡Bienvenido/a, Mateo!')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(screen.getByText('¡Bienvenido/a, Mateo!')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Bienvenidos al club')).toBeInTheDocument());
  });

  it('ignores a message that is not a greeting', () => {
    show();
    latest().greet({ tone: 'welcome' }, 'not json');
    latest().greet({ tone: 'welcome' }, JSON.stringify({ tone: 'party' }));
    expect(screen.getByText('Bienvenidos al club')).toBeInTheDocument();
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
