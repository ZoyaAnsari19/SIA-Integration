#!/bin/bash

# Script to backup production database to production-db-backup folder
# Usage: ./backup-production-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KUBECONFIG="$SCRIPT_DIR/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"

BACKUP_DIR="$SCRIPT_DIR/production-db-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/prod-backup-${TIMESTAMP}.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 BACKING UP PRODUCTION DATABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Step 1: Check kubectl access
echo "Step 1: Checking Kubernetes access..."
if [ ! -f "$KUBECONFIG" ]; then
    echo "❌ Kubeconfig file not found: $KUBECONFIG"
    exit 1
fi

export KUBECONFIG="$KUBECONFIG"

if ! kubectl get pod $POSTGRES_POD -n $NAMESPACE > /dev/null 2>&1; then
    echo "❌ Cannot access postgres pod. Please check kubectl access."
    exit 1
fi

echo "✅ Kubernetes access confirmed"
echo ""

# Step 2: Dump production database
echo "Step 2: Dumping production database..."
echo "📥 Dumping from: $POSTGRES_POD (namespace: $NAMESPACE)"
echo "💾 Output file: $BACKUP_FILE"
echo ""

kubectl exec $POSTGRES_POD -n $NAMESPACE -- \
    pg_dump -U $DB_USER -d $DB_NAME \
    --no-owner \
    --no-acl \
    --format=plain \
    > "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to dump database"
    exit 1
fi

# Check if backup file was created and has content
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file was not created"
    exit 1
fi

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
BACKUP_LINES=$(wc -l < "$BACKUP_FILE" | tr -d ' ')

if [ "$BACKUP_LINES" -lt 100 ]; then
    echo "⚠️  Warning: Backup file seems too small ($BACKUP_LINES lines)"
    echo "   Please verify the backup manually"
else
    echo "✅ Database dumped successfully"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ BACKUP COMPLETED SUCCESSFULLY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Backup Summary:"
echo "   📁 Location: $BACKUP_FILE"
echo "   📦 Size: $BACKUP_SIZE"
echo "   📄 Lines: $BACKUP_LINES"
echo ""
echo "💡 To verify backup:"
echo "   head -20 $BACKUP_FILE"
echo ""
echo "💡 To restore backup (if needed):"
echo "   cat $BACKUP_FILE | kubectl exec -i $POSTGRES_POD -n $NAMESPACE -- psql -U $DB_USER -d $DB_NAME"
echo ""

