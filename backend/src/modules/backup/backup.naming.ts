// The module only ever creates, counts or deletes folders whose names match these patterns.
const COPY_PATTERN = /^backup-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/;
const PARTIAL_PREFIX = '.partial-';

/** `2026-11-04T15:00:00.000Z` -> `backup-20261104T150000Z`: sorts by time and is valid on every file system. */
export function copyFolderName(at: Date): string {
  return `backup-${at.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '')}`;
}

/** Where a copy is built before it is renamed to its final name, so a half-written copy never looks like a good one. */
export function partialFolderName(copyName: string): string {
  return `${PARTIAL_PREFIX}${copyName}`;
}

/** A name is one of ours only when it is the pattern and a real instant: `backup-20261340T150000Z` is neither counted nor deleted. */
export const isCopyFolder = (name: string) => copyFolderInstant(name) !== null;
export const isPartialFolder = (name: string) => name.startsWith(PARTIAL_PREFIX) && isCopyFolder(name.slice(PARTIAL_PREFIX.length));

/** The instant a copy folder was made, or null for a name that is not one of ours or is not a real date. */
export function copyFolderInstant(name: string): Date | null {
  const match = COPY_PATTERN.exec(name);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const stamp = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const instant = new Date(stamp);
  // A date that rolls over (31 February) or does not exist (month 13) does not round-trip.
  return Number.isNaN(instant.getTime()) || instant.toISOString() !== stamp.replace('Z', '.000Z') ? null : instant;
}
