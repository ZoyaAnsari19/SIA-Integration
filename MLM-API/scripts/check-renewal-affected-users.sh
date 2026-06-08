#!/bin/bash

# Script to check affected users from renewal commission issue
# Issue: Renewals were incorrectly treated as reinvestments (50% reduction instead of 100%)

KUBECONFIG="${KUBECONFIG:-./azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Checking Affected Users from Renewal Commission Issue"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1. Total Renewal Purchases:"
kubectl exec postgres-0 -n mlm -- psql -U mlm_user -d mlm_commission -c "
SELECT 
    COUNT(DISTINCT user_id) as total_renewal_users, 
    COUNT(*) as total_renewal_purchases 
FROM purchases 
WHERE is_renewal = true AND status = 'completed';
"

echo ""
echo "2. Affected Uplines (Level 1+) who got 50% reduction on renewals:"
kubectl exec postgres-0 -n mlm -- psql -U mlm_user -d mlm_commission -c "
SELECT 
    COUNT(DISTINCT le.receiver_user_id) as affected_uplines,
    COUNT(*) as affected_commissions
FROM ledger_entries le
INNER JOIN purchases p ON le.purchase_id = p.id
WHERE p.is_renewal = true 
  AND le.commission_type = 'MONTHLY'
  AND le.level > 0
  AND (le.metadata::jsonb->>'is_reinvestment')::text = 'true';
"

echo ""
echo "3. Total Shortfall Amount (50% that was incorrectly deducted):"
kubectl exec postgres-0 -n mlm -- psql -U mlm_user -d mlm_commission -c "
SELECT 
    COUNT(DISTINCT le.receiver_user_id) as affected_users,
    COUNT(*) as affected_commissions,
    ROUND(SUM(ABS(le.amount))::numeric, 2) as total_shortfall_amount
FROM ledger_entries le
INNER JOIN purchases p ON le.purchase_id = p.id
WHERE p.is_renewal = true 
  AND le.commission_type = 'MONTHLY'
  AND le.level > 0
  AND (le.metadata::jsonb->>'is_reinvestment')::text = 'true';
"

echo ""
echo "4. Sample Affected Users (Top 10):"
kubectl exec postgres-0 -n mlm -- psql -U mlm_user -d mlm_commission -c "
SELECT 
    u.display_id,
    u.name,
    COUNT(*) as affected_commissions,
    ROUND(SUM(ABS(le.amount))::numeric, 2) as total_shortfall
FROM ledger_entries le
INNER JOIN purchases p ON le.purchase_id = p.id
INNER JOIN users u ON le.receiver_user_id = u.id
WHERE p.is_renewal = true 
  AND le.commission_type = 'MONTHLY'
  AND le.level > 0
  AND (le.metadata::jsonb->>'is_reinvestment')::text = 'true'
GROUP BY u.id, u.display_id, u.name
ORDER BY total_shortfall DESC
LIMIT 10;
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Analysis Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

