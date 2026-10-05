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
- TDD is ON for this feature by explicit user choice. T1 established the backend test runner with Node's built-in test runner and observed RED before implementation. Frontend behavior receives build/typecheck and a local manual smoke check unless a suitable existing UI test setup is found.
- Delivery strategy: `ask-on-risk`; forecast roughly 300–400 authored lines as an advisory estimate, not a limit.

## Tasks
- [x] T1 — Add backend demo-user JSON data, login behavior, and focused tests using test-first development; use Node's built-in test runner with no additional test-runner dependency. Acceptance met: active synthetic credentials authenticate; bad credentials and inactive accounts receive the same 401; response contains only id/name/email/role; JSON contains scrypt hashes and no plaintext password. Evidence: TDD RED — 3 auth tests returned 404 before route implementation; GREEN — `pnpm --filter @club-socios/backend test` passed 4 tests; backend typecheck/build passed; parent reran backend tests (4/4). Independent verifier flagged the inactive account test, but direct `scryptSync('DemoPass123!', '55fda820963b0814407e300518300961', 64)` recomputation exactly matched the stored hash; the test submits this valid password and would receive 200 if the active check were removed, so the finding was not reproducible and no correction was needed. Commit: `e1a23a11de49bcd5789d47ef6a53fd11c7b9f379`. Runtime: Express HTTP tests used an ephemeral localhost port for valid, invalid-password, inactive, and response-shape cases. Rollback: revert T1 commit `e1a23a11de49bcd5789d47ef6a53fd11c7b9f379` to remove backend demo-auth behavior/data/tests/config and T1 evidence.
- [x] T2 — Add the login screen and connect it to the backend login API, using the supplied palette. Route: delegated direct writer (feature UI, service/API wiring, and styles span multiple non-trivial files). Acceptance met: accessible email/password form with pending/error/success states, responsive dark navy/blue/gold/cream/pale-gray styling; frontend calls the backend via Vite proxy at port 3001; successful login clears the password and shows safe welcome text, while failures show a generic message. Evidence: `pnpm --filter @club-socios/frontend typecheck` — PASS; `pnpm --filter @club-socios/frontend build` — PASS (29 modules; 2m26s); user-provided browser screenshots show valid login success and invalid-credential error from the local app. Commit: pending. Runtime: local UI flow tested by user at `http://localhost:5173` against backend `http://localhost:3001`; both success and failure states shown. Rollback: remove `frontend/src/app.css` and revert T2 changes to `frontend/src/App.tsx`, `frontend/vite.config.ts`, and this task evidence.

## Applicable checks
- `pnpm --filter @club-socios/backend test`.
- `pnpm -r typecheck`.
- `pnpm -r build`.
- Local backend/frontend smoke check of valid and invalid demo login; do not use real credentials or personal data.
- Structural readback of JSON seed data, ensuring only synthetic records and no plaintext password.
- `git status`, `git diff`, and commit identity readback for each work unit.

## Progress
- Exploration confirmed the scaffold has only `GET /health`, no auth route, no frontend API proxy, and no test runner. The supplied image is the visual reference. The parent `Documentacion/` requirements source is not available in this checkout; this demo is limited to the scope above.
- TDD evidence: `pnpm --filter @club-socios/backend test` initially ran three HTTP auth tests and observed RED (all three returned 404; expected 200/401). After implementation, all four tests pass (3 auth behavior checks plus JSON/hash safety). Node's built-in test runner is sufficient, so no new dependency was needed.
- T1 verification: `pnpm --filter @club-socios/backend test` — PASS, 4 tests; `pnpm --filter @club-socios/backend typecheck` — PASS; `pnpm --filter @club-socios/backend build` — PASS. HTTP integration tests start the Express app on an ephemeral localhost port and verify success, invalid-password rejection, inactive-user rejection, and safe response shape.
- Seed structural check confirms two synthetic `.test` users with all six required fields, scrypt hashes and no plaintext credentials.
- Current branch is `JoakoG`; initial worktree was clean.
- Route: delegated direct. Trigger evidence: implementation spans multiple non-trivial backend and frontend files; map/preparation is delegated with the writer.
- T1 authored change: 163 lines including tests and plan; forecast remains advisory only.
- The user reported successful local browser validation: valid synthetic credentials display the welcome state; invalid credentials display the generic error state. Two Vite servers were found responding on ports 5173 and 5174 (one backend on 3001); no additional servers were started during this validation.
- T2 authored change is 149 additions and 10 deletions including the new 56-line stylesheet and task evidence; the 400-line advisory is not exceeded.
- RDD is globally disabled; no native review transaction will be started.
