# Debt notices (RF-21, first slice)

## Objective
Give the secretaries one screen that lists every member with debt and a ready-made WhatsApp message, sent one by one through a `wa.me` link, replacing today's manual messages from a personal phone.

## Problem and why
RF-21 (Esencial) is the only essential requirement with nothing implemented: "Enviar por WhatsApp avisos de deuda y de próximo vencimiento, en forma automática y masiva." The survey report records debt notices as manual messages from a secretary's personal phone. The Business API needs Meta verification, approved templates, per-message cost and internet, so this slice stops short of it and keeps sending behind an interface.

## Scope
- In: `GET /api/notices/debt`, computed in bulk; WhatsApp number derivation for Argentina; message text; a "Avisos" section with one send link per member.
- Out: "próximo vencimiento" notices (undefined, see open items), automatic or mass sending (future Business API adapter), RF-22 receipts, a log of sent notices.
- RF-21 stays **partial** after this slice.

## Decisions
- User, 2026-11-01: send through `wa.me` links, with sending behind an interface so an API adapter can follow.
- User, 2026-11-01: notify everyone with debt: active debtors and deregistered members, the latter identified in the list. Minors go to the guardian's contact. A number that cannot be derived is flagged for correction, not sent.
- Provisional, not confirmed by the club: the stated total is priced as of today, so it changes with the surcharge tier; the message says so. Inactive members get no notice.

## Constraints
- Requirements: RF-21, RNF-01 (member and cash management keep working without internet; the list is computed locally and only the link needs internet), RNF-09 (consent is not implemented; no new personal data is stored here).
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English.
- Synthetic data only. Do not change payment rules.
- Reuse the pure `owedConcepts`, `accountStanding` and `calculateCharge`; read members, memberships, payments and pricing once per request, never per member.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`. Every behavior task records observed RED, GREEN, REFACTOR.

## Delivery
Strategy: `ask-on-risk`. Forecast about 700 authored lines, two work-unit commits on `feat/debt-notices`, branched from `origin/main` at `045b932`. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Backend `notices` module. Route: delegated direct writer (2+ non-trivial files, 4+ files to read).
  - Pure WhatsApp number derivation, message builder, `NoticeSender` port with a `wa.me` link implementation, bulk service, `GET /api/notices/debt`, capability `notices:read` (secretary, head secretary), route-matrix row, and `tests/notices` added to the backend test script.
  - Evidence (route: delegated direct writer; triggers: 2+ non-trivial files, 4+ files read). RED: `npx vitest run tests/notices tests/authorization/route-matrix.test.ts` failed with "Cannot find module '../../src/modules/notices/notice.number.js'" (and the message/sender/service suites), and 4 API/route-matrix tests failed because `/api/notices/debt` was not mounted. GREEN: the same run passes; `pnpm --filter @club-socios/backend test` 46 files / 839 tests passed, `typecheck` clean. REFACTOR: none needed.
  - Minor rule: `isMinor(birthDate, asOf)` from the members validation (under 18) with a stored guardian sends to the guardian contact; an adult with a stored guardian, or a minor without one, goes to the member's own number. An unusable guardian contact is flagged, never replaced by the member's number.
  - Acceptance: up-to-date and inactive members excluded; debtor and deregistered members included with standing, unpaid months and today's total; a minor uses the guardian contact; an unusable number returns no link and a flag; files are read once per request.
- [ ] T2 — Frontend "Avisos" section. Route: same delegated writer.
  - `Capability` union, `sections.ts`, `App.tsx`, feature under `frontend/src/features/notices`.
  - Acceptance: section visible to secretary and head secretary, not to teacher; loading, error with retry, and empty states; deregistered members identified; each usable row opens the link in a new tab; an unusable number shows a correction notice and no link.

## Checks
- `pnpm --filter @club-socios/backend test`, `pnpm --filter @club-socios/backend typecheck`, `pnpm --filter @club-socios/frontend test`, `pnpm --filter @club-socios/frontend typecheck`.
- Browser check of the Avisos screen with synthetic members.

## Open items
- Owners: what "próximo vencimiento" means (day 10 is the last day without surcharge, but no source calls it a due date) and who receives it.
- Owners: confirm the provisional decisions above, and whether deregistered members should be told they must re-register.

## Progress
- 2026-11-01: requirements and code mapped; branch and this document created.
- 2026-11-01: T1 done (backend notices module, capability `notices:read`, route-matrix row).

## Next step
T2.
