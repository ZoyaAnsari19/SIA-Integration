#!/bin/bash
# Production DB par spot_team_flush_history table create karta hai.
# Run from repo root: ./MLM-API/scripts/run-flush-history-migration-production.sh
# Pehle backup lo (e.g. backup-production-db.sh), phir ye script chalao.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

KUBECONFIG="${KUBECONFIG:-$REPO_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08}"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
SQL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../prisma/migrations" && pwd)/add_spot_team_flush_history.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Production: spot_team_flush_history table migration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ Migration file not found: $SQL_FILE"
  exit 1
fi

echo "Step 1: Taking production DB backup..."
if [ -f "$REPO_ROOT/backup-production-db.sh" ]; then
  bash "$REPO_ROOT/backup-production-db.sh"
else
  echo "⚠️  backup-production-db.sh not found. Take backup manually then press Enter."
  read -r
fi
echo ""

echo "Step 2: Applying migration (CREATE TABLE spot_team_flush_history)..."
if [ ! -f "$KUBECONFIG" ]; then
  echo "❌ Kubeconfig not found: $KUBECONFIG"
  exit 1
fi
export KUBECONFIG="$KUBECONFIG"

kubectl exec -i "$POSTGRES_POD" -n "$NAMESPACE" -- psql -U "$DB_USER" -d "$DB_NAME" < "$SQL_FILE"

echo ""
echo "✅ Done. spot_team_flush_history table created (or already exists)."
echo "   Deploy new API/Admin UI that use flush history."
