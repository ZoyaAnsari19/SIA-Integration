#!/bin/bash
# Production: (1) Backup DB, (2) Run fee_rule_code migration, (3) Seed fee rules + pre-questions.
# Run from repo root: ./MLM-API/scripts/run-support-topic-migration-production.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

KUBECONFIG="${KUBECONFIG:-$REPO_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08}"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
DB_PASSWORD="mlm_password_prod_2024_secure"
BACKUP_DIR="$REPO_ROOT/backup-script/production-db-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/prod-backup-before-support-topic-${TIMESTAMP}.sql"
MIGRATION_SQL="$SCRIPT_DIR/../prisma/migrations/add_support_pre_question_fee_rule_code.sql"
LOCAL_PORT="5433"
PF_PID=""

cleanup_pf() {
  if [ -n "$PF_PID" ] && kill -0 "$PF_PID" 2>/dev/null; then
    kill "$PF_PID" 2>/dev/null || true
    wait "$PF_PID" 2>/dev/null || true
  fi
}
trap cleanup_pf EXIT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Production: Support topic fee_rule_code + fee rules + pre-questions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "$KUBECONFIG" ]; then
  echo "❌ Kubeconfig not found: $KUBECONFIG"
  exit 1
fi
export KUBECONFIG="$KUBECONFIG"

if ! kubectl get pod "$POSTGRES_POD" -n "$NAMESPACE" >/dev/null 2>&1; then
  echo "❌ Cannot access postgres pod. Check kubectl."
  exit 1
fi

# ─── Step 1: Backup (dump only) ───
echo "Step 1: Taking production DB backup (dump only)..."
mkdir -p "$BACKUP_DIR"
kubectl exec "$POSTGRES_POD" -n "$NAMESPACE" -- \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --format=plain \
  > "$DUMP_FILE"
if [ ! -s "$DUMP_FILE" ]; then
  echo "❌ Backup file empty or missing: $DUMP_FILE"
  exit 1
fi
echo "   ✅ Backup saved: $DUMP_FILE"
echo ""

# ─── Step 2: Migration (add fee_rule_code column) ───
echo "Step 2: Applying migration (support_pre_questions.fee_rule_code)..."
if [ ! -f "$MIGRATION_SQL" ]; then
  echo "❌ Migration file not found: $MIGRATION_SQL"
  exit 1
fi
kubectl exec -i "$POSTGRES_POD" -n "$NAMESPACE" -- psql -U "$DB_USER" -d "$DB_NAME" < "$MIGRATION_SQL"
echo "   ✅ Migration applied."
echo ""

# ─── Step 3: Seed fee rules + pre-questions (via port-forward + tsx) ───
echo "Step 3: Seeding fee rules and pre-questions..."
kubectl port-forward -n "$NAMESPACE" "$POSTGRES_POD" "$LOCAL_PORT:5432" >/tmp/pf-support-topic-prod.log 2>&1 &
PF_PID=$!
sleep 2
if ! kill -0 "$PF_PID" 2>/dev/null; then
  echo "❌ Port-forward failed. Check /tmp/pf-support-topic-prod.log"
  exit 1
fi

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}?schema=public"
cd "$REPO_ROOT/MLM-API"
npx tsx scripts/seed-support-topics-and-fees.ts
cd "$REPO_ROOT"
echo "   ✅ Seed completed."
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Production update complete."
echo "   Backup: $DUMP_FILE"
echo "   Migration: fee_rule_code column added (if not already)."
echo "   Fee rules + pre-questions seeded."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
