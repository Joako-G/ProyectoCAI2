# Flaky tests

## Objective
Tests that fail and pass without any code change are fixed at their cause, so a red run always means something. No retry-until-green, no blanket timeout increases.

## Problem and why
During the work of the last two weeks the same tests failed once and passed on the next run. A test that fails at random teaches people to ignore a real failure, and it blocked a push (part 4) until it was rerun. Observed so far:

| Where | Test | Symptom |
| --- | --- | --- |
| backend | `tests/audit/audit.api.test.ts` and `audit.coverage` | `fetch failed: bad port` (twice) |
| backend | `tests/access/access.api.test.ts` | every test in the file failed once (19), then passed on 4 reruns |
| backend | `tests/reports/report.api.test.ts` > discipline settlement > "answers 404 for an unknown discipline and 400 for a bad month or a missing discipline" | failed once |
| backend | `tests/payments/payment.api.test.ts` > "prices a new member from the chosen disciplines alone and 400s on a bad list" | failed once, passed 3 of 3 alone |
| frontend | `App.navigation.test.tsx`, several tests ("shows the head secretary the three sections...", "shows a teacher only Mis disciplinas...", the teacher roster) | cannot find a heading, or time out, under load |
| frontend | many files | `Test timed out in 5000ms` (already fixed by the 20 s `testTimeout`) |

## Root cause found for the backend ones
- `fetch` (undici) refuses a fixed list of "bad ports" (WHATWG Fetch spec: 1, 7, 9, ... 4045, 5060, 6000, 6566, 6665-6669, 10080, and others).
- The tests start an HTTP server with `listen(0)`, so the OS picks the port, and then call it with `fetch`.
- On this PC the Windows dynamic TCP range is **1024 to 15000** (`netsh int ipv4 show dynamicport tcp`), not the usual 49152 to 65535. Sampling 3,000 `listen(0)` ports gave **3 on the block list** (about 0.1% per server). With about 20 test files starting servers in `beforeAll` or `beforeEach`, an occasional red run is expected.
- It matches the symptoms: a `beforeAll` server on a bad port fails every test in the file (the 19 failures in `access.api.test.ts`), and a `beforeEach` server fails exactly one test (the single failures in payments and reports).

## Hypothesis for the frontend ones (to confirm with evidence)
Tests that render the whole app and wait with the default Testing Library async timeout (1 s) fail when the machine is busy. They must be reproduced under CPU load and fixed at the cause, without hiding real failures.

## Scope
- In: the test infrastructure and the tests listed above.
- Out: product code, unless a test exposes a real bug.

## Decisions
- User, 2026-11-08: fix the flaky tests at their cause instead of rerunning until they pass.
- No retries of whole tests, no raising timeouts without evidence of why, no skipping.
- Work on `manu` (user preference). Nothing is pushed until the pending pull request of part 5 is merged, because new commits on `manu` would join it.

## Constraints
- Conventions: `docs/AI-CODING-GUIDE.md`. Identifiers and comments in English.
- A guard test must stop the cause from coming back.

## TDD
Mode: ON. Runner: Vitest through `pnpm --filter <package> test`.

## Delivery
One work-unit commit per task, on `manu`.

## Tasks
- [x] T1 — Backend: start test servers on a port that `fetch` accepts.
  - One shared helper that listens on port 0 and, if the port is on the block list, closes and tries again (bounded).
  - Replace every raw `listen(0)` in the tests.
  - A guard test fails if a test file uses a raw `listen(0)` again.
  - Acceptance: a deterministic test of the helper with a fake that returns blocked ports first, and a stress run that starts and calls thousands of servers through the helper without one failure.
- [x] T2 — Frontend: reproduce and fix the `App.navigation.test.tsx` failures.
  - Reproduce under CPU load, record the exact failure text, and fix the cause.
  - Acceptance: repeated runs under load with no failure.
- [ ] T3 — Proof. Run the backend and frontend suites repeatedly and record the results in this document.

## Checks
- Backend and frontend tests and typechecks. Repeated runs for the proof.

## Open items
- Other flaky tests that appear later should be added to the table above.

## Progress
- 2026-11-08: the backend root cause was found. The dynamic port range of this PC is 1024 to 15000 and 3 of 3,000 sampled ports are on the fetch block list.
- 2026-11-08 (T1): added `backend/tests/helpers/listen.mjs` (typed by `listen.d.mts`; plain JS so `node --test` files can use it too). `listenOnFetchSafePort(app)` listens on port 0, closes and retries (50 attempts max) when the port is on the fetch block list, then throws a clear error. All 20 test files that used `listen(0)` now use it; `tests/helpers/no-raw-listen.test.ts` fails with the list of offenders if a raw `listen(0` comes back (RED observed first: 20 offenders). `tests/helpers/listen.test.ts` covers the retry with a fake server (RED first: helper missing), the bound and the error, and starts 500 real servers and calls each with `fetch`.
  - Block list verified against this Node (v22.15.1, undici): probed `fetch` against every port 1-65535 on 127.0.0.1; it refuses exactly 82 ports, identical to the list in the helper (no extras, none missing).
  - Stress (3 runs x 3,000 servers held in batches of 500): raw `listen(0)` landed on the block list **4, 1 and 4 times** (ports 2049, 3659, 4045, 4190 / 10080 / 1719, 1720, 1723, 2049); through the helper **0, 0 and 0** of 3,000.
  - No `listen(0` exists in `backend/src` or `scripts`; `src/server.ts` listens on the configured port and was not touched.
  - Evidence per route: direct inline was not used; one writer did the whole task (trigger: 20 non-trivial test files).
  - Backend run after T1: `node --test` suites pass; Vitest non-database part 72 files / 1183 tests pass. The database suites could not run because Docker Desktop was not running (ECONNREFUSED 127.0.0.1:5432); they do not use the helper.
- 2026-11-08 (T2): reproduced and fixed. Load: 16 busy node loops on 12 logical cores while running `pnpm exec vitest run src/App.navigation.test.tsx src/App.routing.test.tsx` (26 tests). Unloaded baseline: 26 passed. **Before the fix, 4 of 8 loaded runs failed** (one test each), with two different causes:
  - Cause 1, a real race in the test (2 runs): `shows a teacher only Mis disciplinas...` failed after 121-126 ms with `expected "vi.fn()" to be called with arguments: [ '/api/roster', Anything ]` (the only call so far was `/auth/me`). The h1 "Mis disciplinas" is drawn by the shell, so it can be found before `RosterView`'s effect has requested the data; the test asserted the call synchronously. Fix: `await waitFor(...)` on the call. No product change.
  - Cause 2, Testing Library's 1 s `asyncUtilTimeout` (2 runs): `shows the head secretary the three sections...` failed with `Unable to find role="heading" and name "Socios"` after 1.2 s and 2.1 s; the DOM dump shows the shell still on `/` with the title "Club Independiente", i.e. the redirect to Socios and the first render of the app had not finished in 1 s under load (not a missing route or a lazy load: every screen is imported statically). Fix: `configure({ asyncUtilTimeout: 5000 })` once in `frontend/src/test/setup.ts` (`ASYNC_UTIL_TIMEOUT_MS`), 5x the default, still far below the 20 s `testTimeout`, which is not changed. Regression test: `src/test/setup.test.ts` asserts the configured value (RED first: it was 1000).
  - **After the fix, 0 of 10 loaded runs failed** (27 tests each, 17-25 s per run). Raw outputs of both series were kept under the scratchpad temp dir (`t2/load-N.log`, `t2/after-N.log`).
  - Frontend full suite after T2: 73 files, 734 tests passed (1 m 36 s); typecheck clean.

## Next step
T3.
