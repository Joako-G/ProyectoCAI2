# Demo login

## Objective
Implement a presentable demo login for the club system using synthetic users stored by the Express backend in a JSON file.

## Problem and rationale
The workspace is a runnable React/TypeScript/Vite and Express/TypeScript scaffold with no authentication or test runner. A backend-owned JSON source supports the demo login now and can later be reused for user CRUD without introducing a database. This is demonstration-only; it must not be presented as production authentication or used with real/sensitive data.

## Authorized scope and constraints
- Work only in this repository and the current feature branch (`JoakoG`); no remote operations, push, or PR.
- Implement login only. Do not implement users CRUD, database integration, production session/security infrastructure, or unrelated modules.
- Use synthetic user data with `id`, `name`, `email`, `passwordHash`, `role`, and `active`; never store plaintext passwords or real personal data.
- Keep the JSON source backend-owned and usable by the future users ABM. Use Node's built-in cryptography unless exploration reveals a blocker; avoid unnecessary dependencies.
- Match the supplied reference image's visual palette: dark navy, club blue, warm gold/cream accents, pale gray background, white cards, with responsive and accessible form controls.
- TDD is ON for this feature by explicit user choice. The project has no runner yet; establish a backend test runner, observe failing auth tests before implementation, then pass them. Frontend behavior receives build/typecheck and a local manual smoke check unless a suitable existing UI test setup is found.
- Delivery strategy: `ask-on-risk`; forecast roughly 300–400 authored lines as an advisory estimate, not a limit.

## Tasks
- [x] T1 — Add backend demo-user JSON data, login behavior, and focused tests using test-first development; use Node's built-in test runner with no additional test-runner dependency. Acceptance met: active synthetic credentials authenticate; bad credentials and inactive accounts receive the same 401; response contains only id/name/email/role; JSON contains scrypt hashes and no plaintext password. Commit: see repository history for this work unit. Rollback: revert the T1 commit to remove only backend demo-auth behavior/data/tests/config and this T1 evidence.
- [ ] T2 — Add the login screen and connect it to the backend login API, using the supplied palette. Route: delegated direct writer (feature UI, service/API wiring, and styles span multiple non-trivial files). Acceptance: accessible email/password form, pending/error/success states, responsive styling consistent with the reference; successful login shows a safe user-facing result; frontend typecheck/build pass and local login smoke check is recorded. Commit: pending. Runtime: pending. Rollback: revert only T2's frontend feature files and related configuration.

## Applicable checks
- `pnpm --filter @club-socios/backend test` (after T1 configures the runner).
- `pnpm -r typecheck`.
- `pnpm -r build`.
- Local backend/frontend smoke check of valid and invalid demo login; do not use real credentials or personal data.
- Structural readback of JSON seed data, ensuring only synthetic records and no plaintext password.
- `git status`, `git diff`, and commit identity readback for each work unit.

## Progress
- Exploration confirmed the scaffold has only `GET /health`, no auth route, no frontend API proxy, and no test runner. The supplied image is the visual reference. The parent `Documentacion/` requirements source is not available in this checkout; this demo is limited to the scope above.
- TDD evidence: `pnpm --filter @club-socios/backend test` initially ran three HTTP auth tests and observed RED (all three returned 404; expected 200/401). After implementation, all four tests pass (3 auth behavior checks plus JSON/hash safety).
- T1 verification: `pnpm --filter @club-socios/backend test` — PASS, 4 tests; `pnpm --filter @club-socios/backend typecheck` — PASS; `pnpm --filter @club-socios/backend build` — PASS. HTTP integration tests start the Express app on an ephemeral localhost port and verify success, invalid-password rejection, inactive-user rejection, and safe response shape.
- Seed structural check confirms two synthetic `.test` users with all six required fields, scrypt hashes and no plaintext credentials. T2 remains pending and was not started.
- Current branch is `JoakoG`; initial worktree was clean.
- Route: delegated direct. Trigger evidence: implementation spans multiple non-trivial backend and frontend files; map/preparation is delegated with the writer.
- Forecast: pending refinement by T1 writer; advisory only.
