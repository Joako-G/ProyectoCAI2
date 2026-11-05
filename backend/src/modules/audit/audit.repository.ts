import type { AuditEntry } from './audit.types.js';

// Append and read only: the audit log is never edited or deleted (RNF-08).
export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
  // Oldest first, in the order the entries were appended. A missing file reads as an empty log.
  list(): Promise<AuditEntry[]>;
}
