import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/shared/errors.js';
import { parseEnrollBody, parseRecognizeBody } from '../../src/modules/faces/face.validation.js';
import { descriptor } from './helpers.js';

function fieldErrors(run: () => unknown): Record<string, string> {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) return error.fieldErrors;
    throw error;
  }
  throw new Error('Expected a ValidationError');
}

describe('parseEnrollBody', () => {
  it('accepts 128 finite numbers and a true consent', () => {
    const body = parseEnrollBody({ descriptor: descriptor(), consent: true });
    expect(body.descriptor).toHaveLength(128);
  });

  it.each([
    ['missing', undefined],
    ['not an array', 'abc'],
    ['too short', descriptor(0.1, 127)],
    ['too long', descriptor(0.1, 129)],
    ['a string among numbers', [...descriptor(0.1, 127), '0.1']],
    ['a null among numbers', [...descriptor(0.1, 127), null]],
  ])('rejects a descriptor that is %s', (_name, value) => {
    expect(fieldErrors(() => parseEnrollBody({ descriptor: value, consent: true }))).toHaveProperty('descriptor');
  });

  it('rejects NaN and Infinity', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fieldErrors(() => parseEnrollBody({ descriptor: [...descriptor(0.1, 127), bad], consent: true }))).toHaveProperty('descriptor');
    }
  });

  it.each([undefined, false, 'true', 1, null])('rejects consent %j', (consent) => {
    expect(fieldErrors(() => parseEnrollBody({ descriptor: descriptor(), consent }))).toHaveProperty('consent');
  });

  it('reports both fields and never echoes the input', () => {
    const errors = fieldErrors(() => parseEnrollBody({ descriptor: [0.987654321], consent: 'yes' }));
    expect(Object.keys(errors).sort()).toEqual(['consent', 'descriptor']);
    expect(JSON.stringify(errors)).not.toContain('0.987654321');
  });

  it('rejects a body that is not an object', () => {
    expect(Object.keys(fieldErrors(() => parseEnrollBody(null)))).toContain('descriptor');
  });
});

describe('parseRecognizeBody', () => {
  it('accepts a valid descriptor and needs no consent', () => {
    expect(parseRecognizeBody({ descriptor: descriptor() }).descriptor).toHaveLength(128);
  });

  it('rejects a bad descriptor', () => {
    expect(fieldErrors(() => parseRecognizeBody({ descriptor: [1, 2, 3] }))).toHaveProperty('descriptor');
    expect(fieldErrors(() => parseRecognizeBody({}))).toHaveProperty('descriptor');
  });
});
