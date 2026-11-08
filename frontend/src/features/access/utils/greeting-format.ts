import type { GreetingEvent, GreetingTone } from '../types/greeting';

const TONES: readonly GreetingTone[] = ['welcome', 'see_desk', 'refused'];

/** What the public screen says. Provisional wording, not yet confirmed by the club. A refusal never carries a name. */
export function greetingText({ tone, firstName }: GreetingEvent): string {
  if (tone === 'refused') return 'Acercate a secretaría';
  const greeting = firstName ? `¡Bienvenido/a, ${firstName}!` : '¡Bienvenido/a!';
  return tone === 'see_desk' ? `${greeting} Pasá por secretaría` : greeting;
}

/**
 * Reads one stream message and keeps only what the screen may show: the time, the tone and, for someone who
 * enters, the first name. Anything else in the message is dropped; a malformed message is ignored.
 */
export function parseGreeting(raw: string): GreetingEvent | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const { at, tone, firstName } = value as Record<string, unknown>;
  if (typeof tone !== 'string' || !TONES.includes(tone as GreetingTone)) return undefined;
  if (firstName !== undefined && typeof firstName !== 'string') return undefined;
  const name = firstName?.trim();
  return {
    at: typeof at === 'string' ? at : '',
    tone: tone as GreetingTone,
    ...(tone !== 'refused' && name ? { firstName: name } : {}),
  };
}
