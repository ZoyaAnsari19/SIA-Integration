#!/bin/bash

# Script to backup production DB and load into existing local DB (port 5435)
# Usage: ./load-prod-backup-to-local-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
KUBECONFIG="$REPO_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
DB_PASSWORD="mlm_password_prod_2024_secure"

# Local DB configuration (existing local DB on port 5435 - mlm-prod-dump container)
LOCAL_PORT="5435"
LOCAL_DB_USER="mlm_user"
LOCAL_DB_PASSWORD="mlm_password"
LOCAL_DB_NAME="mlm_commission"

BACKUP_DIR="$SCRIPT_DIR/production-db-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/prod-backup-to-local-${TIMESTAMP}.sql"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Loading Production DB Backup to Local DB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  WARNING: This will REPLACE local database!"
echo "   Local DB: $LOCAL_DB_NAME@localhost:$LOCAL_PORT"
echo ""

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

# Step 2: Check local DB is running
echo "Step 2: Checking local database..."
if ! lsof -i :$LOCAL_PORT > /dev/null 2>&1; then
    echo "❌ Local database not running on port $LOCAL_PORT"
    echo "   Please start your local Postgres on port $LOCAL_PORT"
    exit 1
fi

# Test connection
export PGPASSWORD="$LOCAL_DB_PASSWORD"
if ! psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Cannot connect to local database on port $LOCAL_PORT"
    echo "   Check that Postgres is running and credentials are correct"
    unset PGPASSWORD
    exit 1
fi
unset PGPASSWORD

echo "✅ Local database is running and accessible"
echo ""

# Step 3: Create backup directory
echo "Step 3: Creating backup directory..."
mkdir -p "$BACKUP_DIR"
echo "✅ Backup directory ready: $BACKUP_DIR"
echo ""

# Step 4: Dump production database
echo "Step 4: Dumping production database..."
echo "📥 Dumping from: $POSTGRES_POD (namespace: $NAMESPACE)"
echo "💾 Output file: $DUMP_FILE"
echo ""

kubectl exec $POSTGRES_POD -n $NAMESPACE -- \
    pg_dump -U $DB_USER -d $DB_NAME \
    --no-owner \
    --no-acl \
    --format=plain \
    > "$DUMP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to dump database"
    exit 1
fi

# Check if backup file was created and has content
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ Backup file was not created"
    exit 1
fi

DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
DUMP_LINES=$(wc -l < "$DUMP_FILE" | tr -d ' ')

if [ "$DUMP_LINES" -lt 100 ]; then
    echo "⚠️  Warning: Backup file seems too small ($DUMP_LINES lines)"
    echo "   Please verify the backup manually"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted by user"
        exit 1
    fi
else
    echo "✅ Database backup completed successfully"
fi

echo ""
echo "📊 Backup Summary:"
echo "   📁 Location: $DUMP_FILE"
echo "   📦 Size: $DUMP_SIZE"
echo "   📄 Lines: $DUMP_LINES"
echo ""

# Step 5: Confirm before loading
echo "⚠️  This will REPLACE all data in local database!"
echo "   Local DB: $LOCAL_DB_NAME@localhost:$LOCAL_PORT"
read -p "Continue with load? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted by user"
    exit 1
fi

# Step 6: Drop and recreate local database (full clear then load)
echo ""
echo "Step 5: Clearing local database completely..."
export PGPASSWORD="$LOCAL_DB_PASSWORD"

# Terminate all connections to the database
echo "   Terminating existing connections..."
psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '$LOCAL_DB_NAME' AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true
sleep 2

# Force drop database (Postgres 13+: closes connections and drops)
echo "   Dropping existing database (FORCE)..."
psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d postgres -c "DROP DATABASE IF EXISTS $LOCAL_DB_NAME WITH (FORCE);" 2>/dev/null || \
psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d postgres -c "DROP DATABASE IF EXISTS $LOCAL_DB_NAME;" > /dev/null 2>&1 || true
sleep 1

echo "   Creating fresh database..."
psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d postgres -c "CREATE DATABASE $LOCAL_DB_NAME;"

if [ $? -ne 0 ]; then
    echo "❌ Failed to create database"
    exit 1
fi

echo "✅ Local database prepared"
echo ""

# Step 7: Load dump into local database
echo "Step 6: Loading dump into local database..."
echo "📤 Loading: $DUMP_FILE"
echo "📥 Into: $LOCAL_DB_NAME@localhost:$LOCAL_PORT"
echo ""

# Note: Production DB uses mlm_commission, local uses mlm_commission (same name)
# Create temp dump: adjust DB name and remove \restrict/\unrestrict (avoids "invalid command" on older psql)
TEMP_DUMP="/tmp/prod-dump-local-${TIMESTAMP}.sql"
sed "s/$DB_NAME/$LOCAL_DB_NAME/g" "$DUMP_FILE" | grep -v '^\\restrict$' | grep -v '^\\unrestrict$' > "$TEMP_DUMP"

# Load the dump (ignore harmless errors like \restrict)
export PGPASSWORD="$LOCAL_DB_PASSWORD"
psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -v ON_ERROR_STOP=0 < "$TEMP_DUMP" || true
LOAD_EXIT=$?
rm -f "$TEMP_DUMP"

if [ "$LOAD_EXIT" -ne 0 ]; then
    echo "⚠️  Dump load had some errors (check above). Verifying..."
fi

echo "✅ Database loaded"
echo ""

# Step 8: Verify and fix withdraw_requests if missing
echo "Step 7: Verifying database load..."
TABLE_COUNT=$(psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

if [ -n "$TABLE_COUNT" ] && [ "$TABLE_COUNT" -gt "0" ]; then
    echo "✅ Tables found: $TABLE_COUNT"
else
    echo "⚠️  Warning: No tables found in database"
fi

LOCAL_WITHDRAW_CNT=$(psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -t -c "SELECT COUNT(*) FROM withdraw_requests;" | tr -d ' ')
echo "   withdraw_requests rows (local): $LOCAL_WITHDRAW_CNT"

if [ -n "$LOCAL_WITHDRAW_CNT" ] && [ "$LOCAL_WITHDRAW_CNT" -eq "0" ]; then
    echo ""
    echo "   ⚠️  withdraw_requests is empty. Syncing from production..."
    WITHDRAW_CSV="/tmp/prod-withdraw_requests-${TIMESTAMP}.csv"
    kubectl exec $POSTGRES_POD -n $NAMESPACE -- psql -U $DB_USER -d $DB_NAME -t -A -F',' -c "COPY (SELECT id, user_id, withdraw_type::text, amount, payment_method, account_details, status::text, remarks, reference_id, processed_at, processed_by, rejection_reason, created_at, updated_at FROM withdraw_requests) TO STDOUT WITH (FORMAT csv, HEADER false)" > "$WITHDRAW_CSV" 2>/dev/null || true
    if [ -s "$WITHDRAW_CSV" ]; then
        psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -c "TRUNCATE TABLE withdraw_requests;" > /dev/null 2>&1
        psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -c "\\copy withdraw_requests (id, user_id, withdraw_type, amount, payment_method, account_details, status, remarks, reference_id, processed_at, processed_by, rejection_reason, created_at, updated_at) FROM '${WITHDRAW_CSV}' WITH (FORMAT csv)" 2>/dev/null && echo "   ✅ withdraw_requests synced from prod" || echo "   ⚠️  Manual sync may be needed"
        rm -f "$WITHDRAW_CSV"
    else
        echo "   ⚠️  Could not export from prod; withdraw_requests may be empty there too"
    fi
fi

# Check SIA00397's purchase
echo ""
echo "Step 8: Verifying SIA00397's purchase..."
PURCHASE_CHECK=$(psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -t -c "
    SELECT p.id, p.effective_global_ids, u.display_id
    FROM purchases p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = 261;
" | xargs)

if [ -n "$PURCHASE_CHECK" ]; then
    echo "✅ SIA00397's purchase found: $PURCHASE_CHECK"
else
    echo "⚠️  Warning: SIA00397's purchase not found"
fi

# Step 9: Quick prod vs local match (withdraw_requests)
echo ""
echo "Step 9: Prod vs local (withdraw_requests)..."
PROD_WR=$(kubectl exec $POSTGRES_POD -n $NAMESPACE -- psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*), COALESCE(SUM(amount),0) FROM withdraw_requests;" 2>/dev/null | xargs) || PROD_WR="?"
LOCAL_WR=$(psql -h localhost -p $LOCAL_PORT -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -t -c "SELECT COUNT(*), COALESCE(SUM(amount),0) FROM withdraw_requests;" | xargs)
echo "   Prod:  $PROD_WR"
echo "   Local: $LOCAL_WR"

unset PGPASSWORD

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Local Database Details:"
echo "   Port: $LOCAL_PORT"
echo "   Database: $LOCAL_DB_NAME"
echo "   User: $LOCAL_DB_USER"
echo "   Password: $LOCAL_DB_PASSWORD"
echo ""
echo "🔗 Connection String:"
echo "   postgresql://$LOCAL_DB_USER:$LOCAL_DB_PASSWORD@localhost:$LOCAL_PORT/$LOCAL_DB_NAME"
echo ""
echo "📁 Backup File:"
echo "   $DUMP_FILE"
echo ""
echo "💡 Note:"
echo "   - Production DB name: $DB_NAME"
echo "   - Local DB name: $LOCAL_DB_NAME"
echo "   - Data has been loaded from production to local"
echo ""

