import { describe, expect, it } from 'vitest';
import { createWaMeSender } from '../../src/modules/notices/notice.sender.js';

describe('createWaMeSender', () => {
  it('builds a wa.me link with the encoded message', () => {
    const sender = createWaMeSender();
    const { link } = sender.prepare({ number: '5493815550101', message: 'Hola & chau?\nTotal: $ 1.000' });
    expect(link).toBe(`https://wa.me/5493815550101?text=${encodeURIComponent('Hola & chau?\nTotal: $ 1.000')}`);
    expect(new URL(link).searchParams.get('text')).toBe('Hola & chau?\nTotal: $ 1.000');
  });
});
