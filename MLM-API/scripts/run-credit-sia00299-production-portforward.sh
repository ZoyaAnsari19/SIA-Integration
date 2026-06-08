#!/bin/bash

# Script to credit SPOT commission to SIA00299 on Production Database
# Uses port-forward to connect to production database
# Usage: ./scripts/run-credit-sia00299-production-portforward.sh

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
echo "💰 CREDITING SPOT COMMISSION TO SIA00299 (PRODUCTION)"
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

# Start port-forward in background
echo "📡 Setting up port-forward to production database..."
kubectl port-forward -n $NAMESPACE $POSTGRES_POD ${LOCAL_PORT}:5432 > /dev/null 2>&1 &
PORT_FORWARD_PID=$!

# Wait for port-forward to be ready
sleep 3

# Check if port-forward is running
if ! kill -0 $PORT_FORWARD_PID 2>/dev/null; then
    echo "❌ Failed to start port-forward"
    exit 1
fi

echo "✅ Port-forward active (PID: $PORT_FORWARD_PID)"
echo ""

# Construct DATABASE_URL for local connection
PRODUCTION_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}?schema=public"

echo "🔗 Database: ${DB_NAME}@localhost:${LOCAL_PORT}"
echo ""

# Trap to cleanup port-forward on exit
trap "kill $PORT_FORWARD_PID 2>/dev/null" EXIT

# Run the credit script with production database URL
echo "🚀 Running credit script on production database..."
echo ""

cd "$SCRIPT_DIR/.."
PRODUCTION_DATABASE_URL="$PRODUCTION_DATABASE_URL" npx tsx scripts/credit-spot-sia00299-purchase1545.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ COMMISSION CREDIT COMPLETED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

