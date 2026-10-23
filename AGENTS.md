# Project instructions for club-socios

These instructions apply only to this repository. Read requirements before implementation conventions; do not import rules from another project.

## Required reading order

1. Before planning or changing behavior, read the relevant current sections of `docs/Modelo_Sistema_ClubOCEA.drawio.pdf` (functional requirements `RF` and nonfunctional requirements `RNF`) and `docs/Informe_Relevamiento_ClubOCEA.pdf` (research and current-process context). Identify applicable requirement IDs and verify which PDF revision is approved if a file has changed.
2. Distinguish approved requirements from optional/desirable scope and open questions in the PDFs. If either relevant PDF cannot be read, or a requirement is ambiguous, conflicts with another source, or depends on an unresolved decision, stop and ask the project owners. Do not invent a business rule.
3. Read `docs/AI-CODING-GUIDE.md` for file placement, naming, React/Express boundaries, tests, and delivery checks. Requirements decide **what** the system must do; the guide decides **how** to organize the implementation.
4. Inspect the owning feature/module and its tests before editing. Existing code shows current behavior but does not override an approved changed requirement.

When the PDFs change, re-read the current approved revision before relying on an earlier summary or AI memory. Keep this file short; maintain detailed conventions in the shared guide rather than duplicating them here.
