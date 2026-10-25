import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import demoUsers from '../../database/demo-users.json';
import { legacyRoles, type DemoUser } from './user.types.js';

// src/modules/users and dist/modules/users are both three levels below the backend package directory.
export const defaultUsersFilePath = join(__dirname, '..', '..', '..', 'data', 'users.json');

export class UserRepository {
  private users: DemoUser[];

  constructor(private readonly storePath: string, private readonly persistOverride?: (users: DemoUser[]) => void) {
    if (!existsSync(storePath)) {
      mkdirSync(dirname(storePath), { recursive: true });
      writeFileSync(storePath, `${JSON.stringify(demoUsers, null, 2)}\n`, { flag: 'wx' });
    }
    this.users = (JSON.parse(readFileSync(storePath, 'utf8')) as DemoUser[])
      .map((user) => ({ ...user, role: legacyRoles[user.role] ?? user.role }));
  }

  list(): DemoUser[] { return this.users; }
  save(users: DemoUser[]): void {
    if (this.persistOverride) { this.persistOverride(users); return; }
    const temporaryPath = `${this.storePath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(users, null, 2)}\n`, { flag: 'wx' });
      renameSync(temporaryPath, this.storePath);
    } finally {
      if (existsSync(temporaryPath)) {
        try { unlinkSync(temporaryPath); } catch { /* Best-effort cleanup. */ }
      }
    }
  }
  replace(users: DemoUser[]): void { this.save(users); this.users = users; }
}
