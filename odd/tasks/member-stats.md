# Member stats (Socios counters)

Objective: show at the top of the Socios screen how many members are active, inactive, up to date, debtors and overdue, so the secretary sees the club's state at a glance. Branch: manu. Runner: vitest (backend and frontend). TDD: not configured for this project; ordinary functional checks apply.

Requirements: RF-07 (account status: al día / moroso, months owed), RF-26 (status updates on its own: moroso when a fee falls due, baja after 3 unpaid months), RF-05/06 (baja and reinscription). Requested by the user on 2026-11-09 ("un contador de socios activos, socios inactivos o de baja o socios que deben o se le vencieron").

## Definitions (from the current code, not new business rules)

| Card | Meaning | Source |
| --- | --- | --- |
| Activos | Members with `status: 'active'` | `member.types.ts` |
| Inactivos | Members with `status: 'inactive'` (manual baja, with deactivation date and reason) | `member.types.ts` |
| Al día | Active members with 0 unpaid months | `payments/account.ts` `accountStanding` = `up_to_date` |
| Deudores | Active members with 1 to 3 unpaid months | `accountStanding` = `debtor` |
| Vencidos | Active members with more than 3 unpaid months (baja por deuda) | `accountStanding` = `deregistered`, `standing.ts` threshold 3 |

Al día + Deudores + Vencidos = Activos. Standing is computed only for active members, the same way `notices/notice.service.ts` `debtNotices` does.

## Specs

- S1: `GET /api/members/summary`, capability `members:read` (secretary and head secretary), returns the five counts and, for the three standing groups, the member ids, computed in one pass per source (members, memberships, payments, pricing), reusing the standing logic of `debtNotices`. No names, DNI or amounts in the response.
- S2: The Socios list screen shows five stat cards above the toolbar, in the visual language of Arqueo / Gastos (`desk.css`: white cards, mono caption, IBM Plex Sans, numbers in IBM Plex Mono, status colours from `global.css` tokens: success, warning, error). Responsive: one row on desktop, a 2-column grid on phones.
- S3: Clicking a card filters the list to that group; clicking it again (or "Todos") clears it. Activos / Inactivos use the existing status filter; the three standing cards filter by the ids from S1. The active card is visibly selected and announced (`aria-pressed`).
- S4: Loading, error and empty states: the cards show a placeholder while loading, and a failed summary never hides the member list.
- S5: The counts refresh after creating, editing, deactivating or reactivating a member.

## Tasks

- [x] T1 (S1): backend summary endpoint, service function, route matrix entry, tests. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 (S2-S5): frontend stat cards, hook, service, filter wiring, tests. Route: delegated (same writer, after T1).

## Log

- L1 (user, 2026-11-09): plan approved; order is stats, audit, receipt PDF + email, public face enrollment screen.
- L2: club name fixed to "Club Atlético Independiente" before this feature (commit 4252f08).
- L3 (T1): `GET /api/members/summary` returns `{ active, inactive, upToDate, debtors, overdue, ids: { upToDate, debtors, overdue } }` (ids are member ids only). Built in `members/member-summary.service.ts` (ports: members, memberships, payments, pricing; one read each), mounted in `app.ts` as `memberSummaryService` at `/api/members/summary` before the members router. The standing is the new `memberStanding` helper in `payments/account.ts` (`accountStanding(owedConcepts(...))`), the same derivation `debtNotices` uses. Verification: `cd backend && pnpm test`: build ok, node --test 20 passed, vitest 80 files / 1256 tests passed, database suites skipped (no TEST_DATABASE_URL). Commit: 74c2dd5.
- L4 (T2): `MemberStats` (presentational, five `aria-pressed` buttons, `styles/member-stats.css`), `useMembersSummary` and `fetchMembersSummary`. `MembersView` owns the summary and the standing filter, and refreshes the counts when the list comes back from the detail or form (covers create, edit, deactivate, reactivate). Activos / Inactivos drive the status filter; Al día / Deudores / Vencidos filter the loaded list by the ids, and a second click clears. A failed summary shows an inline message and keeps the list. Verification: `cd frontend && pnpm test`: 86 files / 815 tests passed (new `MembersView.stats.test.tsx`, 6 tests); `pnpm typecheck` (tsc --noEmit): no errors; `pnpm build`: built in 4m 22s (chunk-size warning pre-existing). Commit: 37c14d6. Not checked visually in a browser.

## Next step

Both tasks done; the user may review the screen in the browser (not visually checked here) and push when ready.
