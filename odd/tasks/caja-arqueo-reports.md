# Caja, Arqueo and Reports

Objective: Arqueo (head_secretary only) and read-only Reports (secretary and head_secretary) with role-specific navigation.
Branch: JoakoG. Delivery strategy: ask-on-risk. Test runner: vitest (frontend), backend package tests.

## Specs

- S1. Requirement RF-17: "Generar el arqueo diario: totales por medio de pago y por concepto, registrar el efectivo contado y calcular la diferencia." (Esencial)
- S2. Requirement RF-18: "Generar reportes de recaudación por período (diario, semanal, mensual) y por concepto, imprimibles y exportables." (Esencial)
- S3. Requirement RF-19: "Generar por disciplina el listado de socios al día y el monto recaudado para la liquidación a profesores." (Esencial)
- S3b. Owner: "solo nombre, número de socio y mes, sin DNI" — the per-discipline list (RF-19) shows member name, member number and month, never the DNI.
- S3c. PROVISIONAL, CONFIRM LATER: owner chose "A, como la planilla actual" for what "al día" means in RF-19: a member is listed for a month and discipline when a valid (not annulled) payment settles that discipline's activity fee for that month, even if the member owes earlier months. The alternative (B) was a member whose whole account is up to date. The owner asked to flag this so it is confirmed with the club later. Marked in the code as `PROVISIONAL(S3c)`. Surcharges are reported separately from the fee, never silently merged into the amount.
- S4. Requirement RNF-14: "Los reportes se exportan a PDF y Excel." Acceptance: "Todos los reportes exportables".
- S5. Requirement RNF-07: "Los datos contables solo los ven Secretaría, Tesorería y Administración (RN-12)." Acceptance: "100 % de las pantallas contables restringidas por rol".
- S6. Requirement RNF-08: "Los pagos no se eliminan, solo se anulan. El historial y la auditoría no se pueden modificar." A saved Arqueo close is never edited or deleted.
- S7. Owner: head_secretary sees "Caja" with two separate sub-sections, "Arqueo" and "Reportes"; secretary sees a standalone "Reportes" and never Caja or Arqueo. Secretary keeps Socios and Cobros. One Reports screen and one `reports:read` policy; Arqueo uses `cashcount:run` (head_secretary only).
- S8. Owner: "por el momento 1 por dia" — exactly one Arqueo close per club-local business date.
- S9. Owner: "se deberia poder guardar el cierre pero se debe especificar porque la diferencia si es posible" — the close is always saved, even with a nonzero variance; the reason is an optional note the UI asks for when the variance is not zero. Variance is computed server-side.
- S10. Owner: rentals (RF-16), Treasury accounts, teacher roster (RF-20) and expense reporting are out of this phase. Reports are payment-derived income only, behind a narrow report-data boundary so an expense source can be added later (no expense capture, endpoints, UI, or fabricated zero figures).
- S11. Informe CU-19: AS-IS covers a cash shortage "de bolsillo" and flags it as a risk; the system records the variance and never charges it to a person. Treasury also needs a weekly summary on Fridays (covered by the weekly period of S2).
- S12. Total counted cash is the required input; no denomination entry (RF-17 only needs the cash counted).

## Tasks

- T0. S1-S12. Inline. Freeze scope against the approved PDFs. Done (this document).
- T1. S2-S4, S10, S3b, S3c. Read-only Reports service (`backend/src/modules/reports/`). Inline. Done: RED observed (module missing), GREEN 19 new tests; backend suite 688 passed, typecheck clean. No HTTP route yet (T3). Exports are T5.
- T2. S1, S6, S8, S9, S11, S12. Arqueo domain and JSON persistence (`backend/src/modules/cashcount/`). Inline. Done: RED observed (module missing), GREEN 25 new tests; backend suite 713 passed, typecheck clean. Not wired into the app yet (T3). Assumption A1: a close is only for today (club-local); the caller cannot choose or backdate the date. Limitation: expected totals are read just before the write, so a payment taken in between is not in that close's snapshot.
- T3. S5, S7. Protected APIs and capability checks. Pending.
- T4a. S7. Navigation layout with groups (`navigationFor`, `Sidebar` groups); default layout stays flat. Inline. Done: RED observed (6 failing), GREEN 389 tests, typecheck clean.
- T4b. S7. Caja group, Arqueo and Reportes screens and routes. Pending.
- T5. S4. PDF and Excel export, tests, browser smoke. Pending.

## Log

- L1 (2026-10-26). User request: "puedes verificar el Plan Caja, Arqueo and Reports que esta en memoria y dime si esta apto para ejecutar"; then "comenza con T0".
- L2. Decision: "por el momento 1 por dia".
- L3. Decision: "se deberia poder guardar el cierre pero se debe especificar porque la diferencia si es posible".
- L4. T0 verification against docs/Modelo_Sistema_ClubOCEA.drawio.pdf and docs/Informe_Relevamiento_ClubOCEA.pdf: RF-17, RF-18, RF-19 are Esencial; RF-20 Deseable; RF-16 Opcional (priority read from the table order, because the PDF text layer detaches priorities from rows). Plan #1139 matches the PDFs.
- L5. Open point found: CU-20 AS-IS planilla lists "nombre, DNI y mes". Plan said to avoid DNI in the discipline report unless required. Needs owner decision before T1 builds RF-19.
- L5a. Decision: "solo nombre, número de socio y mes, sin DNI" (see S3b). L5 is resolved.
- L5b. Decision: "A, como la planilla actual pero marcalo o deja una bandera para luego confirmar que la opcion que estoy eligiendo ahora este bien" (see S3c).
- L6. Note for T2: RNF-08 means closes are append-only; the plan's "variance note" is set at close time and not editable afterwards.
