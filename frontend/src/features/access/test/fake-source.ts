import { act } from '@testing-library/react';
import type { GreetingEvent } from '../types/greeting';

/** Stands in for EventSource: the test decides when events and errors arrive. */
export class FakeSource {
  static all: FakeSource[] = [];
  static latest = () => FakeSource.all[FakeSource.all.length - 1]!;
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

  greet(event: Partial<GreetingEvent>, raw?: string) {
    const data = raw ?? JSON.stringify({ at: '2026-11-07T15:00:00.000Z', tone: 'welcome', kind: 'up_to_date', method: 'face', ...event });
    act(() => (this.handlers.get('greeting') ?? []).forEach((handler) => handler({ data } as MessageEvent<string>)));
  }

  enroll(event: object, raw?: string) {
    act(() => (this.handlers.get('enrollment') ?? []).forEach((handler) => handler({ data: raw ?? JSON.stringify(event) } as MessageEvent<string>)));
  }

  fail(closed: boolean) {
    this.readyState = closed ? 2 : 0;
    act(() => this.onerror?.());
  }
}

export const createFakeSource = (url: string) => new FakeSource(url);
