# Add the reviewed handoff to your Engram

The shareable source of context is [the team handoff](../docs/team-handoff.md), not a native Engram export. From the clone root in PowerShell, after reviewing that file, run:

```powershell
engram save 'Club-socios reviewed team handoff' (Get-Content -LiteralPath '.\docs\team-handoff.md' -Raw -Encoding UTF8) --type decision --project club-socios --scope project
```

The parenthesized `Get-Content -Raw` expression passes the entire multiline file as **one** content argument. This manually saves one project-scoped observation to your own machine's Engram database; cloning does not sync or import memories automatically. Run it once per machine, and review any later changes before saving them again. No native manifest or compressed chunks are included because the attempted export contained local account and filesystem metadata.
