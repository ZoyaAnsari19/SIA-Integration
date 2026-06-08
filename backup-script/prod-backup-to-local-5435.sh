#!/bin/bash
#
# Prod DB backup → load into local DB (port 5435)
# Local: postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission
#
# Usage:
#   ./prod-backup-to-local-5435.sh           # interactive (prompts for confirm)
#   ./prod-backup-to-local-5435.sh --yes      # non-interactive (no prompts)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
KUBECONFIG="${KUBECONFIG:-$REPO_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08}"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
DB_PASSWORD="mlm_password_prod_2024_secure"

# Local DB (override if needed):
#   LOCAL_DATABASE_URL="postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission"
LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission}"

parse_pg_url() {
  # Parses: postgresql://user:pass@host:port/dbname
  # Exports: LOCAL_DB_USER LOCAL_DB_PASSWORD LOCAL_HOST LOCAL_PORT LOCAL_DB_NAME
  local url="$1"

  local proto_rest="${url#*://}"
  local creds="${proto_rest%@*}"
  local host_db="${proto_rest#*@}"

  LOCAL_DB_USER="${creds%%:*}"
  LOCAL_DB_PASSWORD="${creds#*:}"
  LOCAL_HOST="${host_db%%:*}"

  local port_db="${host_db#*:}"
  LOCAL_PORT="${port_db%%/*}"
  LOCAL_DB_NAME="${port_db#*/}"

  if [ -z "${LOCAL_DB_USER:-}" ] || [ -z "${LOCAL_DB_PASSWORD:-}" ] || [ -z "${LOCAL_HOST:-}" ] || [ -z "${LOCAL_PORT:-}" ] || [ -z "${LOCAL_DB_NAME:-}" ]; then
    echo "❌ Failed to parse LOCAL_DATABASE_URL"
    echo "   Got: $url"
    echo "   Expected: postgresql://user:pass@host:port/dbname"
    exit 1
  fi
}

build_admin_url() {
  # Uses parsed host/user/pass/port; connects to maintenance DB 'postgres'
  echo "postgresql://${LOCAL_DB_USER}:${LOCAL_DB_PASSWORD}@${LOCAL_HOST}:${LOCAL_PORT}/postgres"
}

BACKUP_DIR="$SCRIPT_DIR/production-db-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/prod-to-local-5435-${TIMESTAMP}.sql"

AUTO_YES=false
for arg in "$@"; do
    case "$arg" in
        --yes|-y) AUTO_YES=true ;;
    esac
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Production DB → Local (port 5435)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Prod:  postgres-0 (namespace: $NAMESPACE)"
echo "   Local: $LOCAL_DATABASE_URL"
echo ""
echo "⚠️  This will REPLACE the local database!"
echo ""

parse_pg_url "$LOCAL_DATABASE_URL"
LOCAL_ADMIN_URL="$(build_admin_url)"

# Step 1: kubectl
echo "Step 1: Checking Kubernetes access..."
if [ ! -f "$KUBECONFIG" ]; then
    echo "❌ Kubeconfig not found: $KUBECONFIG"
    exit 1
fi
export KUBECONFIG="$KUBECONFIG"
if ! kubectl get pod "$POSTGRES_POD" -n "$NAMESPACE" > /dev/null 2>&1; then
    echo "❌ Cannot access pod $POSTGRES_POD in namespace $NAMESPACE"
    exit 1
fi
echo "✅ Kubernetes OK"
echo ""

# Step 2: Local DB
echo "Step 2: Checking local database (port $LOCAL_PORT)..."
if ! lsof -i ":$LOCAL_PORT" > /dev/null 2>&1; then
    echo "❌ Nothing listening on port $LOCAL_PORT"
    echo "   Start local Postgres (e.g. docker start mlm-prod-dump)"
    exit 1
fi
export PGPASSWORD="$LOCAL_DB_PASSWORD"
if ! psql "$LOCAL_ADMIN_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Cannot connect to local DB. Check user/password."
    unset PGPASSWORD
    exit 1
fi
unset PGPASSWORD
echo "✅ Local DB OK"
echo ""

# Step 3: Dump prod
echo "Step 3: Dumping production database..."
mkdir -p "$BACKUP_DIR"
echo "   → $DUMP_FILE"

kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --format=plain \
    > "$DUMP_FILE"

if [ ! -f "$DUMP_FILE" ] || [ ! -s "$DUMP_FILE" ]; then
    echo "❌ Dump failed or empty"
    exit 1
fi

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
DUMP_LINES=$(wc -l < "$DUMP_FILE" | tr -d ' ')
echo "✅ Dump done: $DUMP_SIZE, $DUMP_LINES lines"
echo ""

if [ "$DUMP_LINES" -lt 100 ]; then
    echo "⚠️  Dump seems very small."
    if [ "$AUTO_YES" != "true" ]; then
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        [[ "$REPLY" =~ ^[Yy]$ ]] || exit 1
    fi
fi

# Confirm load (unless --yes)
if [ "$AUTO_YES" != "true" ]; then
    echo "⚠️  About to REPLACE local DB at $LOCAL_HOST:$LOCAL_PORT/$LOCAL_DB_NAME"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    [[ "$REPLY" =~ ^[Yy]$ ]] || exit 1
fi
echo ""

# Step 4: Clear local DB
echo "Step 4: Clearing local database..."
export PGPASSWORD="$LOCAL_DB_PASSWORD"
psql "$LOCAL_ADMIN_URL" -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '$LOCAL_DB_NAME' AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true
sleep 2
psql "$LOCAL_ADMIN_URL" -c "DROP DATABASE IF EXISTS $LOCAL_DB_NAME WITH (FORCE);" 2>/dev/null || \
psql "$LOCAL_ADMIN_URL" -c "DROP DATABASE IF EXISTS $LOCAL_DB_NAME;" 2>/dev/null || true
sleep 1
psql "$LOCAL_ADMIN_URL" -c "CREATE DATABASE $LOCAL_DB_NAME;"
echo "✅ Local DB recreated"
echo ""

# Step 5: Load dump
echo "Step 5: Loading dump into local..."
TEMP_DUMP="/tmp/prod-dump-local-${TIMESTAMP}.sql"
sed "s/$DB_NAME/$LOCAL_DB_NAME/g" "$DUMP_FILE" | grep -Ev '^[[:space:]]*\\\\restrict[[:space:]]*$' | grep -Ev '^[[:space:]]*\\\\unrestrict[[:space:]]*$' > "$TEMP_DUMP"
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=0 < "$TEMP_DUMP" || true
rm -f "$TEMP_DUMP"
echo "✅ Load complete"
echo ""

# Step 6: Optional withdraw_requests sync if empty
LOCAL_WR=$(psql "$LOCAL_DATABASE_URL" -t -c "SELECT COUNT(*) FROM withdraw_requests;" 2>/dev/null | tr -d ' ')
if [ -n "$LOCAL_WR" ] && [ "$LOCAL_WR" -eq "0" ]; then
    echo "Step 6: withdraw_requests empty, syncing from prod..."
    WITHDRAW_CSV="/tmp/prod-withdraw_requests-${TIMESTAMP}.csv"
    kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- psql -U "$DB_USER" -d "$DB_NAME" -t -A -F',' -c "COPY (SELECT id, user_id, withdraw_type::text, amount, payment_method, account_details, status::text, remarks, reference_id, processed_at, processed_by, rejection_reason, created_at, updated_at FROM withdraw_requests) TO STDOUT WITH (FORMAT csv, HEADER false)" > "$WITHDRAW_CSV" 2>/dev/null || true
    if [ -s "$WITHDRAW_CSV" ]; then
        psql "$LOCAL_DATABASE_URL" -c "TRUNCATE TABLE withdraw_requests;" > /dev/null 2>&1
        psql "$LOCAL_DATABASE_URL" -c "\\copy withdraw_requests (id, user_id, withdraw_type, amount, payment_method, account_details, status, remarks, reference_id, processed_at, processed_by, rejection_reason, created_at, updated_at) FROM '${WITHDRAW_CSV}' WITH (FORMAT csv)" 2>/dev/null && echo "   ✅ withdraw_requests synced" || true
        rm -f "$WITHDRAW_CSV"
    fi
else
    echo "Step 6: withdraw_requests rows (local): $LOCAL_WR"
fi
unset PGPASSWORD
echo ""

# Done
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Done"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔗 Local connection string:"
echo "   $LOCAL_DATABASE_URL"
echo ""
echo "📁 Backup: $DUMP_FILE"
echo ""
