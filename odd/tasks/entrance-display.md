# Entrance display and entry log

## Objective
Every entrance check, by DNI or by face, is logged and greets the member on a public screen in real time. Staff can see the day's entries.

## Problem and why
The owners want the demo to show the full entrance flow: the member is recognized, a public screen greets them, and the club knows who came in and when. This follows RF-08. The entry log was an open owner question; the user asked for it on 2026-11-07.

## Scope
- In:
  - An `access_entries` table in PostgreSQL.
  - Each identified check is recorded.
  - A server-sent events stream of greeting events.
  - A full-screen public display page.
  - An "Ingresos del día" list for staff.
- Out:
  - Turnstiles.
  - Statistics beyond the day's count.
  - Deleting entries.
  - Migrating other modules.

## Decisions
- User, 2026-11-07:
  - Build the public screen and the entry log.
  - Raise the frontend test timeout.
- Provisional, not confirmed by the club:
  - The public screen shows only the first name:
    - green: "¡Bienvenido/a, {nombre}!"
    - yellow: "¡Bienvenido/a, {nombre}! Pasá por secretaría"
    - red, unknown or not recognized: "Acercate a secretaría", with no name and no reason.
  - The public screen never shows debts, amounts, months, member numbers or the reason for a refusal.
  - The display is a full-screen route opened in its own window by a signed-in staff member. It works on a second monitor of the camera PC and on another device on the club network. The device must stay signed in.
  - Only identified members are logged. An unknown DNI or an unrecognized face is not logged, because there is no member and the DNI must never be stored.
  - The day's entries can be read by secretaries and the head secretary.

## Constraints
- Without `DATABASE_URL`, checks keep working as today: nothing is logged, and the display still greets through the event stream, which needs no database.
- No DNI, descriptor, amount or reason ever goes on the stream or in logs.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English. Synthetic data only.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`.

## Delivery
Work on `manu` (user preference), one work-unit commit per task. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Frontend test timeout. Route: delegated direct writer. Commit `028663b`.
  - RED: the plain frontend test run had 6 files and 10 tests failing with "Test timed out in 5000ms" (PricingView, DisciplinesView and others).
  - GREEN: after `testTimeout` and `hookTimeout` 20000 and `maxWorkers` 2, 597/597 passed in about 2m17s.
- [x] T2 — Entry log backend. Route: same writer. Commit `c4e6099`.
  - RED: "Cannot find module" for the entrance recorder and the entries module. `GET /api/access/entries` returned 404. `check` and `checkMember` were not called with `{ method, actorId }`. 16 failures.
  - GREEN: the backend suite passes with and without `TEST_DATABASE_URL`. `migrate` applied `003_create_access_entries.sql`.
  - The audit coverage test moves `POST /api/access/check` and `POST /api/faces/recognize` to an explicit `SELF_LOGGING` list. The entry log is their record, and an audit entry per entrance would be noise. A test asserts that no exempt route has an audited scenario.
- [x] T3 — Live greeting stream and public display. Route: same writer.
  - RED backend: `Cannot find module '../../src/modules/access/greeting.bus.js'` (greeting and display tests), plus `recognize` not telling the entrance about an unmatched face. RED frontend: `Failed to resolve import "./EntranceDisplay"` and `"./greeting-format"`, no "Abrir pantalla pública" link, `/pantalla-ingreso` not rendering "Bienvenidos al club".
  - GREEN: backend access/faces/authorization/audit suites and frontend access + App suites pass.
  - Backend: in-memory `greeting.bus.ts`; the entrance recorder publishes `{ at, tone, firstName? }` before it writes the log, so the display needs no database. `GET /api/access/display-events` (capability `access:check`) sends SSE with `no-cache, no-transform`, `X-Accel-Buffering: no`, `retry: 3000` and a `: ping` heartbeat every 25 s, and unsubscribes on close. A face that matches nobody is reported by the faces service; a matched one is reported once by the access service.
  - Vite proxy: `/api` is a plain string proxy to the backend, which streams SSE as is; no change needed. Not exercised through a live Vite proxy in this run.
  - Frontend: `/pantalla-ingreso` renders `EntranceDisplay` outside the shell but behind login and `access:check` (login returns to it). `EventSource` with manual reconnect when the browser gives up; greeting held 7 s, then "Bienvenidos al club". The parser keeps only tone, time and first name. Ingreso has an "Abrir pantalla pública" link (new tab/window).
  - Route matrix: `GET /api/access/display-events` added; the matrix test cancels the stream body so the server can close.
  - Flake seen once and not reproduced: `audit.coverage` failed with `bad port` from fetch on an unsafe ephemeral port; the rerun passed.
- [x] T4 — "Ingresos de hoy" for staff. Route: same writer.
  - RED: `Failed to resolve import "./EntriesToday"` and `"./AccessPage"` (new tests failed before code).
  - GREEN: frontend access and App suites pass (116 tests); full frontend suite 62 files / 633 tests.
  - `AccessPage` renders the unchanged `AccessView` plus `EntriesToday`; `AccessView` calls an optional `onAnswered` after each answered check (DNI or camera), which bumps the panel's refresh key. The panel also refreshes every minute, keeps the last table when a refresh fails, shows the Spanish unavailable text on 503 and a retry on other errors. Time is shown in the club time zone.

## Checks
- Backend tests with and without `TEST_DATABASE_URL`, frontend tests, and both typechecks.
- Browser check: the display in a second window updates when a check runs.

## Open items
- Owners: confirm the public texts, how long entries are kept, and who may read them.
- Backup of PostgreSQL data is still missing. It is tracked in `odd/tasks/face-recognition-demo.md`.

## Progress
- 2026-11-07: scope agreed with the user; this document created.
- 2026-11-07: T1 done (see task line for evidence).
- 2026-11-07: T2 done (see task lines for evidence).
- 2026-11-07: T3 done (see task lines for evidence).
- 2026-11-07: T4 done. Final checks: backend tests with `TEST_DATABASE_URL` (68 files / 1111 tests, plus 22 database tests) and without (database tests skipped), both typechecks, frontend suite, `migrate` applied `003_create_access_entries.sql`, `git diff --check` clean. One no-database backend run had 19 failures in `tests/access/access.api.test.ts` (every test in the file, so a setup problem); four reruns of that file and a full rerun passed, cause not found.

- 2026-11-07: Gentle-AI reviews, in two parts because the whole range exceeded the review size, consent granted each time; both approved and acknowledged.
  - T1+T2 (`4d88219`..`c4e6099`, lineage `review-9003926eb2495320`, 24 files, 712 lines, medium risk): reviewed in a temporary detached worktree.
  - T3+T4 (`c4e6099`..`aa2465c`, lineage `review-2eb33a09e8bd046f`, 31 files, 1,242 lines, medium risk).
  - Later work: `R3-count-not-distinct` (the day's count counts checks, not distinct members), `R3-awaited-entry-write` (a slow database delays the check), `R3-sse-auth-loop` (an expired session makes the display reconnect forever), `R3-hold-timing-flake`, `R3-entries-coupled-to-faces` and `R3-close-on-request`.
  - Browser check not done: the running backend was started by the user before these commits and answers 404 on `/api/access/entries`.

## Next step
Owners confirm the open items; then review, push and PR are the user's call. Try the screen: sign in, open Ingreso, press "Abrir pantalla pública", then run a DNI check or the camera.
