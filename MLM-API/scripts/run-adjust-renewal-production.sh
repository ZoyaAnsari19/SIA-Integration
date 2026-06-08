#!/bin/bash

# Script to adjust renewal commission amounts from 50% to 100% in PRODUCTION database
# Uses port-forward to connect to production database
# Usage: ./scripts/run-adjust-renewal-production.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KUBECONFIG="$PROJECT_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
DB_PASSWORD="mlm_password_prod_2024_secure"
LOCAL_PORT="5436"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 ADJUSTING RENEWAL COMMISSIONS IN PRODUCTION (50% → 100%)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check kubectl access
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

# Kill any existing port forward on the port
echo "📡 Setting up port-forward to production database..."
lsof -ti:$LOCAL_PORT | xargs kill -9 2>/dev/null || true
sleep 1

# Start port-forward in background
echo "   Forwarding localhost:$LOCAL_PORT -> $POSTGRES_POD:5432"
kubectl port-forward -n $NAMESPACE $POSTGRES_POD ${LOCAL_PORT}:5432 > /tmp/kubectl-port-forward-prod-adjust.log 2>&1 &
PORT_FORWARD_PID=$!

# Wait for port-forward to be ready
sleep 3

# Check if port-forward is running
if ! kill -0 $PORT_FORWARD_PID 2>/dev/null; then
    echo "❌ Failed to start port-forward. Check logs: /tmp/kubectl-port-forward-prod-adjust.log"
    exit 1
fi

echo "✅ Port-forward active (PID: $PORT_FORWARD_PID)"
echo ""

# Construct DATABASE_URL for local connection
PRODUCTION_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}?schema=public"

echo "🔗 Database: ${DB_NAME}@localhost:${LOCAL_PORT}"
echo "⚠️  WARNING: This will UPDATE existing ledger entries in PRODUCTION!"
echo ""

# Run the adjustment script
echo "🚀 Running adjustment script on production database..."
echo ""

cd "$SCRIPT_DIR/.."
PRODUCTION_DATABASE_URL="$PRODUCTION_DATABASE_URL" npx tsx scripts/adjust-renewal-commission-all-users.ts

ADJUST_EXIT_CODE=$?

# Cleanup - stop port forwarding
echo ""
echo "🧹 Cleaning up..."
kill $PORT_FORWARD_PID 2>/dev/null || true
sleep 1

if [ $ADJUST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SUCCESS: Renewal commissions adjusted in PRODUCTION!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ ERROR: Adjustment script failed (exit code: $ADJUST_EXIT_CODE)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit $ADJUST_EXIT_CODE
fi

