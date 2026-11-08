import { describe, expect, it } from 'vitest';
import { greetingText, parseGreeting } from './greeting-format';

describe('greetingText', () => {
  it('words each tone exactly', () => {
    expect(greetingText({ at: 'x', tone: 'welcome', firstName: 'Lucía' })).toBe('¡Bienvenido/a, Lucía!');
    expect(greetingText({ at: 'x', tone: 'see_desk', firstName: 'Lucía' })).toBe('¡Bienvenido/a, Lucía! Pasá por secretaría');
    expect(greetingText({ at: 'x', tone: 'refused' })).toBe('Acercate a secretaría');
  });

  it('never names anyone on a refusal, whatever the event carries', () => {
    expect(greetingText({ at: 'x', tone: 'refused', firstName: 'Lucía' })).toBe('Acercate a secretaría');
  });

  it('greets without a name rather than showing a gap when the name is missing', () => {
    expect(greetingText({ at: 'x', tone: 'welcome' })).toBe('¡Bienvenido/a!');
    expect(greetingText({ at: 'x', tone: 'see_desk' })).toBe('¡Bienvenido/a! Pasá por secretaría');
  });
});

describe('parseGreeting', () => {
  it('keeps only the tone, the time and the first name', () => {
    const event = parseGreeting(JSON.stringify({ at: '2026-11-07T15:00:00.000Z', tone: 'welcome', firstName: 'Lucía', memberNumber: '101', reason: 'x' }));
    expect(event).toEqual({ at: '2026-11-07T15:00:00.000Z', tone: 'welcome', firstName: 'Lucía' });
  });

  it('drops a name from a refusal', () => {
    expect(parseGreeting(JSON.stringify({ at: 'x', tone: 'refused', firstName: 'Lucía' }))).toEqual({ at: 'x', tone: 'refused' });
  });

  it('rejects anything that is not a greeting', () => {
    for (const raw of ['', 'nope', '[]', 'null', '{"tone":"party"}', '{"tone":"welcome","firstName":42}']) {
      expect(parseGreeting(raw), raw).toBeUndefined();
    }
  });
});
