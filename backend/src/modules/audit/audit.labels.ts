import type { AuditEntityType, AuditEntry } from './audit.types.js';

/**
 * Where display labels come from. Each port returns only the fields a label needs, so the audit module never
 * sees names or DNI of members. Sources are read once per request, and only when an entry needs them.
 */
export interface AuditLabelSources {
  members(): Promise<ReadonlyArray<{ id: string; memberNumber: string }>>;
  disciplines(): Promise<ReadonlyArray<{ id: string; name: string }>>;
  users(): Promise<ReadonlyArray<{ id: string; name: string }>>;
  payments(): Promise<ReadonlyArray<{ id: string; receiptNumber: number }>>;
  cashCounts(): Promise<ReadonlyArray<{ id: string; businessDate: string }>>;
}

/** The rows of a source that need an id lookup, keyed by the entity type they describe. */
type LookupType = 'member' | 'discipline' | 'user' | 'payment' | 'cash_count';
type Names = ReadonlyMap<string, string>;

const kindLabels: Record<AuditEntityType, string> = {
  member: 'Socio',
  discipline: 'Disciplina',
  user: 'Usuario',
  tariff: 'Tarifa desde',
  surcharge_tiers: 'Recargos por pago tardío',
  proration_rule: 'Prorrateo',
  payment: 'Pago',
  cash_count: 'Arqueo',
};

// A club has one of each, so the id adds nothing and only the fixed name is shown.
const singletons: ReadonlySet<AuditEntityType> = new Set(['surcharge_tiers', 'proration_rule']);

/** `2026-11-01` -> `01/11/2026`. */
const dayMonthYear = (isoDate: string) => isoDate.split('-').reverse().join('/');

const lookups: Record<LookupType, { read: (sources: AuditLabelSources) => Promise<Array<[string, string]>>; text: (value: string) => string }> = {
  member: { read: async (s) => (await s.members()).map((row) => [row.id, row.memberNumber]), text: (value) => `Socio ${value}` },
  discipline: { read: async (s) => (await s.disciplines()).map((row) => [row.id, row.name]), text: (value) => `Disciplina ${value}` },
  user: { read: async (s) => (await s.users()).map((row) => [row.id, row.name]), text: (value) => `Usuario ${value}` },
  payment: { read: async (s) => (await s.payments()).map((row) => [row.id, String(row.receiptNumber)]), text: (value) => `Pago N.º ${value}` },
  cash_count: { read: async (s) => (await s.cashCounts()).map((row) => [row.id, row.businessDate]), text: (value) => `Arqueo del ${dayMonthYear(value)}` },
};

const isLookup = (type: AuditEntityType): type is LookupType => type in lookups;

/** A short readable form for a record that cannot be resolved: the kind and the start of its id. */
function fallbackLabel(type: AuditEntityType, id: string): string {
  return `${kindLabels[type]} ${id.length > 8 ? `${id.slice(0, 8)}…` : id}`;
}

/**
 * Resolves the label of every entry at read time. The log never stores labels, so a renamed or removed record
 * cannot leave stale text in it and no personal data is copied into it. A source that fails only costs its
 * entries the short fallback.
 */
export async function resolveEntityLabels(entries: readonly AuditEntry[], sources?: AuditLabelSources): Promise<string[]> {
  const needed = new Set<LookupType>();
  for (const { entityType } of entries) if (isLookup(entityType)) needed.add(entityType);

  const names = new Map<LookupType, Names>();
  await Promise.all(
    [...needed].map(async (type) => {
      if (!sources) return;
      try {
        names.set(type, new Map(await lookups[type].read(sources)));
      } catch (error) {
        // Names the kind only: no ids and no file content.
        console.error(`Could not read the ${type} records to label the audit log`, error);
      }
    }),
  );

  return entries.map(({ entityType, entityId }) => {
    if (singletons.has(entityType)) return kindLabels[entityType];
    if (entityType === 'tariff') return `${kindLabels.tariff} ${entityId}`;
    if (isLookup(entityType)) {
      const value = names.get(entityType)?.get(entityId);
      if (value !== undefined) return lookups[entityType].text(value);
    }
    return fallbackLabel(entityType, entityId);
  });
}
