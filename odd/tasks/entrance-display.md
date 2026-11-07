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
- [ ] T1 — Frontend test timeout. Route: delegated direct writer.
- [ ] T2 — Entry log backend. Route: same writer.
- [ ] T3 — Live greeting stream and public display. Route: same writer.
- [ ] T4 — "Ingresos del día" for staff. Route: same writer.

## Checks
- Backend tests with and without `TEST_DATABASE_URL`, frontend tests, and both typechecks.
- Browser check: the display in a second window updates when a check runs.

## Open items
- Owners: confirm the public texts, how long entries are kept, and who may read them.
- Backup of PostgreSQL data is still missing. It is tracked in `odd/tasks/face-recognition-demo.md`.

## Progress
- 2026-11-07: scope agreed with the user; this document created.
- 2026-11-07: T1 done (see task line for evidence).

## Next step
T2.
