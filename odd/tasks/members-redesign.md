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

- [ ] T1: list (padrón bar, toolbar, table with Cuenta chip). Route: delegated (writer trigger).
- [ ] T2: member record (two columns, Cuenta card, face card). Route: delegated (same writer).
- [ ] T3: forms (stepper, fields, layout). Route: delegated (same writer).
- [ ] T4: browser review at 1440 and 375 px by the parent, with fixes.

## Log

- L1 (user, 2026-11-10): request quoted above, with a screenshot of the member record.

## Next step

T1.
