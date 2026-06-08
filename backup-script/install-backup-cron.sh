#!/usr/bin/env bash
#
# Install cron job for production DB backup at 4:00 AM Indian time (IST).
# Uses existing Bunny config (same as app: BUNNY_STORAGE_ZONE_NAME, etc.).
# Run from repo root: ./backup-script/install-backup-cron.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/backup-bunny.env"
CRON_LOG="$SCRIPT_DIR/backup.log"

# 4 AM Indian time (IST):
# - With CRON_TZ=Asia/Kolkata, "0 4 * * *" = 4:00 AM IST (recommended)
# - If your cron does not support CRON_TZ and server is UTC, use BACKUP_CRON_USE_UTC=1 (30 22 = 22:30 UTC = 4:00 AM IST)
CRON_TIME="0 4 * * *"
if [[ "${BACKUP_CRON_USE_UTC:-0}" == "1" ]]; then
  CRON_TIME="30 22 * * *"
fi

# First line sets timezone for cron (supported on many Linux crons); then the schedule
CRON_BLOCK="CRON_TZ=Asia/Kolkata
$CRON_TIME /bin/bash -l -c 'cd \"$REPO_ROOT\" && . ./backup-script/backup-bunny.env 2>/dev/null && ./backup-script/prod-backup-to-bunny.sh' >> \"$CRON_LOG\" 2>&1"

echo "Production DB backup cron (4:00 AM IST)"
echo "  Repo:    $REPO_ROOT"
echo "  Env:     $ENV_FILE"
echo "  Log:     $CRON_LOG"
echo ""

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Create env file first:"
  echo "  cp $SCRIPT_DIR/backup-bunny.env.example $ENV_FILE"
  echo "  # Edit $ENV_FILE and set BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_ENDPOINT, BUNNY_STORAGE_API_KEY (same as MLM-API / k8s secrets)"
  exit 1
fi

echo "Cron entry to add (4:00 AM Indian time):"
echo "---"
echo "$CRON_BLOCK"
echo "---"
echo ""
read -p "Add this to your crontab now? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Skipped. Add the block above manually with: crontab -e"
  exit 0
fi

# Remove any existing backup cron line, then append new block
( crontab -l 2>/dev/null | grep -v "prod-backup-to-bunny.sh" || true; echo "$CRON_BLOCK" ) | crontab -
echo "Done. Verify with: crontab -l"
