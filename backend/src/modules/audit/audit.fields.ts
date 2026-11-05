/**
 * The names of the keys whose values differ between two versions of a record, sorted. Only names are returned,
 * so the audit log never copies a value. Pass the secrets and system-set fields in `ignore`.
 */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  ignore: readonly string[] = [],
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !ignore.includes(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort();
}
