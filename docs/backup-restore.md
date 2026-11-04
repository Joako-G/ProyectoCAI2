# Backup and restore

The backend copies every data file once a day while it is running (RNF-03). Each copy is a folder named `backup-YYYYMMDDTHHMMSSZ` (the time is UTC, three hours ahead of Tucumán) inside the backup folder. Old copies are cleaned up after each good copy: the newest copy of each of the last 30 days that have copies is kept (days counted in Tucumán time), and the 5 most recent copies are always kept, so several copies on one day never push out older days. Folders that are not copies, or whose name is not a real date, are never touched.

## Where the copies are

- By default: `backend/backups`. This folder is on the same computer as the data, so it does not protect against a broken disk or a stolen computer. The Respaldo screen says so.
- On an external drive: set the `BACKUP_DIR` environment variable to a folder on the drive before starting the backend, for example `E:\respaldos-club` on Windows. Plug the drive in before starting the backend. The backend never creates the `BACKUP_DIR` folder: if the drive or the folder is missing, the copy fails (code `DESTINATION_MISSING`), nothing is written, older copies are untouched, and the Respaldo screen tells staff to connect the external drive or check the folder. If the folder exists but cannot be read, the screen says so instead of showing "no copies". The next hourly check copies again once the drive is back. With the default folder, the backend creates it itself.

Each copy folder holds `manifest.json` (the time and the list of files) and one file per data file: `members.json`, `disciplines.json`, `memberships.json`, `pricing-config.json`, `payments.json`, `audit.json`, `cashcounts.json`, `users.json` and the two `*.seed.json` files. A file that does not exist yet (for example `cashcounts.json` before the first cash close) is simply not in the copy.

Copies contain personal data. Keep the drive in a safe place.

## Restore a copy

Do this with the backend stopped. It takes a few minutes.

1. Choose the copy. Open the backup folder and pick the folder with the newest date you trust. Open its `manifest.json` to check the time.
2. Stop the backend. Close the window where it runs, or press `Ctrl+C` in it.
3. Keep what is there now. In `backend/data`, make a new folder called `antes-de-restaurar` and move the current `.json` files into it. This lets you undo the restore.
4. Copy the files back. Copy every `.json` file from the chosen copy folder, except `manifest.json`, into `backend/data`. If your installation uses other locations through `MEMBERS_FILE`, `PAYMENTS_FILE` or similar variables, copy each file to the place that variable names.
5. Start the backend again.
6. Check. Sign in as the head secretary, open Socios, and look up a member you know. Open Cobros and check that the latest receipts are there. Data entered after the copy was made is not in it and has to be entered again.

If something looks wrong, stop the backend, move the files from `antes-de-restaurar` back into `backend/data` and start it again.

## Notes

- A copy only happens while the backend is running. If the computer was off for a day, the next check after it starts makes the copy.
- Sessions are lost when the backend restarts. Everyone has to sign in again.
- The restore is not available from the screen. It is a deliberate manual step.
