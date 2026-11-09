import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { backupDirectory } from '../../src/config/paths.js';
import { backupSources } from '../../src/modules/backup/backup.sources.js';

describe('backupDirectory', () => {
  it('defaults to backend/backups and says so', () => {
    expect(backupDirectory({})).toEqual({ path: resolve(__dirname, '../../backups'), isDefault: true });
  });

  it('passes an absolute BACKUP_DIR through, for example an external drive, and is not the default', () => {
    const absolute = resolve('/mnt/external-drive/club-backups');
    expect(backupDirectory({ BACKUP_DIR: absolute })).toEqual({ path: absolute, isDefault: false });
  });

  it('resolves a relative BACKUP_DIR against the cwd', () => {
    expect(backupDirectory({ BACKUP_DIR: 'tmp/copies' }).path).toBe(resolve(process.cwd(), 'tmp/copies'));
  });
});

describe('backupSources', () => {
  const usersFile = resolve('/srv/club/users.json');

  it('names every data file, the users file and the two seed files, and nothing else', () => {
    const sources = backupSources({}, usersFile);
    expect(sources.map(({ name }) => name).sort()).toEqual([
      'audit.json', 'cashcounts.json', 'disciplines.json', 'disciplines.seed.json', 'expenses.json', 'members.json', 'members.seed.json',
      'memberships.json', 'payments.json', 'pricing-config.json', 'users.json',
    ]);
    expect(sources.find(({ name }) => name === 'users.json')?.path).toBe(usersFile);
    expect(sources.find(({ name }) => name === 'members.json')?.path).toBe(resolve(__dirname, '../../data/members.json'));
  });

  it('follows the file locations the operator configured', () => {
    const payments = resolve('/srv/club/pagos.json');
    const sources = backupSources({ PAYMENTS_FILE: payments, AUDIT_FILE: resolve('/srv/club/auditoria.json') }, usersFile);
    expect(sources.find(({ name }) => name === 'payments.json')?.path).toBe(payments);
    expect(sources.find(({ name }) => name === 'audit.json')?.path).toBe(resolve('/srv/club/auditoria.json'));
  });
});
