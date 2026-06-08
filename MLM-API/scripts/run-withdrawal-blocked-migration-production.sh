#!/bin/bash
# Production DB par users table mein withdrawal_blocked column add karta hai.
# Pehle prod DB backup leta hai, phir migration chalta hai.
# Run from repo root: ./MLM-API/scripts/run-withdrawal-blocked-migration-production.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

KUBECONFIG="${KUBECONFIG:-$REPO_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08}"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
SQL_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../prisma/migrations" && pwd)/add_withdrawal_blocked_column.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Production: users.withdrawal_blocked column"
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
  echo "⚠️  backup-production-db.sh not found at $REPO_ROOT/backup-production-db.sh"
  echo "   Take backup manually, then press Enter to continue (or Ctrl+C to abort)."
  read -r
fi
echo ""

echo "Step 2: Applying migration (ALTER TABLE users ADD COLUMN withdrawal_blocked)..."
if [ ! -f "$KUBECONFIG" ]; then
  echo "❌ Kubeconfig not found: $KUBECONFIG"
  exit 1
fi
export KUBECONFIG="$KUBECONFIG"

kubectl exec -i "$POSTGRES_POD" -n "$NAMESPACE" -- psql -U "$DB_USER" -d "$DB_NAME" < "$SQL_FILE"

echo ""
echo "✅ Done. users table now has withdrawal_blocked (or already had it)."
echo "   Safe to deploy new API/Admin UI with Block withdrawal feature."
echo ""
