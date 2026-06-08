#!/usr/bin/env bash
#
# Production DB backup: dump -> gzip -> upload to Bunny Storage.
# Run daily at 4:00 AM Indian time (e.g. via cron).
#
# Requires: kubectl, pg_dump (in cluster), curl, gzip
# Env (same as app): BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_ENDPOINT, BUNNY_STORAGE_API_KEY
# Or backup-specific: BUNNY_BACKUP_STORAGE_ZONE, BUNNY_BACKUP_STORAGE_ENDPOINT, BUNNY_BACKUP_ACCESS_KEY
# Optional: KUBECONFIG (defaults to repo azure-kube path)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
KUBECONFIG="${KUBECONFIG:-$REPO_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08}"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"

# Bunny Storage: use same as app (BUNNY_STORAGE_*) or backup-specific (BUNNY_BACKUP_*)
BUNNY_ZONE="${BUNNY_STORAGE_ZONE_NAME:-${BUNNY_BACKUP_STORAGE_ZONE:?Set BUNNY_STORAGE_ZONE_NAME or BUNNY_BACKUP_STORAGE_ZONE}}"
BUNNY_ENDPOINT="${BUNNY_STORAGE_ENDPOINT:-${BUNNY_BACKUP_STORAGE_ENDPOINT:?Set BUNNY_STORAGE_ENDPOINT or BUNNY_BACKUP_STORAGE_ENDPOINT}}"
BUNNY_ACCESS_KEY="${BUNNY_STORAGE_API_KEY:-${BUNNY_BACKUP_ACCESS_KEY:?Set BUNNY_STORAGE_API_KEY or BUNNY_BACKUP_ACCESS_KEY}}"

# Path inside storage zone (no leading slash)
BUNNY_PATH="db-backups"
# Normalize endpoint: allow with or without https://
if [[ "$BUNNY_ENDPOINT" != https://* ]]; then
  BUNNY_ENDPOINT="https://${BUNNY_ENDPOINT}"
fi

WORK_DIR="${BACKUP_WORK_DIR:-$SCRIPT_DIR/.backup-work}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$WORK_DIR/prod-dump-${TIMESTAMP}.sql"
GZIP_FILE="$WORK_DIR/prod-dump-${TIMESTAMP}.sql.gz"
REMOTE_NAME="mlm-prod-${TIMESTAMP}.sql.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Starting production DB backup (dump -> gzip -> Bunny)"

# Step 1: Check kubectl and cluster
if [ ! -f "$KUBECONFIG" ]; then
  log "ERROR: Kubeconfig not found: $KUBECONFIG"
  exit 1
fi
export KUBECONFIG="$KUBECONFIG"
if ! kubectl get pod "$POSTGRES_POD" -n "$NAMESPACE" >/dev/null 2>&1; then
  log "ERROR: Cannot access postgres pod $POSTGRES_POD in namespace $NAMESPACE"
  exit 1
fi
log "Kubernetes access OK"

# Step 2: Work dir
mkdir -p "$WORK_DIR"
log "Work dir: $WORK_DIR"

# Step 3: Dump production DB
log "Dumping database..."
kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --format=plain \
  > "$DUMP_FILE"
if [ ! -s "$DUMP_FILE" ]; then
  log "ERROR: Dump file empty or missing"
  exit 1
fi
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
log "Dump done: $DUMP_FILE ($DUMP_SIZE)"

# Step 4: Gzip (-k keeps .sql so we get .sql.gz alongside)
log "Compressing..."
gzip -f -k -9 "$DUMP_FILE"
GZIP_FILE="${DUMP_FILE}.gz"
[ -f "$GZIP_FILE" ] || { log "ERROR: gzip failed"; exit 1; }
GZIP_SIZE=$(du -h "$GZIP_FILE" | cut -f1)
log "Compressed: $GZIP_FILE ($GZIP_SIZE)"

# Step 5: Upload to Bunny Storage
# PUT https://{region}.storage.bunnycdn.com/{storageZoneName}/{path}/{fileName}
# Header: AccessKey: {storage zone password}
UPLOAD_URL="${BUNNY_ENDPOINT}/${BUNNY_ZONE}/${BUNNY_PATH}/${REMOTE_NAME}"
log "Uploading to Bunny: $BUNNY_ZONE / $BUNNY_PATH / $REMOTE_NAME"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PUT "$UPLOAD_URL" \
  -H "AccessKey: $BUNNY_ACCESS_KEY" \
  -H "Content-Type: application/gzip" \
  --data-binary "@$GZIP_FILE")
if [ "$HTTP_CODE" != "201" ]; then
  log "ERROR: Bunny upload failed HTTP $HTTP_CODE"
  exit 1
fi
log "Upload OK (HTTP 201)"

# Step 6: Cleanup local files (optional; keep if you want local copy)
rm -f "$DUMP_FILE" "$GZIP_FILE"
log "Backup complete: $REMOTE_NAME on Bunny at $BUNNY_PATH/"
