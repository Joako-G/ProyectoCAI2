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
- Provisional, from review (T2b): when a member is deactivated, their face profile is deleted (biometric data must not outlive its purpose), and recognition never matches an inactive member. Reactivating a member does not restore the face; staff enroll again with consent. If the database is down at that moment the deletion is logged and skipped, and the leftover profile never matches; it is not purged later yet.
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
- [x] T2 — Face profiles backend. Route: same writer.
  - Table with one descriptor per member and consent fields.
  - Enroll, remove and recognize endpoints, with recognition reusing the access check.
  - Capability, wiring, route matrix and audit coverage.
- [x] T2b — Review fixes. Route: same writer.
  - The backend starts when the database is down (faces answer 503 until restart; `migrate` still fails loudly), pool timeouts, and face profile deletion on deactivation through a members lifecycle port.
- [x] T3 — Enroll a face from the member record. Route: same writer.
  - Camera capture in the browser, a consent checkbox, enroll and remove.
- [x] T4 — Recognize at Ingreso. Route: same writer.
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

- 2026-11-07, T2 done (`feat(faces)`): migration `002_create_face_profiles.sql` (`face_profiles`, `vector(128)`, consent fields, no image/name/DNI); module `backend/src/modules/faces` (port, Postgres repository with parameterized queries and an error guard that drops row text, validation, service, routes); capability `faces:manage` (secretary, head secretary; mirrored in the frontend union); audit entity `face_profile` ("Perfil facial del socio N"); `AccessService.checkMember(memberId)`; `AccessReason` gains `not_recognized`.
  - Routes: `PUT/DELETE/GET /api/faces/:memberId`, `POST /api/faces/recognize` (read-only in the audit table). Without `DATABASE_URL` every route answers 503 `faces_unavailable` (after the 401/403 checks). Threshold `RECOGNITION_MAX_DISTANCE = 0.5`, provisional.
  - RED: `Cannot find module '../../src/modules/faces/face.service.js'` / `face.validation.js`; `service.checkMember is not a function`; `permissions[capability] is not iterable`; route matrix `expected 404 to be 401` for the four face routes.
  - GREEN: backend suite 1053 passed plus 15 database tests with `TEST_DATABASE_URL`; without it 1053 passed and 13 database tests skipped.
  - The frontend `AccessReason` does not list `not_recognized` yet; T4 adds it with the Ingreso camera mode.

- 2026-11-07, T2b done (`fix(faces)`): `startFaces` (`modules/faces/faces.startup.ts`) wraps the migrations and degrades to the 503 router with one credential-free log line; `createPool` sets a 5 s connection timeout and a 10 s statement timeout (the `migrate` script allows 120 s); `MemberLifecycle` port on the members service, wired in `server.ts` to `faceService.discardForDeactivatedMember`; recognition answers `not_recognized` for an inactive member.
  - RED: `Failed to load url ../../src/modules/faces/faces.startup.js`; `discardForDeactivatedMember is not a function`; pool options `expected undefined to be 5000`; hook `Number of calls: 0`; inactive recognize returned the `inactive` answer (7 tests failed).
  - GREEN: backend 1061 passed plus 17 database tests. Manual: server with an unreachable `DATABASE_URL` logged one line and listened.

- 2026-11-07, T3 done (`feat(faces)`): `@vladmandic/face-api` 1.7.15 (exact pin) in the frontend. New `frontend/src/features/faces`: `camera.ts` (getUserMedia, typed `CameraError`), `face-engine.ts` (the only file importing face-api: tiny face detector, 68 landmarks, recognition net; counts faces first, computes the descriptor only for exactly one), `face-tools.ts` (the single seam tests mock; loads the engine with a dynamic `import()` only when the camera opens), `useFaceCamera` (stream and detector lifecycle, released on stop and unmount), `FaceEnrollment` (the "Reconocimiento facial" block: status, "Registrar cara", consent checkbox, "Capturar y guardar", "Borrar cara" with confirmation). Shown in the member record only with `faces:manage` and only for active members. Images are never uploaded: only `{ descriptor, consent: true }` is sent.
  - Models: `frontend/scripts/copy-face-models.mjs` copies the tiny detector (193 KB), the 68-point landmarks (357 KB) and the recognition net (6.4 MB) from the package into `frontend/public/models/face`, served at `/models/face` with no CDN. It runs on `postinstall` and `predev`. The copies are about 7 MB, so they are git-ignored. The tiny detector was chosen over SSD MobileNet (5.6 MB) because it is 30 times smaller and fast enough for one close face at a desk.
  - RED: `Failed to resolve import "../services/camera"` and `"./faces-api"` (both new test files failed to load); the member record test: `Unable to find role="heading" and name "Reconocimiento facial"` (1 of 3 failed).
  - GREEN: faces tests 17 passed, member record 3 passed. Not tested: the real camera and the real models, which need a browser.

- 2026-11-07, T4 done (`feat(faces)`): Ingreso gets a "Cámara" toggle next to the DNI field (the field works at all times). `useCameraEntrance` looks every 500 ms; when exactly one face is in view for 3 looks in a row it POSTs only the descriptor to `/api/faces/recognize`, shows the same result panel, then rests 4 s. `useAccessCheck` gains `recognize`; `AccessReason` gains `not_recognized` ("No reconocido — ingrese el DNI"); a 503 shows "Reconocimiento facial no disponible — use el DNI" and turns the camera off. The camera stops when switching mode off and when leaving the screen. Timings are provisional and overridable through a `timing` prop (tests).
  - RED: `Unable to find an accessible element with the role "button" and name "Cámara"` (12 tests failed), `describeRecognizeError is not a function`.
  - GREEN: access tests 32 passed. Frontend suite: 541 passed before T4's tests were added; 552 of 553 in the final run; the one failure (`App.navigation` teacher roster) timed out under load and passes alone.
  - The full frontend suite is flaky on this machine at the default 5 s timeout under parallel load (different files time out on each run); with `--maxWorkers=3 --testTimeout=30000` it passes.
  - Not tested: the real camera, the real models and recognition quality (needs a browser and a face).

## Next step
Browser check with the team's faces (see Checks).
