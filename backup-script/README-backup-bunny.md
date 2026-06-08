# Production DB backup to Bunny Storage

Daily backup: production PostgreSQL → dump → gzip → upload to Bunny Storage.

## Where it runs (production)

**Backup runs on the same server as the API** via **PgBoss** (like daily-commission and eligibility-check):

- **Schedule:** 23:30 UTC = **5:00 AM Indian time (IST)** every day
- **Code:** `MLM-API/src/jobs/db-backup-bunny.ts` — PgBoss job that runs inside the API process
- **No Mac/laptop needed** — runs on the API deployment (e.g. Kubernetes), so it keeps running even when your Mac is off

When the API starts, it registers the `db-backup-bunny` queue and schedule. The job uses `DATABASE_URL` and Bunny env vars already configured for the API.

## Manual / local backup (optional)

If you need to take a backup from your machine (e.g. to load into local DB), use the shell script. It needs `kubectl` access to the production cluster.

```bash
cd /path/to/MLM
. ./backup-script/backup-bunny.env
./backup-script/prod-backup-to-bunny.sh
```

Requires: `BUNNY_STORAGE_ZONE_NAME`, `BUNNY_STORAGE_ENDPOINT`, `BUNNY_STORAGE_API_KEY` in `backup-bunny.env` (same as MLM-API). See `backup-bunny.env.example`.

## Where backups are stored

- **Bunny:** storage zone path `db-backups/`, e.g. `mlm-prod-20260220_040001.sql.gz`
- **Retention:** Bunny does not auto-delete; plan retention (e.g. last 7 daily) and delete old files in dashboard or via API if needed.
