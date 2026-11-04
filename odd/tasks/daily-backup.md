# Daily backup (RNF-03)

## Objective
Copy every data file automatically once a day to a configurable folder, which can be an external drive. Show the head secretary when the last copy ran, and document how to restore one.

## Problem and why
RNF-03: "Backup automático diario de la base de datos, con copia en un dispositivo externo y un procedimiento de restauración documentado." Acceptance: data loss at most one day; restore in under two hours. The survey report says today "No hay respaldo confirmado". All data lives in JSON files under `backend/data` with no copy.

## Scope
- In:
  - A backup module that copies every data file into a dated folder under a configurable destination.
  - A daily automatic run, checked while the backend is running.
  - Retention of the most recent copies.
  - `GET` status and `POST` run-now endpoints for the head secretary, plus a "Respaldo" section.
  - A written restore procedure.
- Out:
  - Restoring from the screen.
  - Encryption.
  - Copies to the cloud.
  - Backing up when the backend is not running.

## Decisions
Provisional, not confirmed by the club:
- Destination: `BACKUP_DIR`, which can point to an external drive. It defaults to `backend/backups`, which is gitignored. When the destination is the default, the screen says that it is not an external device.
- Retention: keep the 30 most recent copies.
- Only the head secretary can see the status or run a copy (`backup:run`), the role that already holds cash close and configuration.
- Schedule: at startup and then every hour, the backend runs a copy if the last successful one is older than 24 hours.
- Each file is copied whole. Files are written by temp file and rename, so each copied file is complete, but files copied a moment apart are not one atomic snapshot across files. This is acceptable for a one-day recovery point.

## Constraints
- A failed copy never stops the backend or a business operation. It is recorded, kept visible in status, and logged without personal data.
- A failed copy never deletes older good copies. Retention removes only folders that the backup module created.
- The run-now route is a write route, so it records an audit entry, as the shared audit coverage test requires.
- Backups contain personal data (RNF-09). The destination must not be inside a served or tracked folder.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English. Synthetic data only.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`. Every behavior task records observed RED, GREEN, REFACTOR.

## Delivery
Work on `manu` (user preference). Forecast is about 700 authored lines in two work-unit commits, each small enough for one native review. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Backend backup module. Route: delegated direct writer (2+ non-trivial files).
  - Copy, retention, schedule, status, `GET /api/backups`, `POST /api/backups`, `backup:run`, wiring, route-matrix and audit coverage rows, and `tests/backup` in the backend test script.
  - Restore procedure in `docs/backup-restore.md`, linked from the README.
  - Acceptance:
    - A copy contains every data file, and seed files when present.
    - A failed copy keeps older copies and is reported.
    - Retention keeps 30 copies.
    - The schedule skips a run when the last successful copy is fresh.
    - Secretary and teacher get 403.
    - Status says whether the destination is the default folder.
- [x] T2 — Frontend "Respaldo" section. Route: same writer.
  - Shows the last successful copy, the last failure, the destination kind and the number of kept copies, with a "Hacer un respaldo ahora" button.
  - Loading, error with retry, and in-progress states. Visible only to the head secretary.

## Checks
- `pnpm --filter @club-socios/backend test`, `pnpm --filter @club-socios/backend typecheck`, `pnpm --filter @club-socios/frontend test`, `pnpm --filter @club-socios/frontend typecheck`.
- Browser check, then a restore rehearsal on a copy following the written procedure.

## Open items
- Owners: confirm the destination device, retention, who may run a copy, and how many hours a day the backend runs. A copy only happens while it is running.

## Progress
- 2026-11-04: requirement read, data layout mapped, this document created.
- 2026-11-04: T1 done (route: delegated direct writer). Files are an explicit whitelist in `backup.sources.ts` (configured data files, `users.json`, two seed files), not the whole folder, so `users.old.json` is never copied. A copy is built in `.partial-backup-*`, then renamed to `backup-YYYYMMDDTHHMMSSZ`; retention only touches folders matching that name. Last good copy is read from the folders, so it survives a restart; the last failure is in memory (resets on restart). Run-now audit: action `create`, entity `backup`; automatic copies write no audit entry. A second copy in the same second answers 409.
  - RED: `Error: Cannot find module '../../src/modules/backup/backup.service.js'` (service, scheduler, sources suites and the audit coverage suite); `expected 404 to be 401/403/200/201/409/500` for `/api/backups` in the route matrix and `backup.api.test.ts`; `TypeError: permissions[capability] is not iterable` for `backup:run`; label test failed for the missing `backup` entity type.
  - GREEN: backend tests 56 files, 947 passed; backend and frontend typecheck clean; frontend tests 45 files, 484 passed; `git diff --check origin/manu...HEAD` clean.
  - REFACTOR: moved folder-name parsing into `backup.naming.ts`, shared by the service and the audit label.
- 2026-11-04: T1 committed as 52b5dc9 `feat(backup): copy the data files daily to a configurable folder`.
- 2026-11-04: T2 done (same writer). New `frontend/src/features/backup` (types, api, format utils, `useBackups`, `BackupView`), section `backup` at `/respaldo` for `backup:run`, listed after Auditoría. Failure code and server text are never shown; the screen says the last attempt failed and that older copies are kept. A refused second copy (409) says one is already running.
  - RED: `Failed to resolve import "./BackupView"`; `expected [ 'members', 'audit' ] to deeply equal [ 'members', 'audit', 'backup' ]`; `Unable to find role="heading" and name "Respaldo"` and `"Sin acceso"` for `/respaldo` in the routing tests.
  - GREEN: frontend 8 related files, 90 passed; full verification recorded in the final report (backend, frontend, typechecks, diff check).
  - REFACTOR: none needed beyond sharing `formatInstant` from the audit feature.
- Not done: browser check and restore rehearsal (listed under Checks); no work-unit review ran.

## Next step
Browser check on the running dev server, then the restore rehearsal on a copy following `docs/backup-restore.md`. Push and PR are the user's decision.
