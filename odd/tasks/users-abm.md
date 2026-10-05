# Demo user management (ABM)

## Objective
Add a presentation-ready user administration flow that creates, lists, edits, and logically deactivates synthetic users stored in JSON, reusing the existing demo login records.

## Problem and rationale
The login is complete, but the backend currently imports its JSON seed as read-only in-memory data and the frontend has no user-management screen. A small file-backed repository and demo UI demonstrate the ABM without introducing a database. This is a presentation demo only; the routes are not production-protected and must not receive real or sensitive user data.

## Authorized scope and constraints
- Work only in this repository and current feature branch (`JoakoG`); no remote operations, push, or PR.
- Implement user ABM only. No member CRUD, database, production authorization/session infrastructure, or unrelated application features.
- Preserve the existing login behavior and the agreed fields: `id`, `name`, `email`, `passwordHash`, `role`, `active`.
- Persist mutable users in a backend-owned JSON file outside generated `dist`; seed it from the existing synthetic JSON on first use and ignore the mutable runtime copy in Git so builds do not overwrite or commit demonstration edits.
- Hash passwords server-side with the existing scrypt format. Never accept or return client-provided password hashes; never return stored hashes from APIs.
- Make email uniqueness case-insensitive. Implement delete as logical deactivation (`active=false`) so deactivated users remain auditable in the demo store and cannot sign in. Role is display metadata only; it does not grant permissions.
- TDD is ON by explicit user choice for this ABM. First add backend CRUD tests and observe RED, then implement the backend API/repository. Frontend gets typecheck/build plus a local manual flow; do not add a UI test framework for this presentation task.
- User explicitly asked for a resumable plan. After each work unit, record exact checks, files, commit, and next step in this document and its Engram mirror. If interrupted mid-unit, leave its status in progress and preserve current work; resume from this document before further edits.
- Delivery strategy: `ask-on-risk`; about 400 authored lines is only a planning heuristic, never a hard cap.

## Tasks
- [x] T1 — Build a persistent JSON user repository and safe Express CRUD endpoints with test-first development. Cover list/create/update/deactivate, input validation, case-insensitive duplicate emails, password hashing, safe response fields, persistence across repository reload, and deactivated-user login rejection. Route: delegated direct writer (backend repository/API/tests span multiple non-trivial files; preparation belongs with the writer). Acceptance: focused backend tests pass; existing login tests remain green; typecheck/build pass; mutable data initializes from the seed and is outside `dist`. **RED evidence gap:** this resumed session had no prior failing test output/log; the interrupted state already contained implementation code and tests, so a historical RED is not claimed. The first observed suite run here failed build on `import.meta` under CommonJS output; after fixing that, it exposed eager default-app initialization racing against the auth test import; both issues were corrected before green. Commit: the T1 work-unit commit containing this progress record (full SHA is in the delivery record). Runtime harness: `createApp()` initialized `backend/data/users.json`; path verified outside `backend/dist` and matched `.gitignore`; no long-lived service started. Rollback: revert this T1 commit's backend app/tests, `.gitignore` data entry, and T1 progress in this plan; existing login behavior and seed remain available.
- [ ] T2 — Add a user-management screen reachable after successful demo login, with list, create/edit forms, active status controls and logical deactivation; connect it to the users API and provide a way back to the login screen. Route: delegated direct writer (UI, service/API wiring, styles, and app flow are multiple non-trivial files). Acceptance: user can list/create/edit/deactivate synthetic users; forms validate and show loading/error/success states; password is entered only on create or optional reset and never displayed; frontend typecheck/build pass; user can manually smoke-test both login and ABM. Commit: pending. Runtime: pending. Rollback: revert only T2's frontend files and login-to-ABM navigation.

## Applicable checks
- `pnpm --filter @club-socios/backend test` (record RED and GREEN separately for T1).
- `pnpm --filter @club-socios/backend typecheck` and `pnpm --filter @club-socios/backend build`.
- `pnpm --filter @club-socios/frontend typecheck` and `pnpm --filter @club-socios/frontend build`.
- Structural readback: only synthetic records, password hashes only, mutable JSON outside generated `dist` and ignored by Git.
- Local API/UI smoke only if needed and explicitly coordinated; do not start additional long-lived development servers automatically. Existing services, if any, are not to be terminated without the user's request.
- `git status`, `git diff --check`, staged diff review, and exact commit identity for each work unit.

## Progress
- T1 completed on `JoakoG`. Files in the work unit: `.gitignore`, `backend/src/app.ts`, `backend/tests/auth.test.mjs`, `backend/tests/users.test.mjs`, and this plan. Backend store defaults to `backend/data/users.json`, initializes from the synthetic seed on first use, and is excluded from Git; tests use temporary stores and ephemeral HTTP servers. DELETE deactivates, PATCH can reactivate, and APIs omit hashes.
- Exact T1 checks: `pnpm --filter @club-socios/backend test` — PASS, 8 tests; `pnpm --filter @club-socios/backend typecheck` — PASS; `pnpm --filter @club-socios/backend build` — PASS; `git diff --check` — PASS. Git ignore/path check — `git check-ignore -v backend/data/users.json` matched `.gitignore:4`; initialized path existed at `backend/data/users.json`, with no `backend/dist/data/users.json`.
- RED record: historical RED before pre-existing implementation was not observable from this resumed checkpoint. Do not represent the failed initial build as test RED; it was a compile failure. The first full suite also exposed an eager initialization race and failed 5 tests; after the targeted fixes, the exact focused suite was green (8/8).
- Runtime: only ephemeral test servers were started by Node tests and closed by the tests; no development service was started or stopped. Presentation/demo only; the API routes are not production-protected.
- T1 commit identity: the single Conventional Commit containing this work unit (full SHA recorded in the delivery response). Next step after this work unit: implement T2 frontend user management; no frontend/T2 files were changed here.
- Exploration confirmed the backend currently imports `backend/src/database/demo-users.json` into memory and has no write path; login verifies scrypt hashes and returns safe fields only. Frontend `App.tsx` owns login state and currently has no router. Vite proxies `/auth` to port 3001; backend tests use Node's built-in test runner.
- User approved TDD for the ABM. T1 must demonstrate RED before backend implementation.
- Current branch is `JoakoG`; worktree was clean at planning start. Existing successful login commits are `e1a23a1`, `10b4c88`, with evidence update `a094e4f`.
- No development services were started for this task.
- Route: delegated direct. Trigger evidence: backend persistence/API/tests and frontend administration flow each span multiple non-trivial files; reading that prepares each write belongs to its writer.
- Forecast: pending writer refinement; about 400 authored lines is advisory only.
