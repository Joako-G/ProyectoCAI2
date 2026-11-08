# Backup and restore

The backend copies every data file, and the PostgreSQL database when `DATABASE_URL` is set, once a day while it is running (RNF-03). Each copy is a folder named `backup-YYYYMMDDTHHMMSSZ` (the time is UTC, three hours ahead of Tucumán) inside the backup folder. Old copies are cleaned up after each copy: for each of the last 30 days that have copies, the newest copy with a good database part is kept (the newest copy of the day if none has one; days counted in Tucumán time), the newest copy with a good database part is always kept whatever its age, and the 5 most recent copies are always kept, so several copies on one day never push out older days and a run of failed dumps never removes the last restorable database. A copy has a good database part when the dump is in it or the database is not configured. Folders that are not copies, or whose name is not a real date, are never touched.

## Where the copies are

- By default: `backend/backups`. This folder is on the same computer as the data, so it does not protect against a broken disk or a stolen computer. The Respaldo screen says so.
- On an external drive: set the `BACKUP_DIR` environment variable to a folder on the drive before starting the backend, for example `E:\respaldos-club` on Windows. Plug the drive in before starting the backend. The backend never creates the `BACKUP_DIR` folder: if the drive or the folder is missing, the copy fails (code `DESTINATION_MISSING`), nothing is written, older copies are untouched, and the Respaldo screen tells staff to connect the external drive or check the folder. If the folder exists but cannot be read, the screen says so instead of showing "no copies". The next hourly check copies again once the drive is back. With the default folder, the backend creates it itself.

Each copy folder holds `manifest.json` (the time, the list of files and the `database` part), `database.dump` (the PostgreSQL dump, when the database is configured) and one file per data file: `members.json`, `disciplines.json`, `memberships.json`, `pricing-config.json`, `payments.json`, `audit.json`, `cashcounts.json`, `users.json` and the two `*.seed.json` files. A file that does not exist yet (for example `cashcounts.json` before the first cash close) is simply not in the copy.

Copies contain personal data. `database.dump` also holds the biometric face descriptors and the entrance log, so it is as sensitive as the database itself. Keep the drive in a safe place and protect it (see "Protect the external drive").

## The database dump

When `DATABASE_URL` is set, each copy also runs `pg_dump` in custom format (`-Fc`: compressed, restored with `pg_restore`) and saves it as `database.dump` in the same dated folder, so one folder is one complete, restorable copy. It covers every table, with no list to maintain. Without `DATABASE_URL` the database part is "not configured" and nothing else changes.

How the backend finds `pg_dump`, in this order (this PC has no `pg_dump` installed; the database runs in Docker):

1. `PG_DUMP_COMMAND`, if set: the command to run, as a JSON array (`["C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe","-Fc","-w"]`) or plain text split on spaces (`pg_dump -Fc -w`). It is used alone, and the connection reaches it through `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` and `PGPASSWORD`. It must write a custom-format dump to standard output.
2. `docker compose -f <project>/docker-compose.yml exec -T db pg_dump -U <user> -d <database> -Fc -w`, when the database in `DATABASE_URL` is on this computer (`localhost`, `127.0.0.1`) and `docker-compose.yml` is there. Docker Desktop must be running.
3. `pg_dump` found on the `PATH`, with the settings of `DATABASE_URL`.

A command that cannot start (not found) is skipped for the next one. So is a command that starts but cannot reach Docker or the `db` service (the error output says the Docker daemon is not running, "no such service" or that the service is not running): for example `docker compose` with Docker Desktop stopped falls through to `pg_dump` on the `PATH`. A command that reaches the database and fails (a message from `pg_dump` itself) is a failure and stops the chain. If every command is skipped, the code is `DATABASE_DUMP_UNAVAILABLE`. The password goes only through the environment of the child process, never on a command line or in a log, and a dump that takes more than 120 seconds is cancelled.

If the dump fails, the data files are still copied and the copy is marked partial: the Respaldo screen shows a warning and the line "Base de datos: no se pudo copiar (code)". Older copies are never deleted because of it. The codes are `DATABASE_DUMP_UNAVAILABLE` (no dump command could start: start Docker Desktop, or install PostgreSQL client tools, or set `PG_DUMP_COMMAND`) and `DATABASE_DUMP_FAILED` (the command ran and failed, was cancelled, or produced something that is not a dump; the server log has a short sanitized reason). A copy without its dump does not count as a good copy: the hourly check makes a new copy again (never more than one an hour for this reason) until a dump works, which keeps the loss at one day or less (RNF-03). You can also use "Hacer un respaldo ahora" after fixing the cause. Retention keeps the last copy that has a dump while this goes on.

## Protect the external drive

Enable BitLocker on the drive before the first copy: in Windows, right-click the drive in "Este equipo", choose "Activar BitLocker", set a password, and save the recovery key somewhere other than the drive and the club computer. Without it, anyone who finds the drive can read members and face data. Protecting the copies is the club's responsibility; the system does not encrypt them.

## Restore a copy

Do this with the backend stopped. It takes a few minutes. Steps 1 to 6 restore the data files; "Restore the database" below restores `database.dump`. After a total loss, do both from the same folder.

1. Choose the copy. Open the backup folder and pick the folder with the newest date you trust. Open its `manifest.json` to check the time.
2. Stop the backend. Close the window where it runs, or press `Ctrl+C` in it.
3. Keep what is there now. In `backend/data`, make a new folder called `antes-de-restaurar` and move the current `.json` files into it. This lets you undo the restore.
4. Copy the files back. Copy every `.json` file from the chosen copy folder, except `manifest.json`, into `backend/data`. If your installation uses other locations through `MEMBERS_FILE`, `PAYMENTS_FILE` or similar variables, copy each file to the place that variable names.
5. Start the backend again.
6. Check. Sign in as the head secretary, open Socios, and look up a member you know. Open Cobros and check that the latest receipts are there. Data entered after the copy was made is not in it and has to be entered again.

If something looks wrong, stop the backend, move the files from `antes-de-restaurar` back into `backend/data` and start it again.

## Restore the database

Needs Docker Desktop running and the database started (`docker compose up -d`, then `docker compose ps` says "healthy"). Run the commands from the project folder (the one with `docker-compose.yml`). The user and database below are the development defaults (`club`, `club_socios`); use yours if you changed them.

1. Stop the backend, as above.
2. Choose the dated folder and check in its `manifest.json` that `database.state` is `included`. Open a terminal in that folder.
3. Restore over the current database. This replaces the tables with the ones in the copy; anything entered after the copy is lost.
   - Any shell (PowerShell, Command Prompt, Git Bash). Copy the file into the container, restore, and delete it:
     ```
     docker compose cp database.dump db:/tmp/database.dump
     docker compose exec -T db pg_restore --clean --if-exists -U club -d club_socios /tmp/database.dump
     docker compose exec -T db rm /tmp/database.dump
     ```
     If you run these from the copy folder, add `-f "C:\path\to\project\docker-compose.yml"` after `docker compose`. In Git Bash put `MSYS_NO_PATHCONV=1` in front of the second and third lines, or Git Bash rewrites `/tmp/...` into a Windows path.
   - Git Bash only: `docker compose exec -T db pg_restore --clean --if-exists -U club -d club_socios < database.dump` (the `<` feeds the file in).
   - Do not use `Get-Content ... | docker ...` in Windows PowerShell 5.1: it corrupts the binary file and the restore fails. PowerShell 7 can pipe with `Get-Content -AsByteStream`, but the three lines above are safer.
4. Start the backend. Open Respaldo and check the last copy shows the database line. Open Ingreso, look up a member you know, and check that a registered face is still recognised. Entries logged after the copy was made are not in the restored database.

`pg_restore` can print a few warnings and still finish; a line starting with `pg_restore: error:` means that part did not restore. Run it again after fixing the cause: `--clean --if-exists` makes a second run safe.

### Restore into a new, empty database

Use this to check a copy without touching the current data, or to start from a clean database:

```
docker compose exec -T db psql -U club -d club_socios -c "CREATE DATABASE club_restaurada"
docker compose cp database.dump db:/tmp/database.dump
docker compose exec -T db pg_restore -U club -d club_restaurada /tmp/database.dump
docker compose exec -T db psql -U club -d club_restaurada -c "SELECT count(*) FROM access_entries"
docker compose exec -T db rm /tmp/database.dump
```

To use it, set `DATABASE_URL` to `.../club_restaurada` and restart the backend. To discard it: `docker compose exec -T db psql -U club -d club_socios -c "DROP DATABASE club_restaurada"`. A restore rehearsal with real numbers is recorded in `odd/tasks/postgres-backup.md`.

If the Docker volume was lost too, run `docker compose up -d`, wait until it is healthy, and restore as above (the empty `club_socios` is created by Docker; the restore then fills it).

## Notes

- A copy only happens while the backend is running. If the computer was off for a day, the next check after it starts makes the copy.
- Sessions are lost when the backend restarts. Everyone has to sign in again.
- The restore is not available from the screen. It is a deliberate manual step.
- Restoring while the backend is running is not covered: stop it first.
