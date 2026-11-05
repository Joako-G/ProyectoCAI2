const MOBILE_NUMBER = /^549[1-9]\d{9}$/;
const AREA_CODE_LENGTHS = [2, 3, 4];

// Drops the trunk prefix 0 and, when present right after the area code, the local mobile prefix 15.
function nationalNumber(digits: string): string {
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  if (national.length !== 12) return national;
  const areaLength = AREA_CODE_LENGTHS.find((length) => national.slice(length, length + 2) === '15');
  return areaLength === undefined ? national : national.slice(0, areaLength) + national.slice(areaLength + 2);
}

/**
 * The WhatsApp number (country code 54, mobile marker 9, ten digits) for an Argentine phone as stored,
 * or undefined when it cannot be derived with confidence. Pure; accepts numbers with or without the
 * country code, trunk 0 or local 15 prefix.
 */
export function deriveWhatsappNumber(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, '');
  let candidate: string;
  if (digits.startsWith('549')) candidate = digits;
  else if (digits.startsWith('54')) candidate = `549${nationalNumber(digits.slice(2))}`;
  else candidate = `549${nationalNumber(digits)}`;
  return MOBILE_NUMBER.test(candidate) ? candidate : undefined;
}
