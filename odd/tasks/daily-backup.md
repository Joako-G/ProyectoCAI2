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
- Retention (changed by T3): keep the newest copy of each of the 30 most recent calendar days that have copies, with days in the club time zone, and always keep the 5 most recent copies whatever their day. Not confirmed by the club.
- Configured destination (T3): when `BACKUP_DIR` is set, the folder must already exist; the backend never creates it, so an unplugged drive is reported instead of written to the wrong place. The default folder is still created by the backend.
- Folder with an impossible date (T3): a module-named folder whose timestamp is not a real instant (month 13, 31 February) is not counted, not shown as the last copy and never deleted. Decision made by the writer; not confirmed by the club.
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
- [x] T3 — Retention by day and a missing drive. Route: delegated direct writer (backend service, naming, types, frontend view and tests, docs: 2+ non-trivial files).
  - Fixes the review findings `R1-retention-flush`, `R4-manual-runs-shrink-window`, `R4-missing-drive-masked`, `R2-unreadable-destination-looks-empty` and `R3-invalid-folder-date`.
  - Acceptance:
    - 30 copies in one day do not delete older days; the newest copy of each of the last 30 club days and the 5 newest copies stay.
    - A configured `BACKUP_DIR` that does not exist is never created: the copy fails with `DESTINATION_MISSING` and older copies stay.
    - Status tells `ready`, `missing` and `unreadable` apart, and the screen says in Spanish to connect the drive or check the folder, with no path.
    - A folder with an impossible date is ignored by status and retention and never deleted.

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
- Parent fix `fde6949`: the frontend audit entity type union now includes `backup`.
- 2026-11-04: Gentle-AI review of `3e18ba0`..`fde6949` (lineage `review-a6bc3fddda86e814`, 39 files, 1,276 lines, high risk, consent granted): approved and acknowledged.
  - Non-blocking warnings, later work:
    - `R1-retention-flush` and `R4-manual-runs-shrink-window`: 30 manual copies in one day can push out every older daily copy.
    - `R4-missing-drive-masked`: an absent external drive needs a clear status.
    - `R2-unreadable-destination-looks-empty`: an unreadable destination shows as "no copies".
    - `R3-invalid-folder-date`.
    - `R3-audit-failure-misreports-copy` and `R4-audit-throw-misreports`.
  - Suggestions: see the review record.
- 2026-11-04: browser check at `/respaldo` as `demo@club.test`.
  - Starting the backend made the first automatic copy.
  - "Hacer un respaldo ahora" made a second copy, showed "Respaldo realizado." and the count, and added the audit entry "Respaldo del 04/11/2026".
  - The screen warns that the default folder is not an external device.
- 2026-11-04: restore rehearsal into a scratch folder, not `backend/data`.
  - The latest copy holds every existing data file except the deliberately excluded `users.old.json`, and its manifest lists them.
  - Every file is byte-identical to `backend/data` except `audit.json`, which gained the run's own entry after the copy, as expected.
  - Not done: a real stop–copy–start restore on the live data folder, and an external drive.

- 2026-11-04: T3 done (route: delegated direct writer). Service takes `keep` (days) and `keepRecent`; status gains `destination.state` and `keepRecent`. Retention reads the destination again after the copy and never deletes the copy just made. `isCopyFolder` now needs a real date, so an impossible-date folder is invisible to the module. Not done: `R3-audit-failure-misreports-copy` and `R4-audit-throw-misreports`.
  - RED (backend): `AssertionError: expected [ 'backup-20261105T180000Z', …(2) ] to deeply equal [ 'backup-20261103T150000Z', …(3) ]` (30 copies in one day pushed out older days); `AssertionError: expected { ok: true, backup: { …(3) } } to deeply equal { ok: false, failure: { …(2) } }` (a missing configured folder was created); `expected { …(6) } to match object { …(3) }` (an unreadable destination looked empty). 10 of 21 service tests failed.
  - RED (frontend): `TestingLibraryElementError: Unable to find role="alert"` for the missing and unreadable destination; the copies message test failed on the old "se conservan las últimas 30" text. 3 of 11 failed.
  - GREEN: service suite 21 passed; backup frontend suite 11 passed. Full: backend 56 files, 956 passed; frontend 46 files, 498 passed; both typechecks clean.
  - REFACTOR: none beyond `readDestination` replacing `listCopies`, shared by status and retention.
  - Note: one full frontend run failed `App.navigation.test.tsx > role-based navigation > shows the head secretary the three sections, numbered 01 to 03, and opens Socios first` (cannot find the Socios heading under load); it passed alone and on the full rerun.

- 2026-11-04: Gentle-AI review of T3 `cca848b` (lineage `review-8d8646a838d35337`, 16 files, 353 lines, medium risk, consent granted): approved and acknowledged; one suggestion, `R3-keeprecent-zero-keeps-all`. Browser: `/respaldo` shows the new retention text with the default folder. The missing-drive and unreadable states are covered by tests only.

## Next step
The user decides on push. Open: the two audit-failure warnings from the first review.
