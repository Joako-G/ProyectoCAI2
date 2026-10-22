// Case- and accent-insensitive form of a text, used for uniqueness checks and search.
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
