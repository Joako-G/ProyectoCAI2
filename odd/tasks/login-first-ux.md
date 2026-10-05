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
- [x] T1 — Make login the initial route/view and gate both Socios and Usuarios behind successful login; after success open Socios. Add focused Vitest coverage for initial login, failed login, successful login and protected content. Route: delegated direct writer. Acceptance verified: initial login/no protected requests, rejected login remains on login, successful login opens Socios, and existing member rendering remains intact. TDD RED: focused Vitest run failed all 4 tests before App edits (existing Socios rendered immediately; login form unavailable). GREEN: focused Vitest 4/4, frontend suite 12 files/121 tests, typecheck passed, build passed, `git diff --check` passed. Runtime harness: N/A; no browser smoke because no services were started. Commit: `7be4f8b` (`feat(auth): require login before app views`). Rollback: revert `7be4f8b`; it changes App state and tests without changing backend behavior.
- [x] T2 — Place Usuarios beside Socios in the shared sidebar/AppShell, render user administration in the same panel, and translate all login/users UI copy to neutral Spanish. RED: before source changes, `pnpm --filter @club-socios/frontend exec vitest run src/App.test.tsx src/layouts/AppShell.test.tsx` failed 6 tests (6 failed, 6 passed): Spanish login selectors/headline were absent and AppShell lacked Usuarios/current-section support. GREEN: focused tests 12/12; `pnpm --filter @club-socios/frontend test` 12 files/123 tests passed; typecheck passed; production build passed (49 modules, Vite build 2m50s); backend tests passed (10 Node tests + 6 Vitest files/127 tests); `git diff --check` passed. Tests cover shared shell and both nav current states, switching both ways, Spanish login/user labels, role labels, list actions, form editing and current signed-in account protection. `frontend/index.html` was already `lang="es"`; no change needed. Changed files: `frontend/src/App.tsx`, `frontend/src/App.test.tsx`, `frontend/src/layouts/AppShell.tsx`, `frontend/src/layouts/AppShell.test.tsx`, `frontend/src/layouts/Sidebar.tsx`, this task plan. No backend/API changes; API role values remain unchanged and only display labels are translated. No browser smoke test; no long-lived services started or stopped. Commit: pending work-unit commit. Rollback: revert T2 changes to the six listed files, preserving T1 commit `7be4f8b` and existing member/backend behaviors.

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
- T1 is complete on commit `7be4f8b`; T2 is in progress. The 400-line planning heuristic is advisory only.
- TDD RED recorded before source edits: `pnpm --filter @club-socios/frontend exec vitest run src/App.test.tsx` failed all 4 tests: initial-login assertion observed existing Socios, while login scenarios could not find the login form.
- T1 implementation is complete: memory-only default `welcome`, successful login routes to `members`, Members renders only for authenticated state, and the Users loading effect requires successful auth. Login POST contract and Users CRUD/current-account safeguards are unchanged. This client-side UI gate is not server-side security.
- GREEN: focused App test 4/4; `pnpm --filter @club-socios/frontend test` 12 files/121 tests passed; `pnpm --filter @club-socios/frontend typecheck` passed; `pnpm --filter @club-socios/frontend build` passed; `git diff --check` passed. One initial build invocation timed out at 120s while Vite was transforming; rerun with 300s completed in 2m29s. No services started/stopped.
- T2 shared navigation uses in-app state-driven links and `aria-current="page"`; it does not reload the browser. Users is rendered as the AppShell page content and retains the existing `/users` methods and current-account UI protection. User-facing login/users messages, controls, statuses, roles, accessibility labels, and demo disclaimers are Spanish. No API/backend or member behavior changes were made.
