# Login-first navigation and Spanish users UX

## Objective
Require a successful demo login before rendering Socios or Usuarios, show both sections in the shared sidebar, and present login/users UI copy in Spanish consistent with the Socios screen.

## Problem and rationale
After the Users and Members ABMs were combined, a fresh visit renders Socios without login and the Users flow is reached from a separate English-language screen. The presentation should begin at the login, then expose Socios and Usuarios in one shared application shell with coherent Spanish copy.

## Authorized scope and constraints
- Work only in this repository on `JoakoG`; no remote actions, push or PR.
- Keep both Socios and Usuarios behavior. Preserve the existing member screens, user CRUD operations, login error handling, and protection against deactivating the current demo account.
- A fresh page load or refresh must render the login. After a successful demo login, render Socios by default; sidebar navigation switches between Socios and Usuarios. Login state remains client-memory only; do not claim this UI gate is server-side security or add production session/auth infrastructure.
- Translate user-visible login/users/navigation text and set document language to Spanish; keep identifiers and API values (including `member`/`admin`) unchanged. Display role values with Spanish labels.
- TDD is ON by explicit user choice for the ABM. The merged workspace now has Vitest/Testing Library; add/update frontend tests first for the login-first and sidebar behavior, observe RED, then implement. Do not add another test framework.
- User requested step-by-step progress. Keep this plan and its full Engram mirror current before source edits and after each work unit. If interrupted, preserve the in-progress task and current diff; resume by reconciling this file and `odd/login-first-ux/tasks` before continuing.
- No long-lived services should be started or stopped without explicit user authorization. Delivery strategy `ask-on-risk`; 400 authored lines is advisory, not a cap.

## Tasks
- [x] T1 — Make login the initial route/view and gate both Socios and Usuarios behind successful login; after success open Socios. Add focused Vitest coverage for initial login, failed login, successful login and protected content. Route: direct writer. Acceptance verified: initial login/no protected requests, rejected login remains on login, successful login opens Socios, and existing member rendering remains intact. TDD RED: focused Vitest run failed all 4 tests before App edits (existing Socios rendered immediately; login form unavailable). GREEN: focused Vitest 4/4, frontend suite 12 files/121 tests, typecheck passed, build passed, `git diff --check` passed. Runtime harness: N/A; no browser smoke because no services were started. Commit: this task's Conventional Commit. Rollback: revert T1's App state and tests without changing backend behavior.
- [ ] T2 — Place Usuarios beside Socios in the shared sidebar/AppShell, render the user-management screen within that shell, and translate login/users UI plus document language to Spanish. Add/update tests for active navigation, section switching, Spanish copy and preserved user actions. Route: delegated direct writer (AppShell, Sidebar, App and tests/UI language span multiple non-trivial files). Acceptance: both sections are reachable after login using the shared layout; Usuarios navigation is visible and marks the active section; user create/edit/deactivate/reactivate behavior remains; all user-facing login/users messages and native document language are Spanish; frontend tests/typecheck/build pass. Commit: pending. Rollback: revert only T2 shell/navigation/copy/tests, preserving T1 login gate and existing ABMs.

## Applicable checks
- `pnpm --filter @club-socios/frontend test` (record TDD RED/GREEN for T1 and T2).
- `pnpm --filter @club-socios/frontend typecheck`.
- `pnpm --filter @club-socios/frontend build`.
- `pnpm --filter @club-socios/backend test` to guard existing auth/users/member APIs if any API or shared contract changes.
- `git status`, `git diff --check`, staged diff review, and commit identity per work unit.
- No browser smoke is claimed unless the user performs it or explicitly authorizes starting the required services.

## Progress
- Merge is committed as `4b51c90` on `JoakoG`; the worktree was clean before this task. Both ABMs and their tests are present.
- Mapping confirmed `frontend/src/App.tsx` starts at Socios; the login/users view uses English copy and bypasses AppShell; `Sidebar.tsx` only exposes Socios. User APIs have no server session, so the access gate is demonstrative/client-only.
- User explicitly requires login first, Usuarios in the lateral menu, UX aligned with Socios, Spanish user messages, and step-by-step resumability.
- Effective TDD is ON from the user's earlier explicit ABM choice; the merged Vitest frontend test runner is available.
- No services started or stopped during exploration.
- Route: delegated direct. Trigger evidence: coordinating App state, shell/navigation, multiple UI tests and language changes spans 4+ non-trivial files; broad mapping was delegated before planning.
- T1 is complete; T2 remains pending. The 400-line planning heuristic is advisory only.
- TDD RED recorded before source edits: `pnpm --filter @club-socios/frontend exec vitest run src/App.test.tsx` failed all 4 tests: initial-login assertion observed existing Socios, while login scenarios could not find the login form.
- T1 implementation is complete: memory-only default `welcome`, successful login routes to `members`, Members renders only for authenticated state, and the Users loading effect requires successful auth. Login POST contract and Users CRUD/current-account safeguards are unchanged. This client-side UI gate is not server-side security.
- GREEN: focused App test 4/4; `pnpm --filter @club-socios/frontend test` 12 files/121 tests passed; `pnpm --filter @club-socios/frontend typecheck` passed; `pnpm --filter @club-socios/frontend build` passed; `git diff --check` passed. One initial build invocation timed out at 120s while Vite was transforming; rerun with 300s completed in 2m29s. No services started/stopped.
