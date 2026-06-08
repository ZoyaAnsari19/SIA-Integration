#!/bin/bash
# Test Reinvestment SPOT Commission Reduction
# Verifies that Level 2+ SPOT commissions are reduced to 50% on reinvestments
# Level 1 (direct referrer) always gets 100% SPOT commission

set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     REINVESTMENT SPOT COMMISSION REDUCTION TEST               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
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

# Step 3: Create packages
echo -e "${YELLOW}📦 Step 3: Creating packages...${NC}"
PKG_RESP=$(curl -s -X POST "$API_BASE/admin/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-admin" \
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
echo -e "${GREEN}✅ Package created: ₹2,500 (ID=$PKG_ID)${NC}"
echo ""

# Step 4: Create test structure: Root → R1 → S1 → J1
echo -e "${YELLOW}👥 Step 4: Creating test structure (Root → R1 → S1 → J1)...${NC}"

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

sleep 5

# Step 5: Make Root eligible for Level 2
echo -e "${YELLOW}📈 Step 5: Making Root eligible for Level 2...${NC}"
for i in 1 2; do
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
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  echo "   ✅ RootLeg$i purchased"
done
echo ""

sleep 5

# Step 6: J1 makes FIRST purchase (₹2,500)
echo -e "${YELLOW}💰 Step 6: J1 makes FIRST purchase (₹2,500)...${NC}"
J1_PURCHASE1=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $J1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
J1_PURCHASE1_ID=$(echo "$J1_PURCHASE1" | jq -r '.purchase.id')
echo -e "${GREEN}✅ J1 First Purchase ID: $J1_PURCHASE1_ID${NC}"
echo ""

sleep 5

# Step 7: Check SPOT commissions from FIRST purchase
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FIRST PURCHASE SPOT COMMISSIONS (Should be 100%)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "S1 (Level 1 - Direct Referrer) SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  amount::numeric(10,2),
  (metadata->>'is_reinvestment')::boolean as is_reinvestment
FROM ledger_entries 
WHERE receiver_user_id = $S1_ID 
  AND commission_type = 'SPOT'
  AND purchase_id = $J1_PURCHASE1_ID;
"
echo ""

echo "R1 (Level 2) SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  amount::numeric(10,2),
  (metadata->>'is_reinvestment')::boolean as is_reinvestment
FROM ledger_entries 
WHERE receiver_user_id = $R1_ID 
  AND commission_type = 'SPOT'
  AND purchase_id = $J1_PURCHASE1_ID;
"
echo ""

echo "Root (Level 3) SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  amount::numeric(10,2),
  (metadata->>'is_reinvestment')::boolean as is_reinvestment
FROM ledger_entries 
WHERE receiver_user_id = $ROOT_ID 
  AND commission_type = 'SPOT'
  AND purchase_id = $J1_PURCHASE1_ID;
"
echo ""

# Expected: S1 gets 5% of ₹2,500 = ₹125 (100%)
# Expected: R1 gets Level 2 SPOT (check commission_rules for Level 2 percent)
# Expected: Root gets Level 3 SPOT (check commission_rules for Level 3 percent)

# Step 8: J1 makes SECOND purchase (REINVESTMENT - ₹2,500)
echo -e "${YELLOW}💰 Step 8: J1 makes SECOND purchase - REINVESTMENT (₹2,500)...${NC}"
J1_PURCHASE2=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $J1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
J1_PURCHASE2_ID=$(echo "$J1_PURCHASE2" | jq -r '.purchase.id')
echo -e "${GREEN}✅ J1 Second Purchase ID: $J1_PURCHASE2_ID${NC}"
echo ""

sleep 5

# Step 9: Check SPOT commissions from SECOND purchase (REINVESTMENT)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 REINVESTMENT SPOT COMMISSIONS (Level 1=100%, Level 2+=50%)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "S1 (Level 1 - Direct Referrer) SPOT - Should be 100%:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  amount::numeric(10,2),
  (metadata->>'is_reinvestment')::boolean as is_reinvestment
FROM ledger_entries 
WHERE receiver_user_id = $S1_ID 
  AND commission_type = 'SPOT'
  AND purchase_id = $J1_PURCHASE2_ID;
"
echo ""

echo "R1 (Level 2) SPOT - Should be 50%:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  amount::numeric(10,2),
  (metadata->>'is_reinvestment')::boolean as is_reinvestment
FROM ledger_entries 
WHERE receiver_user_id = $R1_ID 
  AND commission_type = 'SPOT'
  AND purchase_id = $J1_PURCHASE2_ID;
"
echo ""

echo "Root (Level 3) SPOT - Should be 50%:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  amount::numeric(10,2),
  (metadata->>'is_reinvestment')::boolean as is_reinvestment
FROM ledger_entries 
WHERE receiver_user_id = $ROOT_ID 
  AND commission_type = 'SPOT'
  AND purchase_id = $J1_PURCHASE2_ID;
"
echo ""

# Step 10: Verify commission rules to calculate expected amounts
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 COMMISSION RULES${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  level,
  percent,
  type
FROM commission_rules 
WHERE type = 'LEVEL_SPOT' 
  AND level IN (1, 2, 3)
ORDER BY level;
"
echo ""

# Step 11: Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "First Purchase (₹2,500):"
echo "  ✅ S1 (Level 1): Should get 100% SPOT commission"
echo "  ✅ R1 (Level 2): Should get 100% SPOT commission"
echo "  ✅ Root (Level 3): Should get 100% SPOT commission"
echo ""

echo "Second Purchase - REINVESTMENT (₹2,500):"
echo "  ✅ S1 (Level 1): Should get 100% SPOT commission (NO reduction)"
echo "  ✅ R1 (Level 2): Should get 50% SPOT commission (50% reduction)"
echo "  ✅ Root (Level 3): Should get 50% SPOT commission (50% reduction)"
echo ""

echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""


