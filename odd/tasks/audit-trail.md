# Audit trail (RF-27)

## Objective
Record who created, modified or annulled each record and when, in an append-only log that only the head secretary can read.

## Problem and why
RF-27 (Esencial): "Registrar la auditoría de las operaciones: quién creó, modificó o anuló cada registro y cuándo." RNF-08: "El historial y la auditoría no se pueden modificar." Today only payments and cash closes record an actor; members, disciplines, pricing and users record none.

## Scope
- In: an append-only audit store; `GET /api/audit`; entries for every successful write on members, disciplines, pricing, users, payments and cash closes; a read-only "Auditoría" screen.
- Out: logins, logouts and reads; startup repair and seed; backfilling existing records; retention rules; filters and export beyond a newest-first list.

## Decisions
- User, 2026-11-01: store changed field **names**, never values, so the log does not copy personal data.
- User, 2026-11-01: work directly on `manu`, with no new branches.
- Provisional, not confirmed by the club:
  - Only the head secretary reads the log (`audit:read`), the role that already holds annulment, cash close, users and configuration.
  - The actor is stored as id, name and role at that moment, because a user's name can change later.
  - The audit entry is written after the change. A separate file cannot share the change's atomic write, so a failed audit write is logged to the server console and does not undo the change or fail the request. A crash between the two writes can lose an entry.
- Existing `createdBy`, `annulledBy` and `closedBy` fields stay.

## Constraints
- Never store passwords, password hashes, session tokens, request bodies, or free text such as deactivation or annulment reasons and cash notes.
- Entity identity is an id or member number, not names or DNI.
- The store exposes append and read only: no update or delete in the repository, service or routes (RNF-08).
- Failed writes record nothing.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English. Synthetic data only.
- Do not change business rules.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`. Every behavior task records observed RED, GREEN, REFACTOR.

## Delivery
Strategy: `single-pr`, because the user wants all work on `manu`. Forecast about 1,200 authored lines across three work-unit commits on `manu`. Push and PR remain the user's decision. Service signatures change across several modules, so tell Joako before merging.

## Tasks
- [x] T1 — Audit module. Route: delegated direct writer (4+ files to read, 2+ non-trivial files).
  - `backend/src/modules/audit`: types, append-only repository on the JSON store (imitating cashcount), service with `record` and `list`, `GET /api/audit`, capability `audit:read` (head secretary), file path in `config/paths.ts`, wiring, route-matrix row, `tests/audit` in the backend test script.
  - Acceptance: entries have id, timestamp, actor snapshot, action, entity type, entity id and changed field names; list is newest first; no update or delete path exists; a corrupt store fails loudly; a secretary and a teacher get 403.
  - Design: services call `record({ actorId, action, entityType, entityId, changedFields })` on an injected `AuditRecorder`; the audit service snapshots name and role from the users repository (shared with `createApp` through the new `userRepository` option) and never rejects. `changedFields(before, after, ignore)` returns key names only.
  - Evidence: RED `vitest run tests/audit` -> 4 files failed, "Cannot find module '../../src/modules/audit/audit.service.js'" (and the repository module). GREEN: tests/audit 28 passed; full backend suite 873 passed (50 files); typecheck clean. REFACTOR: none needed.
- [x] T2 — Record every write. Route: same writer.
  - Routers pass the actor; services record after a successful change: members, disciplines, pricing, users, payments, cash closes.
  - Acceptance: each state-changing route in `route-matrix.test.ts` produces exactly one entry on success and none on failure; a failing audit write leaves the change in place and logs an error; a shared test fails if a write route has no audit coverage; no forbidden data appears in the store.
- [x] T3 — Frontend "Auditoría" section. Route: same writer.
  - `Capability` union, `sections.ts`, `App.tsx`, `frontend/src/features/audit`.
  - Acceptance: visible to the head secretary only; loading, error with retry, and empty states; newest-first table with date, user, role, action, record and changed fields; read-only.
- [x] T4 — Make audit failures visible (review finding `R4-corrupt-audit-store-silent-loss`). Route: delegated direct writer.
  - Business operations still succeed when an audit write fails (existing decision). The audit service now counts failed writes and keeps the time of the last one, in memory only: it holds no personal data and no error text, and it resets when the server restarts, so it says "since the last start", not "ever". The console log remains the record of older failures.
  - `GET /api/audit` now answers `{ entries, failedWrites: { count, lastFailedAt } }` (was a bare array). A corrupt or unreadable file still fails with 500, now with the code `audit_unreadable` and a fixed message that names no path.
  - The Auditoría screen shows a warning banner with the count and last time when writes failed, and a specific Spanish message for the unreadable log, distinct from the network error.
  - Evidence: RED backend `vitest run tests/audit` -> 6 failed, "throwing.failures is not a function" and the API tests expecting the new body; RED frontend `vitest run src/features/audit` -> 9 failed, "TypeError: entries.map is not a function" (the screen received the new body shape). GREEN: tests/audit 55 passed; frontend audit and routing tests 25 passed. REFACTOR: none needed.
- [ ] T5 — Readable records. Route: same writer.
  - Resolve display labels at read time only, through injected ports read once per request; stored entries keep the entity id and no personal data is added. Members show their member number, disciplines their name, users their name, payments their receipt number, cash closes their date; a tariff already carries its period as its id; singletons keep their fixed label. No member names or DNI. An unresolvable record falls back to a short readable form and never fails the list.

## Checks
- `pnpm --filter @club-socios/backend test`, `pnpm --filter @club-socios/backend typecheck`, `pnpm --filter @club-socios/frontend test`, `pnpm --filter @club-socios/frontend typecheck`.
- Browser check with synthetic data.

## Open items
- Owners: confirm the provisional decisions above, retention, and the legal basis for a staff activity log.

## Progress
- 2026-11-01: requirements and code mapped; this document created.
- 2026-11-01: T1 done (append-only audit module, `GET /api/audit`, `audit:read`).
- 2026-11-01: T2 done (every write route records its actor; coverage test over the route table).
- 2026-11-01: T3 done (read-only Auditoría screen, head secretary only).
- 2026-11-01: Gentle-AI review, high risk, consent granted per candidate. The whole range and T2 alone stopped with `lens_context_budget_exceeded`, so no T2 review exists yet. T1 `73da947` (lineage `review-5627f979070ab717`) and T3 `bd1e10c` (lineage `review-db0301859ca7df5f`) were reviewed in a temporary detached worktree: both approved and acknowledged. Their non-blocking findings are later work, notably `R4-corrupt-audit-store-silent-loss` and `R4-unbounded-audit-read`.
- 2026-11-01: browser check with synthetic data as `demo@club.test`: reactivating and deactivating member 0007 through the API produced two entries at `/auditoria` with the actor snapshot, and `backend/data/audit.json` held neither the reason nor the DNI. Records appear as a raw id. One frontend test failed once under load and passed alone and on a full rerun; not investigated.

- 2026-11-01: T2 `b2d138c`, chosen by the user: one independent read-only review of `backend/src` only, not a native review, so it has no receipt and its 22 test files were not reviewed. No blockers or warnings. Two suggestions for later: a user update or repeat deactivation, and an identical pricing replace, record an entry with nothing changed.

- 2026-11-01: T4 done (failed audit writes counted in memory and shown on the screen; unreadable log has its own message).

## Next step
The user decides on push and the PR from `manu` to `main`. Tell Joako first.
