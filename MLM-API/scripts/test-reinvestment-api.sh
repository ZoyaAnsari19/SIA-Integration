#!/bin/bash
# Reinvestment Test via API: First Purchase vs Reinvestment
# Tests SPOT commission reduction (50% for Level 2+ on reinvestment)
# Level 1 always gets 100% on reinvestment

set -e

API_BASE="http://localhost:3000/api/v1"
ADMIN_TOKEN="dev-admin"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  REINVESTMENT TEST VIA API: FIRST PURCHASE vs REINVESTMENT   ║"
echo "║  Testing SPOT Commission Reduction (50% for Level 2+)       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Clean database
echo -e "${YELLOW}🧹 Step 1: Cleaning database...${NC}"
docker compose exec db psql -U postgres -d mlm -c "
TRUNCATE TABLE 
  wallet_transactions, 
  ledger_entries, 
  scheduled_commissions, 
  pending_commissions, 
  level_eligibility, 
  user_balances, 
  purchases, 
  user_tree_paths, 
  users, 
  packages 
RESTART IDENTITY CASCADE;
" > /dev/null
echo -e "${GREEN}✅ Database cleaned${NC}"
echo ""

# Step 2: Set business requirements
echo -e "${YELLOW}📋 Step 2: Setting business requirements...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels SET business_requirement = '{\"required_leg_count\": 1, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 1;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 2;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 3, \"required_leg_min_amount\": 10000}'::jsonb WHERE level = 3;
" > /dev/null
echo -e "${GREEN}✅ Business requirements set${NC}"
echo ""

# Step 3: Create package via API
echo -e "${YELLOW}📦 Step 3: Creating ₹2,500 package via API...${NC}"
PKG_RESP=$(curl -s -X POST "$API_BASE/admin/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name":"₹2,500 Course",
    "price":2500,
    "validity_months":13,
    "self_monthly":62.50,
    "global_ids":55,
    "global_monthly_per_id":6.25,
    "recurring_rate_percent":0.5
  }')
PKG_ID=$(echo "$PKG_RESP" | jq -r '.id')
echo -e "${GREEN}✅ Package created: ID=$PKG_ID${NC}"
echo ""

# Step 4: Create structure: Root → R1 → S1 → J1
echo -e "${YELLOW}👥 Step 4: Creating structure (Root → R1 → S1 → J1) via API...${NC}"

# Register Root
ROOT_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Root","email":"root@test.com"}')
ROOT_ID=$(echo "$ROOT_RESP" | jq -r '.id')
ROOT_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"root@test.com"}')
ROOT_TOKEN=$(echo "$ROOT_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ROOT_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 2
echo -e "${GREEN}✅ Root ID: $ROOT_ID${NC}"

# Register R1 under Root
R1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"R1\",\"email\":\"r1@test.com\",\"referrer_user_id\":$ROOT_ID}")
R1_ID=$(echo "$R1_RESP" | jq -r '.id')
R1_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"r1@test.com"}')
R1_TOKEN=$(echo "$R1_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $R1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 2
echo -e "${GREEN}✅ R1 ID: $R1_ID${NC}"

# Register S1 under R1
S1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"S1\",\"email\":\"s1@test.com\",\"referrer_user_id\":$R1_ID}")
S1_ID=$(echo "$S1_RESP" | jq -r '.id')
S1_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"s1@test.com"}')
S1_TOKEN=$(echo "$S1_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $S1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 2
echo -e "${GREEN}✅ S1 ID: $S1_ID${NC}"

# Register J1 under S1
J1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"J1\",\"email\":\"j1@test.com\",\"referrer_user_id\":$S1_ID}")
J1_ID=$(echo "$J1_RESP" | jq -r '.id')
J1_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"j1@test.com"}')
J1_TOKEN=$(echo "$J1_LOGIN" | jq -r '.token')
echo -e "${GREEN}✅ J1 ID: $J1_ID${NC}"
echo ""

# Step 5: Qualify uplines for their levels
echo -e "${YELLOW}📈 Step 5: Qualifying uplines for their levels...${NC}"

# Create ₹5,000 package
PKG_5K_RESP=$(curl -s -X POST "$API_BASE/admin/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name":"₹5,000 Course",
    "price":5000,
    "validity_months":13,
    "self_monthly":125.00,
    "global_ids":55,
    "global_monthly_per_id":12.50,
    "recurring_rate_percent":0.5
  }')
PKG_5K_ID=$(echo "$PKG_5K_RESP" | jq -r '.id')

# Qualify Root for Level 2 (needs 2 legs with ₹5,000 each)
for i in 2 3; do
  LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"RootLeg$i\",\"email\":\"rootleg$i@test.com\",\"referrer_user_id\":$ROOT_ID}")
  LEG_ID=$(echo "$LEG_RESP" | jq -r '.id')
  LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"rootleg$i@test.com\"}")
  LEG_TOKEN=$(echo "$LEG_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LEG_TOKEN" \
    -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
  sleep 2
done

# Trigger eligibility recalculation
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' > /dev/null
sleep 3
echo -e "${GREEN}✅ Uplines qualified${NC}"
echo ""

# Step 6: J1 makes FIRST purchase
echo -e "${YELLOW}💰 Step 6: J1 makes FIRST purchase (₹2,500) via API...${NC}"
J1_PURCHASE1=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $J1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
J1_PURCHASE1_ID=$(echo "$J1_PURCHASE1" | jq -r '.purchase.id')
sleep 3
echo -e "${GREEN}✅ J1 First Purchase ID: $J1_PURCHASE1_ID${NC}"
echo ""

# Step 7: J1 makes SECOND purchase (REINVESTMENT)
echo -e "${YELLOW}💰 Step 7: J1 makes SECOND purchase - REINVESTMENT (₹2,500) via API...${NC}"
J1_PURCHASE2=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $J1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
J1_PURCHASE2_ID=$(echo "$J1_PURCHASE2" | jq -r '.purchase.id')
sleep 3
echo -e "${GREEN}✅ J1 Second Purchase ID: $J1_PURCHASE2_ID${NC}"
echo ""

# Step 8: Final eligibility recalculation
echo -e "${YELLOW}🔄 Step 8: Final eligibility recalculation...${NC}"
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' > /dev/null
sleep 3
echo -e "${GREEN}✅ Eligibility recalculated${NC}"
echo ""

# Step 9: Comprehensive Comparison Table
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 COMPREHENSIVE REINVESTMENT COMPARISON TABLE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

docker compose exec -T db psql -U postgres -d mlm -c "
WITH first_purchase AS (
  SELECT 
    receiver_user_id,
    (metadata->>'level')::int as level,
    amount as first_amount,
    purchase_id
  FROM ledger_entries
  WHERE purchase_id = $J1_PURCHASE1_ID 
    AND commission_type = 'SPOT'
),
reinvestment AS (
  SELECT 
    receiver_user_id,
    (metadata->>'level')::int as level,
    amount as reinvestment_amount,
    (metadata->>'is_reinvestment')::boolean as is_reinvestment,
    purchase_id
  FROM ledger_entries
  WHERE purchase_id = $J1_PURCHASE2_ID 
    AND commission_type = 'SPOT'
),
combined AS (
  SELECT 
    COALESCE(fp.receiver_user_id, ri.receiver_user_id) as user_id,
    COALESCE(fp.level, ri.level) as level,
    COALESCE(fp.first_amount, 0)::numeric(10,2) as first_purchase_amount,
    COALESCE(ri.reinvestment_amount, 0)::numeric(10,2) as reinvestment_amount,
    COALESCE(ri.is_reinvestment, false) as is_reinvestment,
    CASE 
      WHEN COALESCE(fp.level, ri.level) = 1 THEN '100% (No reduction)'
      WHEN ri.reinvestment_amount > 0 AND fp.first_amount > 0 AND ri.reinvestment_amount = fp.first_amount * 0.5 THEN '50% ✅'
      WHEN ri.reinvestment_amount = fp.first_amount THEN '100% (Check)'
      WHEN fp.first_amount = 0 AND ri.reinvestment_amount > 0 THEN 'Reinvestment only'
      WHEN fp.first_amount > 0 AND ri.reinvestment_amount = 0 THEN 'First only'
      ELSE 'Check'
    END as reduction_status
  FROM first_purchase fp
  FULL OUTER JOIN reinvestment ri ON ri.receiver_user_id = fp.receiver_user_id AND ri.level = fp.level
)
SELECT 
  u.name as \"Receiver\",
  c.level as \"Level\",
  c.first_purchase_amount as \"First Purchase (₹)\",
  c.reinvestment_amount as \"Reinvestment (₹)\",
  CASE 
    WHEN c.level = 1 THEN '100%'
    WHEN c.reinvestment_amount > 0 AND c.first_purchase_amount > 0 THEN 
      ROUND((c.reinvestment_amount / c.first_purchase_amount * 100)::numeric, 1)::text || '%'
    ELSE '-'
  END as \"Reduction %\",
  c.reduction_status as \"Status\"
FROM combined c
JOIN users u ON u.id = c.user_id
ORDER BY c.level, u.name;
"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 DETAILED BREAKDOWN BY USER${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}S1 (Level 1 - Direct Referrer) - Should get 100% on both:${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  CASE 
    WHEN p.id = $J1_PURCHASE1_ID THEN 'First Purchase'
    WHEN p.id = $J1_PURCHASE2_ID THEN 'Reinvestment'
  END as purchase_type,
  le.amount::numeric(10,2) as spot_amount,
  (le.metadata->>'is_reinvestment')::boolean as is_reinvestment,
  CASE 
    WHEN p.id = $J1_PURCHASE1_ID THEN 'Expected: ₹125.00 (5% of ₹2,500)'
    WHEN p.id = $J1_PURCHASE2_ID THEN 'Expected: ₹125.00 (5% of ₹2,500 - NO reduction)'
  END as expected
FROM ledger_entries le
JOIN purchases p ON p.id = le.purchase_id
WHERE le.receiver_user_id = $S1_ID
  AND le.commission_type = 'SPOT'
  AND (le.metadata->>'level')::int = 1
  AND p.id IN ($J1_PURCHASE1_ID, $J1_PURCHASE2_ID)
ORDER BY p.purchased_at;
"

echo ""
echo -e "${BLUE}R1 (Level 2) - Should get 50% on reinvestment:${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  CASE 
    WHEN p.id = $J1_PURCHASE1_ID THEN 'First Purchase'
    WHEN p.id = $J1_PURCHASE2_ID THEN 'Reinvestment'
  END as purchase_type,
  le.amount::numeric(10,2) as spot_amount,
  (le.metadata->>'is_reinvestment')::boolean as is_reinvestment,
  CASE 
    WHEN p.id = $J1_PURCHASE1_ID THEN 'Expected: ₹62.50 (2.5% of ₹2,500)'
    WHEN p.id = $J1_PURCHASE2_ID THEN 'Expected: ₹31.25 (2.5% × 50% = 50% reduction)'
  END as expected
FROM ledger_entries le
JOIN purchases p ON p.id = le.purchase_id
WHERE le.receiver_user_id = $R1_ID
  AND le.commission_type = 'SPOT'
  AND (le.metadata->>'level')::int = 2
  AND p.id IN ($J1_PURCHASE1_ID, $J1_PURCHASE2_ID)
ORDER BY p.purchased_at;
"

echo ""
echo -e "${BLUE}Root (Level 3) - Should get 50% on reinvestment:${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  CASE 
    WHEN p.id = $J1_PURCHASE1_ID THEN 'First Purchase'
    WHEN p.id = $J1_PURCHASE2_ID THEN 'Reinvestment'
  END as purchase_type,
  le.amount::numeric(10,2) as spot_amount,
  (le.metadata->>'is_reinvestment')::boolean as is_reinvestment,
  CASE 
    WHEN p.id = $J1_PURCHASE1_ID THEN 'Expected: ₹50.00 (2.0% of ₹2,500)'
    WHEN p.id = $J1_PURCHASE2_ID THEN 'Expected: ₹25.00 (2.0% × 50% = 50% reduction)'
  END as expected
FROM ledger_entries le
JOIN purchases p ON p.id = le.purchase_id
WHERE le.receiver_user_id = $ROOT_ID
  AND le.commission_type = 'SPOT'
  AND (le.metadata->>'level')::int = 3
  AND p.id IN ($J1_PURCHASE1_ID, $J1_PURCHASE2_ID)
ORDER BY p.purchased_at;
"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 WALLET BALANCE SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  u.name as \"User\",
  COALESCE(ub.balance, 0)::numeric(10,2) as \"Wallet Balance\",
  (SELECT COUNT(*) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $J1_PURCHASE1_ID) as \"First Purchase SPOT\",
  (SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $J1_PURCHASE1_ID) as \"First Purchase Amount\",
  (SELECT COUNT(*) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $J1_PURCHASE2_ID) as \"Reinvestment SPOT\",
  (SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $J1_PURCHASE2_ID) as \"Reinvestment Amount\"
FROM users u
LEFT JOIN user_balances ub ON ub.user_id = u.id
WHERE u.name IN ('S1', 'R1', 'Root', 'J1')
ORDER BY 
  CASE u.name
    WHEN 'S1' THEN 1
    WHEN 'R1' THEN 2
    WHEN 'Root' THEN 3
    WHEN 'J1' THEN 4
  END;
"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}✅ TEST COMPLETE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Expected Results:"
echo "  ✅ S1 (Level 1): ₹125.00 on first purchase, ₹125.00 on reinvestment (100% - NO reduction)"
echo "  ✅ R1 (Level 2): ₹62.50 on first purchase, ₹31.25 on reinvestment (50% reduction)"
echo "  ✅ Root (Level 3): ₹50.00 on first purchase, ₹25.00 on reinvestment (50% reduction)"
echo ""

