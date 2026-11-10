# Socios redesign

Objective: rebuild the look of the whole Socios section (list, member record, forms) so the front-desk secretary finds a member fast, reads their state at a glance and acts from one place. Branch: manu. Runner: vitest (frontend). TDD: not configured; ordinary functional checks apply. Visual-only: no business rule, route or permission changes.

Requested by the user on 2026-11-10: "quiero que mejores visualmente toda la interfaz de socios, no me gusta cómo se ve". Requirements touched: RF-03 (search), RF-07 (account status visible), RNF usability. Nothing in the PDFs prescribes a layout.

## What is wrong today (seen in the browser at 1440 px)

- Member record: a narrow card on the left with label-left / value-far-right rows, and below it a face block that spans the full width with unstyled headings and a full-width error bar. The two blocks do not align and the right half of the screen is empty.
- List: five identical stat cards, a toolbar that wraps, a plain table. The row does not say whether the member owes, although the screen already loads that information (summary ids).
- Form: inputs in the older style, the "Paso 1 de 3" line is plain text, the card floats left.

## Design plan

Subject: the membership register ("padrón") of a provincial sports club, used all day at a front desk. The member's name is the thing people look for, so names carry the personality: Libre Baskerville (already the app's serif), everything else stays quiet.

- Colour (existing tokens only, no new palette): `--color-sidebar` #1f2937, `--color-accent` #1f4e8c, `--color-surface` #ffffff, `--color-bg` #eef1f4, status `--color-success` #2d7d5a, `--color-warning` #8a6a1c, `--color-error` #a8321f. Status colours are used only for status.
- Type: Libre Baskerville for member names and the record title; IBM Plex Sans for UI; IBM Plex Mono only for figures that are compared or copied (member number, DNI, dates, phone), with tabular numerals. Sentence case labels; no new all-caps eyebrows.
- Content column: max width about 1180 px, centred in the page area, same gutters as Arqueo / Gastos (`desk.css`).
- One bold element: the **padrón bar** (see list). Everything else is restrained: one card radius, hairline borders, no gradients, no decorative shadows.

### List

```
Socios                                              [ Alta de socio ]
+--------------------------------------------------------------------+
| 9 activos                                             1 inactivo   |
| [====== al día 4 ======][ deben 0 ][===== vencidos 5 =====]        |
|  Al día 4      Deudores 0      Vencidos 5         Inactivos 1      |
+--------------------------------------------------------------------+
[ Buscar por N.º, DNI, apellido o nombre...            ] [Buscar]
 Todos | Activos | Inactivos        Disciplina: [ Todas v ]
+--------------------------------------------------------------------+
| N.º   Socio                 DNI        Disciplinas       Cuenta    |
| 0005  Hugo Belmonte         99000005   Vóley             Al día    |
|       Vitalicia, 78 años                                           |
```

- Padrón bar: one panel instead of five cards. A proportional stacked bar splits the active members into al día / deudores / vencidos (widths from the summary counts; a zero group keeps a minimum sliver only if it is selected, otherwise it is omitted from the bar but stays in the legend). The legend items under it are the five existing filter buttons (same labels, same `aria-pressed`, same behaviour and tests); the bar segments are clickable too and mirror them. Loading and error states as today.
- Toolbar: the search field takes the row; filters sit on one line below; "Alta de socio" moves to the top right of the screen head.
- Table: new "Cuenta" column with a chip per active member (Al día / Debe / Vencido) taken from the summary ids already loaded (no new request); inactive members show "Inactivo" there and the old Estado column goes away. Disciplines as plain text, comma separated. Whole row clickable (the name stays a button for keyboard and tests). On phones the existing stacked-card pattern stays.

### Member record

```
< Volver al listado
+--------------------------------------------+ +----------------------+
| (AM)  Angel Mendoza            [Editar]    | | Cuenta               |
|       Socio N.º 0010  Infantil, 4 años     | | Al día / Debe 2 meses|
|       [Activo]                 [Dar de baja]| | [ Cobrar cuota ]     |
|--------------------------------------------| +----------------------+
| DNI            Nacimiento     Socio desde  | | Reconocimiento facial|
| 12345678       03/03/2022     10/11/2026   | | Sin cara registrada  |
| WhatsApp       Email          Disciplinas  | | [ Registrar cara ]   |
| 3884659832     Sin email      Básquet      | +----------------------+
|--------------------------------------------|
| Tutor: Lorena Mendoza, 3884605498          |
+--------------------------------------------+
```

- Two columns (about 1.7fr / 1fr), one column under 900 px. Left: identity header (monogram with initials, name in serif, number, category and age, status chip, actions) and the data as a 3-column definition grid (label above value), tutor and deactivation details as their own rows. Right: a "Cuenta" card and the face card.
- Cuenta card: reads the existing `GET /api/payments/members/:memberId/account` (only for users with `payments:read`; hidden otherwise; a failed read shows a short line and never blocks the record). Shows the standing in words and the unpaid months count, and the existing link to Cobros already searched for this member ("Cobrar cuota"). No amounts beyond what that endpoint already returns and Cobros already shows.
- Face card: same behaviour and texts as today, restyled as a card with the shared heading style; messages render inside the card.

### Forms (alta, edición)

- Centred column (max about 760 px). A real three-step indicator for the alta (current step named, done steps marked), fields in the `desk.css` field style (46 px, label above), section headings in sentence case, primary action on the right of the footer.

## Constraints

- No change to routes, API, permissions, validation or copy that tests rely on, unless the test is updated in the same commit for a visual reason. Keep every accessible name that exists today.
- New CSS in `frontend/src/styles/members.css` (imported in `main.tsx`); remove member rules that become dead from `global.css` and `member-stats.css` only when nothing else uses them.
- Keyboard focus visible, `prefers-reduced-motion` respected, phone width works.

## Tasks

- [x] T1: list (padrón bar, toolbar, table with Cuenta chip). Route: delegated (writer trigger).
- [x] T2: member record (two columns, Cuenta card, face card). Route: delegated (same writer).
- [x] T3: forms (stepper, fields, layout). Route: delegated (same writer).
- [ ] T4: browser review at 1440 and 375 px by the parent, with fixes.

## Log

- L1 (user, 2026-11-10): request quoted above, with a screenshot of the member record.
- L2 (T1, 2026-11-10, writer): list redesigned. `MemberStats` is now the padron bar: one card, headline Activos / Inactivos buttons, a proportional bar of al día / deudores / vencidos (flex-grow from the counts; an empty group is left out unless selected, then it keeps a 6 px sliver), and the three standing buttons as legend with swatches. Segments are `aria-hidden` spans that mirror the legend buttons, so accessible names do not collide (the legend stays the keyboard control; the other four button names are unchanged). `MembersToolbar` lost its create button (it moved to a head row in `MembersPage`, top right), search takes row 1 (46 px field, quiet "Buscar" button), the status radios and the discipline select share row 2. `MembersTable`: Estado column replaced by Cuenta (chip Al día / Debe / Vencido from the summary ids through `utils/member-standing.ts`, "Inactivo" for inactive members, empty cell when the counts are not loaded); the rest of the columns stay, including Socio desde (the wireframe omitted it; kept, less change). Styles: new `styles/members.css` (imported in `main.tsx` in place of `member-stats.css`, which was deleted because only `MemberStats` used its classes). Nothing was removed from `global.css`: `.members-toolbar*`, `.members-table`, `.segmented`, `.members-page*` are shared with Disciplinas and Cobros. New rules repeat a parent class (`.members-filters ...`, `.members-table.members-register ...`) to beat the bare `form input/button` rules of `app.css`. Decision where the brief was open: the segmented status filter shows its chosen option as accent border plus tint, not a solid fill, so the bar stays the only strong colour; "Buscar" is the secondary button style.
  - Tests touched (deliberate, from the brief): `MembersToolbar.test` (the create-button tests moved: the toolbar no longer owns it), `MembersPage.test` (added: Alta de socio hidden without `canCreate`), `MembersTable.test` (Estado -> Cuenta header; the Activo chip assertion became the Debe chip; new test for Al día / Vencido / empty cell), `MembersView.stats.test` (new: bar segments mirror the legend and the zero group rules; Cuenta chips in the list).
  - Verification: `pnpm typecheck` clean; `pnpm build` built in 6m 34s; `pnpm test` 920 of 921 passed; the one failure (`App.display.test`, EventSource not defined) happened while a second `vite build` hogged the CPU and passes alone (3/3), on a route this task does not touch. Not checked in a browser. Commit: see git log.
- L3 (T2, 2026-11-10, writer): member record in two columns. `MemberDetailScreen` wraps everything in `.member-record` (max 1180 px, centred) with a grid of about 1.7fr / 1fr, one column under 900 px, and a single column when the right side would be empty (inactive member, no capabilities). `MemberDetail` now renders two siblings, the back button (quiet text button with a CSS chevron, above the grid) and the sheet: monogram with initials, name in Libre Baskerville, "N° 0001" in mono beside "Categoría · edad", status chip, Editar / Dar de baja (outline) or Reactivar on the right, then a 3-column label-above-value grid (DNI, Fecha de nacimiento, Socio desde, WhatsApp in mono with tabular numerals), tutor and the deactivation details as their own rows. New `MemberAccountCard` ("Cuenta"): standing chip (Al día / Debe / Vencido, same words as the list; the account endpoint's `deregistered` standing is the summary's "overdue" group), unpaid months, and the existing link `/cobros?dni=<dni>` ("Cobrar cuota", primary when not al día). It is mounted only with the new `canReadPayments` prop (`payments:read`, wired in `App.tsx` and `MembersView`), only for active members, and a failed read shows one short line. It reuses `fetchAccount` from the payments service through a small hook (`useMemberAccountStanding`) instead of `useMemberAccount`, which also loads the payment history this card does not need. `FaceEnrollment`: same texts and behaviour; only two class names added so it shares the card heading style; its capture/confirm blocks (also `PublicEnrollmentFollow`) render as an inset panel inside the card through CSS scoped to `.member-card`.
  - Decisions where the brief was open: the member number moved from the facts grid to the header (as in the wireframe); the label "Fecha de nacimiento" stays (the wireframe shortened it, tests and accessible names use the long one); an inactive member shows no Cuenta card (no running account to act on); Dar de baja is an outlined red button so the record has no second loud button.
  - Tests touched: `MemberDetail.test` (the "N° de socio" fact became the header "N° 0001" assertion, deliberate from the wireframe); new `MemberDetailScreen.account.test` (6 tests: standing and months, al día, vencido, hidden without the capability and never reads the account, failed read keeps the record, inactive member). Everything else untouched and green.
  - Verification: `pnpm typecheck` clean; `pnpm test` 927 of 927 passed (98 files); `pnpm build` built in 5m 1s. Not checked in a browser. Commit: see git log.
- L4 (T3, 2026-11-10, writer): forms restyled. The alta, the edit form and the alta's last screen get the modifier `member-form-card--members` (centred column, max 760 px) and `MemberForm` / `EnrollmentPaymentStep` get `member-form--desk`; the modifiers scope the new rules because `member-form*`, `form-field` and `check-group` are shared with Disciplinas, Precios and Cobros, which stay as they were. Fields follow the `desk.css` style (label above in 12 px semibold, 46 px height, hairline border, accent focus ring; DNI, phone and dates in mono with tabular numerals), section legends are sentence case in the UI font instead of mono caps, and the footer has Cancelar on the left, Volver and the main action on the right (the main action is last in the DOM too, so tab order matches what is seen; on phones Cancelar and Volver share a row and the main action takes the next one). New `EnrollmentSteps` is the three-step indicator (numbered markers joined by a line, current step filled and named, finished steps with a drawn check; under 640 px only the current name shows). It is `aria-hidden`; the existing "Paso N de 3 · ..." text stays in the DOM as a visually hidden line so screen readers hear the step once and the tests keep their anchor.
  - Decisions where the brief was open: the invalid-field state is a red border on a white field (no pink fill); the chosen discipline chips get a faint accent tint; the confirmation dialogs (`MemberDialogs`) were left alone, they are not part of alta / edición.
  - Tests touched: none changed; added one in `EnrollmentScreen.test` (stepper markers move with the step) and one in `MemberForm.test` (footer order Cancelar, Volver, main action).
  - Verification: `pnpm typecheck` clean; `pnpm test` 928 of 929 on the full run, the one failure (`EntranceDisplay.test`, timing of a reset) happened while `vite build` shared the CPU and `src/features/access` passes alone (163/163); `pnpm build` built in 9m 27s. Not checked in a browser. Commit: see git log.

## Next step

T4: browser review at 1440 and 375 px, with fixes.
