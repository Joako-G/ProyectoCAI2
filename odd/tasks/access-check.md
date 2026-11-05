# Access check by DNI (RF-08)

## Objective
At the entrance, staff type a member's DNI and see at once whether the member may enter: green, yellow or red.

## Problem and why
RF-08 (Deseable): "Verificar por DNI si un socio está habilitado (al día) para ingresar (control de acceso básico)." The survey report links it to replacing the physical membership card: phase 1 is this basic check, phase 2 is biometrics. Today staff can only find out by opening Cobros.

## Scope
- In:
  - `POST /api/access/check` with `{ dni }` in the body, so the DNI never travels in a URL.
  - The capability `access:check` for secretary and head secretary.
  - A fast "Ingreso" screen: one DNI field, focused and ready for the next entry, and a large colored result.
- Out:
  - A log of entries.
  - Biometrics.
  - Turnstiles or other hardware.
  - Per-discipline schedules.

## Decisions
- User, 2026-11-05:
  - Green: the member is up to date and enters.
  - Yellow: the member owes 1 to 3 months, enters, and staff see the debt.
  - Red: the member is deregistered, inactive, or the DNI is unknown, and does not enter.
- Provisional, not confirmed by the club:
  - Only secretaries and the head secretary use it, because there is no doorkeeper role.
  - A check stores nothing, so it is not audited.
  - The result shows the member's name, member number and unpaid months, and no amounts. An unknown DNI shows only "no registrado".

## Constraints
- Reuse the existing standing rules (`owedConcepts`, `accountStanding`) and the member DNI lookup. Do not duplicate or change payment rules.
- Read stores once per check.
- The DNI must not appear in logs, URLs or error messages.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English. Synthetic data only.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`. Every behavior task records observed RED, GREEN, REFACTOR.

## Delivery
Work on `manu` (user preference). Forecast is about 500 authored lines in two work-unit commits. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Backend access check. Route: delegated direct writer.
  - `backend/src/modules/access`, `POST /api/access/check`, `access:check`, wiring, route-matrix row, and the audit coverage list updated to treat this route as read-only. Add `tests/access` to the backend test script.
  - Acceptance:
    - The result is green, yellow or red with a reason code.
    - Each of these cases is tested: up to date, 1 month owed, 3 months owed, deregistered, inactive, unknown DNI, and invalid input.
    - A teacher gets 403.
    - No DNI appears in responses for an unknown member or in logs.
- [ ] T2 — Frontend "Ingreso" section. Route: same writer.
  - Acceptance:
    - Visible to secretary and head secretary.
    - The DNI field is focused, Enter checks, and the field clears and refocuses for the next person.
    - Large green, yellow or red result that carries text as well as color.
    - Loading and error states.

## Checks
- `pnpm --filter @club-socios/backend test`, `pnpm --filter @club-socios/backend typecheck`, `pnpm --filter @club-socios/frontend test`, `pnpm --filter @club-socios/frontend typecheck`.
- Browser check with synthetic members.

## Open items
- Owners: whether a doorkeeper role or a log of entries is wanted, and question 1 of the pending list (a deregistered member who pays).

## Progress
- 2026-11-05: rule decided with the user; this document created.
- 2026-11-05: T1 done. RED: `tests/access` failed (the access module did not exist; `POST /api/access/check` answered 404 instead of 400) and `permissions.test.ts` failed (`permissions[capability] is not iterable` for `access:check`). GREEN: `pnpm --filter @club-socios/backend test` 58 files, 978 tests passed; backend typecheck clean. REFACTOR: `earliestTariffPeriod` moved to `payments/pricing.ts` and reused by payments, notices and access. The member lookup scans `members.list()` once per check (no DNI index exists); acceptable at club size.

## Next step
T2.
