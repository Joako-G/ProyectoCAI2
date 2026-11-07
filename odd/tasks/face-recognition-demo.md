# Face recognition demo (RF-08, phase 2)

## Objective
For the meeting, a member's face can be enrolled and then recognized at the Ingreso screen. Recognition shows the same green, yellow or red answer as the DNI check, and the DNI stays as the fallback.

## Problem and why
The survey report says the secretaries want to drop the physical card: "Fase 1 (acceso básico) / Fase 2 (biometría)". Phase 1, the DNI check, is done. The project owners want a working face recognition demo first. They also want all data in PostgreSQL, migrated module by module, and this feature starts that database.

## Scope
- In:
  - PostgreSQL with pgvector through Docker Compose for development, `DATABASE_URL`, and a minimal SQL migration runner.
  - Face profiles that store only a numeric face descriptor per member, never an image.
  - Enroll and remove a face from a member's record, with a consent confirmation.
  - Recognize a face at Ingreso and reuse the existing access check.
- Out:
  - Anti-spoofing. A photo can fool the demo.
  - The public greeting screen.
  - A log of entries.
  - HTTPS on the club network.
  - Migrating other modules.
  - Backing up the database, which is open, see below.

## Decisions
- User, 2026-11-07:
  - The database is PostgreSQL, with Docker for development.
  - Everything migrates to the database module by module, but face recognition comes first, for a demo at the meeting.
- Recommended and accepted:
  - Recognition runs in the browser, so the camera image never leaves the PC.
  - Only the descriptor is sent and stored.
- Provisional, not confirmed by the club:
  - Enrollment requires ticking that the member, or the guardian for a minor, consented to biometric use. The time and the staff member are recorded.
  - Secretaries and the head secretary can enroll, remove and recognize.
  - The match threshold is conservative. No match falls back to typing the DNI.
- The rest of the app keeps working without a database. When `DATABASE_URL` is not set, the face features answer "not configured" and nothing else changes, so Joaquín's setup is unaffected.

## Constraints
- Biometric data is sensitive under Ley 25.326:
  - Never store or send images.
  - Never return descriptors from the API.
  - Never log them.
  - Removing a member's face deletes its descriptor.
- Enroll and remove are write routes, so they record audit entries without personal data.
- The browser allows the camera only on `localhost` or HTTPS. The demo runs on the camera PC.
- Demo with the team's own faces, with their permission, attached to synthetic members. Never use real club members.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`. Every behavior task records observed RED, GREEN, REFACTOR. Database tests run against the Docker PostgreSQL and are skipped, with a clear message, when no test database URL is set.

## Delivery
Work on `manu` (user preference), with four work-unit commits. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Database foundation. Route: delegated direct writer.
  - `docker-compose.yml` with a pinned pgvector PostgreSQL image, `pg` in the backend, `DATABASE_URL`, a migration runner applying numbered SQL files once, a test database setup, and `docs/database.md`.
- [ ] T2 — Face profiles backend. Route: same writer.
  - Table with one descriptor per member and consent fields.
  - Enroll, remove and recognize endpoints, with recognition reusing the access check.
  - Capability, wiring, route matrix and audit coverage.
- [ ] T3 — Enroll a face from the member record. Route: same writer.
  - Camera capture in the browser, a consent checkbox, enroll and remove.
- [ ] T4 — Recognize at Ingreso. Route: same writer.
  - A camera mode next to the DNI field, showing the same result panel, with the DNI as the fallback.

## Checks
- Backend and frontend test and typecheck commands.
- Database tests with Docker running.
- Browser check with the team's own faces.

## Open items
- Owners: the consent text (pending question 14), anti-spoofing, the public screen, a log of entries, and HTTPS on the club network.
- The backup module copies JSON files only, so face profiles in PostgreSQL are not backed up yet. This must be solved before any real use.

## Progress
- 2026-11-07: plan agreed with the user; `manu` fast-forwarded to `main` (PR #10 merged); this document created.

- 2026-11-07, T1 done (`feat(database)`): `docker-compose.yml` (pgvector/pgvector:0.8.1-pg17, pulled and healthy, 127.0.0.1:5432, volume `club_db_data`, test database `club_socios_test` created by `docker/postgres-init`), `pg` 8.23.1 + `@types/pg`, `DATABASE_URL`, migration runner (`schema_migrations`, advisory lock, one transaction per file), `migrate` script, migrations also run on server start, `docs/database.md`.
  - RED: `Cannot find module '../../src/config/database.js'` and `'../../src/database/migrate.js'` (both test files failed to load).
  - GREEN: 10 tests passed with `TEST_DATABASE_URL`; without it 2 pass and 5 skip with a message. `pnpm --filter @club-socios/backend migrate` applied `001_enable_pgvector.sql`, then "Database is up to date."
  - `backend/.env.example` is unreadable to the writer, so the variables are documented in `docs/database.md` only.

## Next step
T3.
