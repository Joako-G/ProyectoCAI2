import { toIsoDate } from '../../shared/date.js';
import type { AccessResult } from './access.types.js';
import type { EntranceMethod, EntryRepository } from './entry.repository.js';

/** One line of the day's list. Names and numbers come from the members at read time; the reason and the staff id stay in the log. */
export interface EntryView {
  id: string;
  checkedAt: string;
  memberNumber: string | null;
  name: string | null;
  method: EntranceMethod;
  result: AccessResult;
}

export interface EntriesDay {
  date: string;
  /** Members who entered: green and yellow checks. */
  count: number;
  entries: EntryView[];
}

export interface EntriesServiceDeps {
  entries: Pick<EntryRepository, 'listByDate'>;
  members: { list(): Promise<Array<{ id: string; memberNumber: string; firstName: string; lastName: string }>> };
  now?: () => Date;
}

export function createEntriesService({ entries, members, now = () => new Date() }: EntriesServiceDeps) {
  return {
    // The day's entries newest first, today in the club time zone by default.
    async list(date: string = toIsoDate(now())): Promise<EntriesDay> {
      const [rows, everyone] = await Promise.all([entries.listByDate(date), members.list()]);
      const byId = new Map(everyone.map((member) => [member.id, member]));
      const views = rows.map((row): EntryView => {
        const member = byId.get(row.memberId);
        return {
          id: row.id,
          checkedAt: row.checkedAt,
          memberNumber: member?.memberNumber ?? null,
          name: member ? `${member.firstName} ${member.lastName}` : null,
          method: row.method,
          result: row.result,
        };
      });
      return { date, count: views.filter((view) => view.result !== 'red').length, entries: views };
    },
  };
}

export type EntriesService = ReturnType<typeof createEntriesService>;
