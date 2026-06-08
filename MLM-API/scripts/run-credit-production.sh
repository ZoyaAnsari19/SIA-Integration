#!/bin/bash

# Script to credit missing monthly royalties in PRODUCTION database (postgres-0)
# Usage: ./run-credit-production.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KUBECONFIG="$PROJECT_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
LOCAL_PORT="5436"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 CREDITING MISSING MONTHLY ROYALTIES IN PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
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

# Step 2: Get production database password from secret
echo "Step 2: Getting production database credentials..."
DB_PASSWORD=$(kubectl get secret mlm-secrets -n $NAMESPACE -o jsonpath='{.data.DB_PASSWORD}' 2>/dev/null | base64 -d 2>/dev/null || echo "")

if [ -z "$DB_PASSWORD" ]; then
    echo "⚠️  Warning: Could not get password from secret"
    echo "   Please enter production database password manually:"
    read -s DB_PASSWORD
    echo ""
fi

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Database password is required"
    exit 1
fi

echo "✅ Database credentials retrieved"
echo ""

# Step 3: Kill any existing port forward on the port
echo "Step 3: Setting up port forwarding to production database..."
lsof -ti:$LOCAL_PORT | xargs kill -9 2>/dev/null || true
sleep 1

# Step 4: Set up port forwarding to production database
echo "   Forwarding localhost:$LOCAL_PORT -> $POSTGRES_POD:5432"

# Start port forwarding in background
kubectl port-forward -n $NAMESPACE $POSTGRES_POD $LOCAL_PORT:5432 > /tmp/kubectl-port-forward-prod.log 2>&1 &
PORT_FORWARD_PID=$!

# Wait for port forward to be ready
sleep 3
if ! lsof -i :$LOCAL_PORT > /dev/null 2>&1; then
    echo "❌ Port forwarding failed. Check logs: /tmp/kubectl-port-forward-prod.log"
    kill $PORT_FORWARD_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Port forwarding active (PID: $PORT_FORWARD_PID)"
echo ""

# Step 5: Set production database URL
export PRODUCTION_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}"

echo "Step 4: Running credit script on production database..."
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Port: $LOCAL_PORT (forwarded from $POSTGRES_POD:5432)"
echo ""

# Step 6: Run the credit script
cd "$SCRIPT_DIR/.."
npx tsx scripts/credit-missing-monthly-royalty-production.ts

CREDIT_EXIT_CODE=$?

# Step 7: Cleanup - stop port forwarding
echo ""
echo "Step 5: Cleaning up..."
kill $PORT_FORWARD_PID 2>/dev/null || true
sleep 1

if [ $CREDIT_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SUCCESS: Missing monthly royalties credited in PRODUCTION!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ ERROR: Script failed with exit code $CREDIT_EXIT_CODE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit $CREDIT_EXIT_CODE
fi

