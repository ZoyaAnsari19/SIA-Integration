#!/bin/bash
# Run SIA00404 spot credit on production (after backup).
# 1) Credit 40 entries to SIA00404  2) Remove 2 entries (SIA02069 62.50, SIA00477 125)
# Usage: ./run-credit-sia00404-spot-production.sh

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
echo "🚀 SIA00404 SPOT CREDIT ON PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Step 1: Checking Kubernetes access..."
export KUBECONFIG="$KUBECONFIG"
if [ ! -f "$KUBECONFIG" ]; then
    echo "❌ Kubeconfig not found: $KUBECONFIG"
    exit 1
fi
if ! kubectl get pod $POSTGRES_POD -n $NAMESPACE > /dev/null 2>&1; then
    echo "❌ Cannot access postgres pod"
    exit 1
fi
echo "✅ Kubernetes access confirmed"
echo ""

echo "Step 2: Getting production database password..."
DB_PASSWORD=$(kubectl get secret mlm-secrets -n $NAMESPACE -o jsonpath='{.data.DB_PASSWORD}' 2>/dev/null | base64 -d 2>/dev/null || echo "")
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD="mlm_password_prod_2024_secure"
fi
echo "✅ Using credentials"
echo ""

echo "Step 3: Port forwarding localhost:$LOCAL_PORT -> $POSTGRES_POD:5432 ..."
lsof -ti:$LOCAL_PORT | xargs kill -9 2>/dev/null || true
sleep 1
kubectl port-forward -n $NAMESPACE $POSTGRES_POD $LOCAL_PORT:5432 > /tmp/kubectl-pf-sia00404-spot.log 2>&1 &
PF_PID=$!
sleep 3
if ! lsof -i :$LOCAL_PORT > /dev/null 2>&1; then
    echo "❌ Port forward failed. See /tmp/kubectl-pf-sia00404-spot.log"
    kill $PF_PID 2>/dev/null || true
    exit 1
fi
echo "✅ Port forward active (PID $PF_PID)"
echo ""

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${LOCAL_PORT}/${DB_NAME}?schema=public"

echo "Step 4: Running credit script (40 entries to SIA00404)..."
cd "$SCRIPT_DIR/.."
npx tsx scripts/credit-sia00404-spot-history-from-list.ts
CREDIT_EXIT=$?
if [ $CREDIT_EXIT -ne 0 ]; then
    kill $PF_PID 2>/dev/null || true
    exit $CREDIT_EXIT
fi
echo ""

echo "Step 5: Removing 2 entries (SIA02069 62.50, SIA00477 125)..."
npx tsx scripts/prod-remove-two-spot-sia00404.ts
REMOVE_EXIT=$?
echo ""

echo "Step 6: Cleaning up port forward..."
kill $PF_PID 2>/dev/null || true
sleep 1

if [ $REMOVE_EXIT -eq 0 ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SUCCESS: SIA00404 spot credited on production (38 entries, ₹5031.25)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ Remove script failed with exit $REMOVE_EXIT"
    exit $REMOVE_EXIT
fi
