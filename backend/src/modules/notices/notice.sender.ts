import type { NoticeSender } from './notice.types.js';

/** Prepares a wa.me link a secretary opens; the seam where a WhatsApp Business API sender can plug in later. */
export function createWaMeSender(): NoticeSender {
  return {
    prepare: ({ number, message }) => ({ link: `https://wa.me/${number}?text=${encodeURIComponent(message)}` }),
  };
}
