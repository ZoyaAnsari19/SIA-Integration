#!/bin/bash

# Script to credit SPOT commission to SIA00299 on Production Database
# Usage: ./scripts/run-credit-sia00299-production.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KUBECONFIG="$PROJECT_ROOT/azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08"
NAMESPACE="mlm"
POSTGRES_POD="postgres-0"
DB_USER="mlm_user"
DB_NAME="mlm_commission"

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

# Get database connection details from pod
echo "📡 Getting production database connection details..."
DB_HOST=$(kubectl get pod $POSTGRES_POD -n $NAMESPACE -o jsonpath='{.status.podIP}')
DB_PASSWORD=$(kubectl get secret postgres-secret -n $NAMESPACE -o jsonpath='{.data.postgres-password}' 2>/dev/null | base64 -d || echo "mlm_password_prod_2024_secure")

# Construct DATABASE_URL
PRODUCTION_DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}?schema=public"

echo "🔗 Database: ${DB_NAME}@${DB_HOST}"
echo ""

# Run the credit script with production database URL
echo "🚀 Running credit script on production database..."
echo ""

cd "$SCRIPT_DIR/.."
PRODUCTION_DATABASE_URL="$PRODUCTION_DATABASE_URL" npx tsx scripts/credit-spot-sia00299-purchase1545.ts

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ COMMISSION CREDIT COMPLETED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

