import { describe, expect, it } from 'vitest';
import { parseEnrollmentEvent } from './enrollment-event';

describe('parseEnrollmentEvent', () => {
  it('reads a start with the first name and a session end with its outcome', () => {
    expect(parseEnrollmentEvent('{"type":"start","sessionId":"s1","firstName":"Ana","expiresAt":"2026-11-09T15:02:00.000Z","captures":3}')).toEqual({
      type: 'start',
      sessionId: 's1',
      firstName: 'Ana',
      expiresAt: '2026-11-09T15:02:00.000Z',
      captures: 3,
    });
    expect(parseEnrollmentEvent('{"type":"end","sessionId":"s1","outcome":"expired"}')).toEqual({ type: 'end', sessionId: 's1', outcome: 'expired' });
  });

  it('ignores anything that is not exactly the contract, and keeps only the known fields', () => {
    for (const data of [
      'not json',
      'null',
      '{"type":"start","sessionId":"s1"}',
      '{"type":"end","sessionId":"s1","outcome":"bogus"}',
      '{"type":"other","sessionId":"s1"}',
      '{"type":"end","outcome":"completed"}',
    ]) {
      expect(parseEnrollmentEvent(data), data).toBeUndefined();
    }
    const parsed = parseEnrollmentEvent('{"type":"start","sessionId":"s1","firstName":"Ana","expiresAt":"x","captures":3,"dni":"30111222","memberId":"m1"}');
    expect(parsed).not.toHaveProperty('dni');
    expect(parsed).not.toHaveProperty('memberId');
  });
});
