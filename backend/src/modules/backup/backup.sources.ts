import {
  DISCIPLINES_SEED_FILE,
  SEED_FILE,
  auditFilePath,
  cashCountsFilePath,
  disciplinesFilePath,
  membershipsFilePath,
  membersFilePath,
  paymentsFilePath,
  pricingConfigFilePath,
} from '../../config/paths.js';
import { defaultUsersFilePath } from '../users/user.repository.js';
import type { BackupSource } from './backup.types.js';

/**
 * The files the backup copies: an explicit list of the configured data files, the users file and the two seed
 * files, never the whole data folder. A listing would also copy stray files such as `users.old.json`, which
 * holds old accounts and password hashes that nobody asked to keep. A new data file must be added here.
 */
export function backupSources(env: NodeJS.ProcessEnv = process.env, usersFile: string = defaultUsersFilePath): BackupSource[] {
  return [
    { name: 'members.json', path: membersFilePath(env) },
    { name: 'disciplines.json', path: disciplinesFilePath(env) },
    { name: 'memberships.json', path: membershipsFilePath(env) },
    { name: 'pricing-config.json', path: pricingConfigFilePath(env) },
    { name: 'payments.json', path: paymentsFilePath(env) },
    { name: 'audit.json', path: auditFilePath(env) },
    { name: 'cashcounts.json', path: cashCountsFilePath(env) },
    { name: 'users.json', path: usersFile },
    { name: 'members.seed.json', path: SEED_FILE },
    { name: 'disciplines.seed.json', path: DISCIPLINES_SEED_FILE },
  ];
}
