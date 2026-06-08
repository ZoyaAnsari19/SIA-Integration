#!/bin/bash
# Complete Test Scenario: Mukesh → R1/R2/R3 → S1/S2/S3 → J1/J2/J3 → K1/K2/K3
# Tests SPOT commission flow at all levels with qualification

set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     COMPLETE SCENARIO TEST: MUKESH TO K1/K2/K3                ║"
echo "║     Testing SPOT Commission at All Levels                      ║"
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

# Step 2: Set business requirements for all levels
echo -e "${YELLOW}📋 Step 2: Setting business requirements for all levels...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels SET business_requirement = '{\"required_leg_count\": 1, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 1;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 2;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 3;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 4;
" > /dev/null
echo -e "${GREEN}✅ Business requirements set${NC}"
echo ""

# Step 3: Create package
echo -e "${YELLOW}📦 Step 3: Creating ₹2,500 course package...${NC}"
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
echo -e "${GREEN}✅ Package created: ID=$PKG_ID${NC}"
echo ""

# Step 4: Register Mukesh (Root)
echo -e "${YELLOW}👤 Step 4: Registering Mukesh (Root)...${NC}"
MUKESH_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mukesh","email":"mukesh@test.com"}')
MUKESH_ID=$(echo "$MUKESH_RESP" | jq -r '.id')

MUKESH_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mukesh@test.com"}')
MUKESH_TOKEN=$(echo "$MUKESH_LOGIN" | jq -r '.token')

# Mukesh purchases
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MUKESH_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
echo -e "${GREEN}✅ Mukesh ID: $MUKESH_ID (purchased)${NC}"
echo ""

# Step 5: Register R1, R2, R3 (Level 1 for Mukesh - Direct Referrals)
echo -e "${YELLOW}👥 Step 5: Registering R1, R2, R3 (Level 1 - Direct Referrals)...${NC}"
R1_ID=""
R2_ID=""
R3_ID=""
R1_TOKEN=""
R2_TOKEN=""
R3_TOKEN=""

for i in 1 2 3; do
  R_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"R$i\",\"email\":\"r$i@test.com\",\"referrer_user_id\":$MUKESH_ID}")
  R_ID=$(echo "$R_RESP" | jq -r '.id')
  
  R_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"r$i@test.com\"}")
  R_TOKEN=$(echo "$R_LOGIN" | jq -r '.token')
  
  # Store in variables
  eval "R${i}_ID=$R_ID"
  eval "R${i}_TOKEN=$R_TOKEN"
  
  # R purchases
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $R_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  echo -e "${GREEN}✅ R$i ID: $R_ID (purchased)${NC}"
done
echo ""

# Wait for commission processing
sleep 5

# Check Level 1 SPOT for Mukesh (should be credited immediately)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 Checking Level 1 SPOT for Mukesh (should be credited immediately)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
LEVEL1_SPOT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT SUM(amount)::numeric(10,2) FROM ledger_entries 
WHERE receiver_user_id = $MUKESH_ID 
  AND commission_type = 'SPOT' 
  AND (metadata->>'level')::int = 1;
" | tr -d ' ')

LEVEL1_COUNT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM ledger_entries 
WHERE receiver_user_id = $MUKESH_ID 
  AND commission_type = 'SPOT' 
  AND (metadata->>'level')::int = 1;
" | tr -d ' ')

echo "Level 1 SPOT: ₹$LEVEL1_SPOT ($LEVEL1_COUNT entries)"
echo "Expected: ₹375.00 (3 × ₹125 = 5% of ₹2500)"
if [ "$LEVEL1_SPOT" = "375.00" ]; then
  echo -e "${GREEN}✅ Level 1 SPOT correctly credited immediately${NC}"
else
  echo -e "${RED}❌ Level 1 SPOT mismatch${NC}"
fi
echo ""

# Step 6: Register S1, S2, S3 under R1 (Level 2 for Mukesh)
echo -e "${YELLOW}👥 Step 6: Registering S1, S2, S3 under R1 (Level 2 for Mukesh)...${NC}"
S1_ID=""
S2_ID=""
S3_ID=""
S1_TOKEN=""
S2_TOKEN=""
S3_TOKEN=""

for i in 1 2 3; do
  S_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"S$i\",\"email\":\"s$i@test.com\",\"referrer_user_id\":$R1_ID}")
  S_ID=$(echo "$S_RESP" | jq -r '.id')
  
  S_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"s$i@test.com\"}")
  S_TOKEN=$(echo "$S_LOGIN" | jq -r '.token')
  
  # Store in variables
  eval "S${i}_ID=$S_ID"
  eval "S${i}_TOKEN=$S_TOKEN"
  
  # S purchases
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $S_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  echo -e "${GREEN}✅ S$i ID: $S_ID (purchased)${NC}"
done
echo ""

sleep 5

# Check Level 2 SPOT for Mukesh (should be in pending - not qualified for Level 1 yet)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Checking Level 2 SPOT for Mukesh (should be in pending)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
LEVEL2_PENDING=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID AND level = 2;
" | tr -d ' ')

LEVEL2_PENDING_AMOUNT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT SUM(amount)::numeric(10,2) FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID AND level = 2;
" | tr -d ' ')

echo "Level 2 SPOT in pending: $LEVEL2_PENDING entries (₹$LEVEL2_PENDING_AMOUNT)"
echo "Expected: 3 entries (₹225.00 = 3 × ₹75 = 3% of ₹2500)"
if [ "$LEVEL2_PENDING" = "3" ]; then
  echo -e "${GREEN}✅ Level 2 SPOT correctly held in pending${NC}"
else
  echo -e "${RED}❌ Level 2 SPOT not in pending${NC}"
fi
echo ""

# Check Level 1 SPOT for R1 (should be credited immediately - direct referrer)
echo -e "${CYAN}💰 Checking Level 1 SPOT for R1 (direct referrer - should be immediate)${NC}"
R1_LEVEL1_SPOT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT SUM(amount)::numeric(10,2) FROM ledger_entries 
WHERE receiver_user_id = $R1_ID 
  AND commission_type = 'SPOT' 
  AND (metadata->>'level')::int = 1;
" | tr -d ' ')

echo "R1 Level 1 SPOT: ₹$R1_LEVEL1_SPOT"
echo "Expected: ₹375.00 (3 × ₹125)"
if [ "$R1_LEVEL1_SPOT" = "375.00" ]; then
  echo -e "${GREEN}✅ R1 Level 1 SPOT correctly credited immediately${NC}"
else
  echo -e "${YELLOW}⚠️  R1 Level 1 SPOT: ₹$R1_LEVEL1_SPOT${NC}"
fi
echo ""

# Step 7: Register J1, J2, J3 under S1 (Level 3 for Mukesh)
echo -e "${YELLOW}👥 Step 7: Registering J1, J2, J3 under S1 (Level 3 for Mukesh)...${NC}"
J1_ID=""
J2_ID=""
J3_ID=""
J1_TOKEN=""
J2_TOKEN=""
J3_TOKEN=""

for i in 1 2 3; do
  J_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"J$i\",\"email\":\"j$i@test.com\",\"referrer_user_id\":$S1_ID}")
  J_ID=$(echo "$J_RESP" | jq -r '.id')
  
  J_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"j$i@test.com\"}")
  J_TOKEN=$(echo "$J_LOGIN" | jq -r '.token')
  
  # Store in variables
  eval "J${i}_ID=$J_ID"
  eval "J${i}_TOKEN=$J_TOKEN"
  
  # J purchases
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $J_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  echo -e "${GREEN}✅ J$i ID: $J_ID (purchased)${NC}"
done
echo ""

sleep 5

# Check Level 3 SPOT for Mukesh (should be in pending)
echo -e "${CYAN}📋 Checking Level 3 SPOT for Mukesh (should be in pending)${NC}"
LEVEL3_PENDING=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID AND level = 3;
" | tr -d ' ')

LEVEL3_PENDING_AMOUNT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT SUM(amount)::numeric(10,2) FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID AND level = 3;
" | tr -d ' ')

echo "Level 3 SPOT in pending: $LEVEL3_PENDING entries (₹$LEVEL3_PENDING_AMOUNT)"
echo "Expected: 3 entries (₹150.00 = 3 × ₹50 = 2% of ₹2500)"
if [ "$LEVEL3_PENDING" = "3" ]; then
  echo -e "${GREEN}✅ Level 3 SPOT correctly held in pending${NC}"
else
  echo -e "${RED}❌ Level 3 SPOT not in pending${NC}"
fi
echo ""

# Check Level 1 SPOT for S1 (should be credited immediately)
echo -e "${CYAN}💰 Checking Level 1 SPOT for S1 (direct referrer - should be immediate)${NC}"
S1_LEVEL1_SPOT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT SUM(amount)::numeric(10,2) FROM ledger_entries 
WHERE receiver_user_id = $S1_ID 
  AND commission_type = 'SPOT' 
  AND (metadata->>'level')::int = 1;
" | tr -d ' ')

echo "S1 Level 1 SPOT: ₹$S1_LEVEL1_SPOT"
echo "Expected: ₹375.00 (3 × ₹125)"
if [ "$S1_LEVEL1_SPOT" = "375.00" ]; then
  echo -e "${GREEN}✅ S1 Level 1 SPOT correctly credited immediately${NC}"
else
  echo -e "${YELLOW}⚠️  S1 Level 1 SPOT: ₹$S1_LEVEL1_SPOT${NC}"
fi
echo ""

# Step 8: Register K1, K2, K3 under J1 (Level 4 for Mukesh)
echo -e "${YELLOW}👥 Step 8: Registering K1, K2, K3 under J1 (Level 4 for Mukesh)...${NC}"
K1_ID=""
K2_ID=""
K3_ID=""
K1_TOKEN=""
K2_TOKEN=""
K3_TOKEN=""

for i in 1 2 3; do
  K_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"K$i\",\"email\":\"k$i@test.com\",\"referrer_user_id\":$J1_ID}")
  K_ID=$(echo "$K_RESP" | jq -r '.id')
  
  K_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"k$i@test.com\"}")
  K_TOKEN=$(echo "$K_LOGIN" | jq -r '.token')
  
  # Store in variables
  eval "K${i}_ID=$K_ID"
  eval "K${i}_TOKEN=$K_TOKEN"
  
  # K purchases
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $K_TOKEN" \
    -d "{\"package_id\":$PKG_ID}" > /dev/null
  
  echo -e "${GREEN}✅ K$i ID: $K_ID (purchased)${NC}"
done
echo ""

sleep 5

# Check Level 4 SPOT for Mukesh (should be in pending)
echo -e "${CYAN}📋 Checking Level 4 SPOT for Mukesh (should be in pending)${NC}"
LEVEL4_PENDING=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID AND level = 4;
" | tr -d ' ')

LEVEL4_PENDING_AMOUNT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT SUM(amount)::numeric(10,2) FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID AND level = 4;
" | tr -d ' ')

echo "Level 4 SPOT in pending: $LEVEL4_PENDING entries (₹$LEVEL4_PENDING_AMOUNT)"
echo "Expected: 3 entries (₹75.00 = 3 × ₹25 = 1% of ₹2500)"
if [ "$LEVEL4_PENDING" = "3" ]; then
  echo -e "${GREEN}✅ Level 4 SPOT correctly held in pending${NC}"
else
  echo -e "${RED}❌ Level 4 SPOT not in pending${NC}"
fi
echo ""

# Check Level 1 SPOT for J1 (should be credited immediately)
echo -e "${CYAN}💰 Checking Level 1 SPOT for J1 (direct referrer - should be immediate)${NC}"
J1_LEVEL1_SPOT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT SUM(amount)::numeric(10,2) FROM ledger_entries 
WHERE receiver_user_id = $J1_ID 
  AND commission_type = 'SPOT' 
  AND (metadata->>'level')::int = 1;
" | tr -d ' ')

echo "J1 Level 1 SPOT: ₹$J1_LEVEL1_SPOT"
echo "Expected: ₹375.00 (3 × ₹125)"
if [ "$J1_LEVEL1_SPOT" = "375.00" ]; then
  echo -e "${GREEN}✅ J1 Level 1 SPOT correctly credited immediately${NC}"
else
  echo -e "${YELLOW}⚠️  J1 Level 1 SPOT: ₹$J1_LEVEL1_SPOT${NC}"
fi
echo ""

# Final Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FINAL SUMMARY - MUKESH SPOT COMMISSIONS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Get all pending and credited SPOT for Mukesh
MUKESH_PENDING=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  level,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID
GROUP BY level
ORDER BY level;
")

MUKESH_CREDITED=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries 
WHERE receiver_user_id = $MUKESH_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
")

echo "📋 Pending SPOT Commissions:"
echo "$MUKESH_PENDING"
echo ""

echo "💰 Credited SPOT Commissions:"
echo "$MUKESH_CREDITED"
echo ""

# Check wallet balance
WALLET=$(curl -s -X GET "$API_BASE/users/$MUKESH_ID/wallet" \
  -H "Authorization: Bearer $MUKESH_TOKEN")
BALANCE=$(echo "$WALLET" | jq -r '.balance')
echo "💵 Mukesh Wallet Balance: ₹$BALANCE"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}✅ TEST COMPLETE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Expected Results:"
echo "  ✅ Level 1 SPOT: Credited immediately (₹375.00)"
echo "  ⏳ Level 2 SPOT: In pending (₹225.00) - will credit on Level 1 qualification"
echo "  ⏳ Level 3 SPOT: In pending (₹150.00) - will credit on Level 3 qualification"
echo "  ⏳ Level 4 SPOT: In pending (₹75.00) - will credit on Level 4 qualification"
echo ""
echo "All direct referrers (R1, S1, J1) should have Level 1 SPOT credited immediately."

