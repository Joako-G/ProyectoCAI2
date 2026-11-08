# PostgreSQL backup (RNF-03, second part)

## Objective
The daily backup also copies the PostgreSQL database, so face profiles and entry logs are no longer lost if the database or the PC fails. A written procedure and a rehearsal prove that it can be restored.

## Problem and why
- RNF-03: "Backup automático diario de la base de datos, con copia en un dispositivo externo y un procedimiento de restauración documentado." Acceptance: data loss of at most one day and a restore in under two hours.
- The backup module copies only JSON files. Face descriptors (`face_profiles`) and the entrance log (`access_entries`) live in PostgreSQL, so they have no copy. `odd/tasks/face-recognition-demo.md` and `odd/tasks/entrance-display.md` both list this as an open item.
- The database will grow as modules migrate from JSON to PostgreSQL, so the backup must cover every table without a hand-kept list.

## Scope
- In:
  - A logical dump of the whole database, taken inside the existing daily copy and the "Hacer un respaldo ahora" button, saved next to the JSON files.
  - Status on the Respaldo screen.
  - A restore procedure, and a restore rehearsal into a scratch database.
- Out:
  - Point-in-time recovery and replication.
  - Encrypting the backup folder.
  - Restoring from the screen.
  - Moving other modules to PostgreSQL.

## Decisions
- User, 2026-11-08: add the PostgreSQL backup next.
- Findings from the environment: this PC has no `pg_dump` on `PATH`, and the database runs in Docker from `docker-compose.yml`, service `db`.
- Provisional, not confirmed by the club:
  - The dump is made with `pg_dump` custom format (`-Fc`), which is compressed and restorable with `pg_restore`. It is taken through `docker compose exec -T db pg_dump`, with a fallback to a `pg_dump` found on `PATH`, and an environment override for the command.
  - The dump file is named `database.dump`, lives in the same dated copy folder as the JSON files, and is listed in the manifest. Retention is unchanged, so one folder is one restorable copy.
  - If `DATABASE_URL` is not set the database part is skipped silently.
  - If the dump fails, the JSON files are still copied and the run is reported as partial. The status keeps the failure code visible, and older copies are never deleted because of a failure.

## Constraints
- A dump holds biometric descriptors, so it is as sensitive as the database. Nothing about its contents goes to logs or to the screen, only sizes and codes.
- The password never appears on a command line or in logs. It goes through the environment of the child process only.
- No shell: the child is started with an argument list, with a timeout and no unbounded output held in memory.
- A failed dump never deletes or overwrites a good one. The file is written under a temporary name and renamed only when complete.
- `BACKUP_DIR` on an external drive must be protected, for example with BitLocker. This goes in the restore guide.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English. Synthetic data only.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`. Database tests are skipped without `TEST_DATABASE_URL`.

## Delivery
Work on `manu` (user preference), one work-unit commit per task. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Database dump in the backup run. Route: delegated direct writer (one bounded writer for T1–T3). Done 2026-11-08, see Progress.
  - A port for running the dump, with an implementation using the argument list, timeout and temporary file.
  - Manifest and status fields, and failure handling.
  - Acceptance:
    - The copy folder holds `database.dump` when the database is configured.
    - A failed dump leaves the JSON copy intact and the run partial.
    - No password or content in logs or responses.
    - Without `DATABASE_URL` nothing changes.
- [x] T2 — Respaldo screen and restore guide. Route: same writer. Done 2026-11-08, see Progress. The browser check of the screen is left to the caller (the backend must be restarted first).
  - The screen shows the database part: included, failed with its code, or not configured.
  - `docs/backup-restore.md` explains how to restore the database, and how to protect an external drive.
- [ ] T3 — Restore rehearsal with evidence. Route: same writer.
  - Dump the development database, restore it into a temporary database, compare table row counts, and drop the temporary database. Record the command lines and numbers in this document.

## Checks
- Backend and frontend tests and typechecks, with Docker running.
- Browser check of the Respaldo screen.
- The rehearsal in T3.

## Open items
- Owners: the external drive, how many copies to keep, and who may restore.
- Encryption of the backup folder.
- Restoring while the backend is running is not covered. The guide says to stop it first.

## Progress
- 2026-11-08: the plan is agreed; this document was created. This PC has no `pg_dump`, and Docker is available.

- 2026-11-08 T1 (writer):
  - RED: `vitest run tests/backup` failed with `Cannot find module '../../src/modules/backup/backup.dump.js'` in `backup.dump.test.ts` and `backup.service.test.ts` (2 suites failed, 19 old tests passed).
  - GREEN: `tests/backup` 5 files, 70 tests passed. Real dump of `club_socios_test` through the Docker `db` service passed (`tests/database/backup-dump.test.ts`, 1 test, not skipped). Full backend suite: 70 files / 1162 tests plus 5 files / 24 database tests passed; typecheck clean. One earlier full run had a single unrelated failure (`reports API: discipline settlement > answers 404 for an unknown discipline and 400 for a bad month or a missing discipline`); it passed alone and on the rerun (looks like a load-related timeout, not investigated).
  - Command resolution (`backend/src/modules/backup/backup.dump.ts`): 1) `PG_DUMP_COMMAND` (JSON array or space-separated; used alone; connection passed as `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`); 2) `docker compose -f <repo>/docker-compose.yml exec -T -e PGPASSWORD db pg_dump -U <user> -d <db> -Fc -w`, only for a database on this computer and when the compose file exists; 3) `pg_dump -Fc -w` on the PATH with the `PG*` variables. A command is skipped for the next only when it cannot start; a command that ran and failed is `DATABASE_DUMP_FAILED`; none able to start is `DATABASE_DUMP_UNAVAILABLE`.
  - Manifest `database` and status `database.{lastCopy,lastFailure}`: `{state:'not_configured'}`, `{state:'included', file:'database.dump', format:'pg_dump-custom', bytes}` or `{state:'failed', code}`. The copy result gains `database` and `partial`; a partial copy still answers 201.
  - Decision gaps: (1) a copy whose dump failed counts as a good copy for the scheduler (no hourly retry until a day passes) and for retention, so after many failing days the last copy that holds a dump could be pruned; (2) on Windows a timeout kills the Docker CLI process, and `pg_dump` inside the container may run on until its pipe breaks; (3) copies from before this change read as "not configured".
  - Route: `route-matrix`, `scheduler` and `api` tests only needed the new fields.

- 2026-11-08 T2 (writer):
  - RED: `vitest run src/features/backup` had 5 failing tests (`shows the database part of the last copy with its size`, `shows a very small dump as a minimum size instead of 0 MB`, `warns that the last copy has no database, and shows the code on the line`, `says the database is not configured, without a warning`, `says a manual copy was made without the database when the dump failed`), each with `Unable to find an element with the text: Base de datos: ...`.
  - GREEN: frontend suite 72 files / 733 tests passed; typecheck clean. Two earlier full runs each had one failure that passed alone: `src/App.routing.test.tsx > opens Respaldo at /respaldo ...` (a real miss: its status fixture lacked `database`, fixed) and `src/App.navigation.test.tsx > shows a teacher only Mis disciplinas ...` (26 ms, passed alone and on the next full run; looks like a flake).
  - The Respaldo screen shows "Base de datos: incluida (X MB)", "... no se pudo copiar (código)" with a warning alert, or "... no configurada"; a manual copy with a failed dump says "Respaldo realizado, pero sin la base de datos."
  - Restore commands were run for real against a scratch database (see T3). Verified: `docker compose cp` + `pg_restore` works in every shell; Git Bash `< database.dump` works; Windows PowerShell 5.1 `Get-Content | docker ...` fails (binary corrupted), so the guide says not to use it. Git Bash rewrites `/tmp/...` unless `MSYS_NO_PATHCONV=1`. A Command Prompt `<` redirect was not verified.
  - Decision gap: the BitLocker steps are written from general Windows knowledge, not run on the club's drive.

## Next step
T3.
