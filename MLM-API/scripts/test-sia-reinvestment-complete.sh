#!/bin/bash
# Complete Test: SIA Rules - First Purchase vs Reinvestment
# Tests Mukesh scenario with proper comparison table

set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  SIA RULES TEST - FIRST PURCHASE vs REINVESTMENT             ║"
echo "║  Mukesh → R1/R2/R3 → S1/S2/S3 → J1/J2/J3 → K1/K2/K3        ║"
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

# Step 2: Seed SIA levels and commission rules
echo -e "${YELLOW}📋 Step 2: Seeding SIA levels and commission rules...${NC}"
./scripts/seed-sia-levels-rules.sh > /dev/null 2>&1
echo -e "${GREEN}✅ SIA rules seeded${NC}"
echo ""

# Step 3: Set business requirements
echo -e "${YELLOW}📋 Step 3: Setting business requirements...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels SET business_requirement = '{\"required_leg_count\": 1, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 1;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 2;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 3, \"required_leg_min_amount\": 10000}'::jsonb WHERE level = 3;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 4, \"required_leg_min_amount\": 15000}'::jsonb WHERE level = 4;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 5, \"required_leg_min_amount\": 20000}'::jsonb WHERE level = 5;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 6, \"required_leg_min_amount\": 25000}'::jsonb WHERE level = 6;
" > /dev/null
echo -e "${GREEN}✅ Business requirements set${NC}"
echo ""

# Step 4: Create package (₹5 Lakh for example, but we'll use ₹2,500 for testing)
echo -e "${YELLOW}📦 Step 4: Creating package...${NC}"
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

# Step 5: Create Mukesh structure
echo -e "${YELLOW}👥 Step 5: Creating Mukesh structure...${NC}"

# Register Mukesh
MUKESH_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mukesh","email":"mukesh@test.com"}')
MUKESH_ID=$(echo "$MUKESH_RESP" | jq -r '.id')
MUKESH_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mukesh@test.com"}')
MUKESH_TOKEN=$(echo "$MUKESH_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MUKESH_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
echo -e "${GREEN}✅ Mukesh ID: $MUKESH_ID${NC}"

# Register R1, R2, R3
for i in 1 2 3; do
  R_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"R$i\",\"email\":\"r$i@test.com\",\"referrer_user_id\":$MUKESH_ID}")
  R_ID=$(echo "$R_RESP" | jq -r '.id')
  R_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"r$i@test.com\"}")
  R_TOKEN=$(echo "$R_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $R_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  if [ $i -eq 1 ]; then
    R1_ID=$R_ID
    R1_TOKEN=$R_TOKEN
  fi
  echo -e "${GREEN}✅ R$i ID: $R_ID${NC}"
done

sleep 5

# Register S1, S2, S3 under R1
for i in 1 2 3; do
  S_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"S$i\",\"email\":\"s$i@test.com\",\"referrer_user_id\":$R1_ID}")
  S_ID=$(echo "$S_RESP" | jq -r '.id')
  S_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"s$i@test.com\"}")
  S_TOKEN=$(echo "$S_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $S_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  if [ $i -eq 1 ]; then
    S1_ID=$S_ID
    S1_TOKEN=$S_TOKEN
  fi
  echo -e "${GREEN}✅ S$i ID: $S_ID${NC}"
done

sleep 5

# Register J1, J2, J3 under S1
for i in 1 2 3; do
  J_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"J$i\",\"email\":\"j$i@test.com\",\"referrer_user_id\":$S1_ID}")
  J_ID=$(echo "$J_RESP" | jq -r '.id')
  J_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"j$i@test.com\"}")
  J_TOKEN=$(echo "$J_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $J_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  if [ $i -eq 1 ]; then
    J1_ID=$J_ID
    J1_TOKEN=$J_TOKEN
  fi
  echo -e "${GREEN}✅ J$i ID: $J_ID${NC}"
done

sleep 5

# Register K1, K2, K3 under J1
for i in 1 2 3; do
  K_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"K$i\",\"email\":\"k$i@test.com\",\"referrer_user_id\":$J1_ID}")
  K_ID=$(echo "$K_RESP" | jq -r '.id')
  K_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"k$i@test.com\"}")
  K_TOKEN=$(echo "$K_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $K_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  if [ $i -eq 1 ]; then
    K1_ID=$K_ID
    K1_TOKEN=$K_TOKEN
  fi
  echo -e "${GREEN}✅ K$i ID: $K_ID${NC}"
done

sleep 5

# Step 6: Make Mukesh eligible for Level 2
echo -e "${YELLOW}📈 Step 6: Making Mukesh eligible for Level 2...${NC}"
for i in 4 5; do
  LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"MukeshLeg$i\",\"email\":\"mukeshleg$i@test.com\",\"referrer_user_id\":$MUKESH_ID}")
  LEG_ID=$(echo "$LEG_RESP" | jq -r '.id')
  LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"mukeshleg$i@test.com\"}")
  LEG_TOKEN=$(echo "$LEG_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LEG_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
done
echo ""

sleep 5

# Step 7: Make R1 eligible for Level 3
echo -e "${YELLOW}📈 Step 7: Making R1 eligible for Level 3...${NC}"
# R1 already has S1, S2, S3. Need to add more to S2 and S3 legs
S2_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM users WHERE name = 'S2' LIMIT 1;" | tr -d ' ')
S3_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM users WHERE name = 'S3' LIMIT 1;" | tr -d ' ')

for i in 1 2 3 4; do
  S2_LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"S2Leg$i\",\"email\":\"s2leg$i@test.com\",\"referrer_user_id\":$S2_ID}")
  S2_LEG_ID=$(echo "$S2_LEG_RESP" | jq -r '.id')
  S2_LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"s2leg$i@test.com\"}")
  S2_LEG_TOKEN=$(echo "$S2_LEG_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $S2_LEG_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
done

for i in 1 2 3 4; do
  S3_LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"S3Leg$i\",\"email\":\"s3leg$i@test.com\",\"referrer_user_id\":$S3_ID}")
  S3_LEG_ID=$(echo "$S3_LEG_RESP" | jq -r '.id')
  S3_LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"s3leg$i@test.com\"}")
  S3_LEG_TOKEN=$(echo "$S3_LEG_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $S3_LEG_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
done
echo ""

sleep 5

# Step 8: Make S1 eligible for Level 2
echo -e "${YELLOW}📈 Step 8: Making S1 eligible for Level 2...${NC}"
for i in 4 5; do
  S1_LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"S1Leg$i\",\"email\":\"s1leg$i@test.com\",\"referrer_user_id\":$S1_ID}")
  S1_LEG_ID=$(echo "$S1_LEG_RESP" | jq -r '.id')
  S1_LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"s1leg$i@test.com\"}")
  S1_LEG_TOKEN=$(echo "$S1_LEG_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $S1_LEG_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
done
echo ""

sleep 5

# Step 9: K1 makes FIRST purchase (K1 already has 1 purchase from registration, so this is actually the 2nd)
# But we need to make sure K1 has only 1 purchase before this step
echo -e "${YELLOW}💰 Step 9: K1 makes FIRST purchase (₹2,500)...${NC}"
# Delete K1's existing purchase to start fresh
docker compose exec -T db psql -U postgres -d mlm -c "DELETE FROM purchases WHERE user_id = $K1_ID;" > /dev/null
sleep 2
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $K1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 5
K1_PURCHASE1_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM purchases WHERE user_id = $K1_ID ORDER BY purchased_at ASC LIMIT 1;" | tr -d ' ')
echo -e "${GREEN}✅ K1 First Purchase ID: $K1_PURCHASE1_ID${NC}"
echo ""

sleep 5

# Step 10: K1 makes SECOND purchase (REINVESTMENT)
echo -e "${YELLOW}💰 Step 10: K1 makes SECOND purchase - REINVESTMENT (₹2,500)...${NC}"
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $K1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 5
K1_PURCHASE2_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM purchases WHERE user_id = $K1_ID ORDER BY purchased_at DESC LIMIT 1;" | tr -d ' ')
echo -e "${GREEN}✅ K1 Second Purchase ID: $K1_PURCHASE2_ID${NC}"
echo ""

sleep 5

# Step 11: Comprehensive Results Table
echo -e "${CYAN}════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════OT Commission Rules${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  level,
  percent as spot_percent,
  'LEVEL_SPOT' as type
FROM commission_rules 
WHERE type = 'LEVEL_SPOT' 
  AND level BETWEEN 1 AND 6
ORDER BY level;
"
echo ""

# Step 12: First Purchase Results
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FIRST PURCHASE RESULTS (100% SPOT for all levels)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

K1_PURCHASE1_ID_DB=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM purchases WHERE user_id = (SELECT id FROM users WHERE name = 'K1') ORDER BY purchased_at ASC LIMIT 1;" | tr -d ' ')

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  u.name,
  COALESCE(ub.balance, 0)::numeric(10,2) as wallet,
  (SELECT COUNT(*) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $K1_PURCHASE1_ID_DB) as spot_credited,
  (SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $K1_PURCHASE1_ID_DB) as spot_total,
  (SELECT COUNT(*) FROM pending_commissions WHERE receiver_user_id = u.id AND purchase_id = $K1_PURCHASE1_ID_DB) as spot_pending,
  (SELECT SUM(amount)::numeric(10,2) FROM pending_commissions WHERE receiver_user_id = u.id AND purchase_id = $K1_PURCHASE1_ID_DB) as pending_total
FROM users u
LEFT JOIN user_balances ub ON ub.user_id = u.id
WHERE u.name IN ('Mukesh', 'R1', 'R2', 'R3', 'S1', 'S2', 'S3', 'J1', 'J2', 'J3', 'K1', 'K2', 'K3')
ORDER BY u.id;
"
echo ""

# Step 13: Reinvestment Results
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 REINVESTMENT RESULTS (L1=100%, L2+=50%)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

K1_PURCHASE2_ID_DB=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM purchases WHERE user_id = (SELECT id FROM users WHERE name = 'K1') ORDER BY purchased_at DESC LIMIT 1;" | tr -d ' ')

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  u.name,
  COALESCE(ub.balance, 0)::numeric(10,2) as wallet,
  (SELECT COUNT(*) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $K1_PURCHASE2_ID_DB) as spot_credited,
  (SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT' AND purchase_id = $K1_PURCHASE2_ID_DB) as spot_total,
  (SELECT COUNT(*) FROM pending_commissions WHERE receiver_user_id = u.id AND purchase_id = $K1_PURCHASE2_ID_DB) as spot_pending,
  (SELECT SUM(amount)::numeric(10,2) FROM pending_commissions WHERE receiver_user_id = u.id AND purchase_id = $K1_PURCHASE2_ID_DB) as pending_total
FROM users u
LEFT JOIN user_balances ub ON ub.user_id = u.id
WHERE u.name IN ('Mukesh', 'R1', 'R2', 'R3', 'S1', 'S2', 'S3', 'J1', 'J2', 'J3', 'K1', 'K2', 'K3')
ORDER BY u.id;
"
echo ""

# Step 14: Detailed Comparison Table
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 DETAILED COMPARISON: FIRST PURCHASE vs REINVESTMENT${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

docker compose exec -T db psql -U postgres -d mlm -c "
WITH k1_purchases AS (
  SELECT id, purchased_at,
    ROW_NUMBER() OVER (ORDER BY purchased_at) as purchase_num
  FROM purchases 
  WHERE user_id = (SELECT id FROM users WHERE name = 'K1')
),
first_purchase AS (
  SELECT 
    receiver_user_id,
    (metadata->>'level')::int as level,
    amount as first_amount,
    'credited' as status
  FROM ledger_entries 
  WHERE purchase_id = (SELECT id FROM k1_purchases WHERE purchase_num = 1) AND commission_type = 'SPOT'
  UNION ALL
  SELECT 
    receiver_user_id,
    level,
    amount as first_amount,
    'pending' as status
  FROM pending_commissions 
  WHERE purchase_id = (SELECT id FROM k1_purchases WHERE purchase_num = 1)
),
reinvestment AS (
  SELECT 
    receiver_user_id,
    (metadata->>'level')::int as level,
    amount as reinvestment_amount,
    (metadata->>'is_reinvestment')::boolean as is_reinvestment,
    'credited' as status
  FROM ledger_entries 
  WHERE purchase_id = (SELECT id FROM k1_purchases WHERE purchase_num = 2) AND commission_type = 'SPOT'
  UNION ALL
  SELECT 
    receiver_user_id,
    level,
    amount as reinvestment_amount,
    (metadata->>'is_reinvestment')::boolean as is_reinvestment,
    'pending' as status
  FROM pending_commissions 
  WHERE purchase_id = (SELECT id FROM k1_purchases WHERE purchase_num = 2)
)
SELECT 
  u.name,
  COALESCE(fp.level, ri.level) as level,
  COALESCE(fp.first_amount, 0)::numeric(10,2) as first_purchase_amount,
  COALESCE(ri.reinvestment_amount, 0)::numeric(10,2) as reinvestment_amount,
  CASE 
    WHEN COALESCE(fp.level, ri.level) = 1 THEN '100% (No reduction)'
    WHEN ri.reinvestment_amount = fp.first_amount * 0.5 THEN '50% ✅'
    WHEN fp.first_amount = 0 AND ri.reinvestment_amount > 0 THEN 'Reinvestment only'
    WHEN fp.first_amount > 0 AND ri.reinvestment_amount = 0 THEN 'First only (pending)'
    ELSE 'Check'
  END as reduction_status
FROM first_purchase fp
FULL OUTER JOIN reinvestment ri ON ri.receiver_user_id = fp.receiver_user_id AND ri.level = fp.level
JOIN users u ON u.id = COALESCE(fp.receiver_user_id, ri.receiver_user_id)
WHERE u.name IN ('Mukesh', 'R1', 'R2', 'R3', 'S1', 'S2', 'S3', 'J1', 'J2', 'J3', 'K1', 'K2', 'K3')
ORDER BY COALESCE(fp.level, ri.level), u.name;
"
echo ""

# Step 15: Final Summary Table
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FINAL SUMMARY TABLE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  u.name as \"User\",
  CASE 
    WHEN u.name = 'Mukesh' THEN 'Level 2'
    WHEN u.name = 'R1' THEN 'Level 3'
    WHEN u.name = 'S1' THEN 'Level 2'
    WHEN u.name IN ('R2', 'R3', 'S2', 'S3', 'J1') THEN 'Level 1'
    ELSE 'No Level'
  END as \"Qualified Level\",
  COALESCE(ub.balance, 0)::numeric(10,2) as \"Wallet\",
  (SELECT COUNT(*) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT') as \"SPOT Credited\",
  (SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = u.id AND commission_type = 'SPOT') as \"SPOT Total\",
  (SELECT COUNT(*) FROM pending_commissions WHERE receiver_user_id = u.id) as \"Pending Count\",
  (SELECT SUM(amount)::numeric(10,2) FROM pending_commissions WHERE receiver_user_id = u.id) as \"Pending Total\"
FROM users u
LEFT JOIN user_balances ub ON ub.user_id = u.id
WHERE u.name IN ('Mukesh', 'R1', 'R2', 'R3', 'S1', 'S2', 'S3', 'J1', 'J2', 'J3', 'K1', 'K2', 'K3')
ORDER BY u.id;
"
echo ""

echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""

