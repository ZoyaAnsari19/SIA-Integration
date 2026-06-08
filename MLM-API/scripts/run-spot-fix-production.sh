#!/bin/bash

# Script to fix spot wallet balances in Production Database
# 1. Restore 13 Jan 2026 baseline balances
# 2. Credit SPOT commissions from purchases after 13 Jan 2026
# Uses port-forward to connect to production database
# Usage: ./scripts/run-spot-fix-production.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KUBECONFIG="$PROJECT_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"
DB_PASSWORD="mlm_password_prod_2024_secure"
LOCAL_PORT="5437"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 FIXING SPOT WALLET BALANCES IN PRODUCTION"
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
kubectl port-forward -n $NAMESPACE $POSTGRES_POD ${LOCAL_PORT}:5432 > /tmp/kubectl-port-forward-prod-spot-fix.log 2>&1 &
PORT_FORWARD_PID=$!

# Wait for port-forward to be ready
sleep 3

# Check if port-forward is running
if ! kill -0 $PORT_FORWARD_PID 2>/dev/null; then
    echo "❌ Failed to start port-forward. Check logs: /tmp/kubectl-port-forward-prod-spot-fix.log"
    exit 1
fi

if ! lsof -i :$LOCAL_PORT > /dev/null 2>&1; then
    echo "❌ Port forwarding failed. Check logs: /tmp/kubectl-port-forward-prod-spot-fix.log"
    kill $PORT_FORWARD_PID 2>/dev/null || true
    exit 1
fi

echo "✅ Port-forward active (PID: $PORT_FORWARD_PID)"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up port-forward..."
    kill $PORT_FORWARD_PID 2>/dev/null || true
    lsof -ti:$LOCAL_PORT | xargs kill -9 2>/dev/null || true
    echo "✅ Cleanup complete"
}

trap cleanup EXIT

# Set production database URL
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}?schema=public"
export ALLOW_PRODUCTION=true

echo "🔗 Database: ${DB_NAME}@localhost:${LOCAL_PORT}"
echo ""

# Step 1: Restore 13 Jan baseline
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Restoring 13 Jan 2026 baseline spot wallet balances"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$SCRIPT_DIR/.."
npx tsx scripts/restore-spot-balance-from-13jan.ts

if [ $? -ne 0 ]; then
    echo "❌ Failed to restore 13 Jan baseline"
    exit 1
fi

echo ""
echo "✅ Step 1 completed: 13 Jan baseline restored"
echo ""

# Step 2: Credit SPOT commissions from purchases after 13 Jan
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Crediting SPOT commissions from purchases after 13 Jan 2026"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npx tsx scripts/credit-spot-from-purchases-after-13jan.ts

if [ $? -ne 0 ]; then
    echo "❌ Failed to credit SPOT commissions"
    exit 1
fi

echo ""
echo "✅ Step 2 completed: SPOT commissions credited"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SUCCESS: Spot wallet balances fixed in PRODUCTION!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "   - 13 Jan 2026 baseline balances restored"
echo "   - SPOT commissions from purchases after 13 Jan credited"
echo ""
echo "⚠️  Please verify the changes in production before proceeding."
echo ""
