#!/bin/bash
# SIA00299 production fix: backup le, phir sirf user_balances update (no admin_ops/ledger).
# Run from repo root: ./MLM-API/scripts/production-fix-sia00299-balance.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

KUBECONFIG="${KUBECONFIG:-$REPO_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08}"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
BACKUP_DIR="$REPO_ROOT/production-db-backup"
SQL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/production-fix-sia00299-balance.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SIA00299 Production: Backup + Balance fix (no admin_ops)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: Backup
echo "Step 1: Taking production backup..."
if [ -f "$REPO_ROOT/backup-production-db.sh" ]; then
  bash "$REPO_ROOT/backup-production-db.sh"
else
  echo "⚠️  backup-production-db.sh not found. Take backup manually then press Enter."
  read -r
fi
echo ""

# Step 2: Run fix (only UPDATE user_balances)
echo "Step 2: Applying balance fix (spot + team_royalty for user_id 280)..."
if [ ! -f "$KUBECONFIG" ]; then
  echo "❌ Kubeconfig not found: $KUBECONFIG"
  exit 1
fi
export KUBECONFIG="$KUBECONFIG"

kubectl exec -i "$POSTGRES_POD" -n "$NAMESPACE" -- psql -U "$DB_USER" -d "$DB_NAME" < "$SQL_FILE"

echo ""
echo "✅ Done. user_balances updated for user_id 280 (no ledger entries)."
