#!/bin/bash
# Complete Test Scenario: Mukesh → R1/R2/R3 → S1/S2/S3 → J1/J2/J3 → K1/K2/K3
# Tests SPOT commission flow with qualifications:
# - Mukesh: Level 2 qualified
# - R1: Level 3 qualified
# - S1: Level 2 qualified

set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     COMPLETE QUALIFICATION TEST - ALL LEVELS                  ║"
echo "║     Mukesh→R1/R2/R3→S1/S2/S3→J1/J2/J3→K1/K2/K3               ║"
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

# Step 2: Set business requirements (PROGRESSIVE - each level requires more)
# Level 3 requires higher amount per leg to prevent accidental qualification
echo -e "${YELLOW}📋 Step 2: Setting business requirements (Progressive)...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels SET business_requirement = '{\"required_leg_count\": 1, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 1;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 2;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 3, \"required_leg_min_amount\": 10000}'::jsonb WHERE level = 3;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 4, \"required_leg_min_amount\": 10000}'::jsonb WHERE level = 4;
" > /dev/null
echo -e "${GREEN}✅ Business requirements set (L1=1leg₹2.5K, L2=2legs₹5K, L3=3legs₹10K, L4=4legs₹10K)${NC}"
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

PKG_5K_RESP=$(curl -s -X POST "$API_BASE/admin/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-admin" \
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
echo -e "${GREEN}✅ Packages created: ₹2,500 (ID=$PKG_ID), ₹5,000 (ID=$PKG_5K_ID)${NC}"
echo ""

# Step 4: Register Mukesh
echo -e "${YELLOW}👤 Step 4: Registering Mukesh (Root)...${NC}"
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
echo ""

# Step 5: Register R1, R2, R3 (Level 1 for Mukesh)
echo -e "${YELLOW}👥 Step 5: Registering R1, R2, R3 (Level 1 for Mukesh)...${NC}"
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
echo ""

sleep 5

# Step 6: Register S1, S2, S3 under R1 (Level 2 for Mukesh, Level 1 for R1)
echo -e "${YELLOW}👥 Step 6: Registering S1, S2, S3 under R1...${NC}"
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
echo ""

sleep 5

# Step 7: Register J1, J2, J3 under S1 (Level 3 for Mukesh, Level 2 for R1, Level 1 for S1)
echo -e "${YELLOW}👥 Step 7: Registering J1, J2, J3 under S1...${NC}"
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
echo ""

sleep 5

# Step 8: Register K1, K2, K3 under J1 (Level 4 for Mukesh, Level 3 for R1, Level 2 for S1, Level 1 for J1)
echo -e "${YELLOW}👥 Step 8: Registering K1, K2, K3 under J1...${NC}"
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
  echo -e "${GREEN}✅ K$i ID: $K_ID${NC}"
done
echo ""

sleep 5

# Check initial state (before qualifications)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 INITIAL STATE (Before Qualifications)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "Mukesh - Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT level, COUNT(*) as count, SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID
GROUP BY level
ORDER BY level;
"
echo ""

echo "R1 - Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT level, COUNT(*) as count, SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $R1_ID
GROUP BY level
ORDER BY level;
"
echo ""

echo "S1 - Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT level, COUNT(*) as count, SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $S1_ID
GROUP BY level
ORDER BY level;
"
echo ""

# Step 9: Make Mukesh eligible for Level 2 (NOT Level 3 or 4)
echo -e "${YELLOW}📈 Step 9: Making Mukesh eligible for Level 2 only...${NC}"
echo "   Level 2 requires: 2 legs with ₹5,000 each"
echo "   Level 3 requires: 3 legs with ₹5,000 each (will NOT qualify)"
echo "   Level 4 requires: 4 legs with ₹5,000 each (will NOT qualify)"
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
    -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
  echo "   ✅ MukeshLeg$i purchased ₹5,000"
done
echo ""

sleep 5

# Step 10: Make R1 eligible for Level 3 (NOT Level 4)
echo -e "${YELLOW}📈 Step 10: Making R1 eligible for Level 3 only...${NC}"
echo "   R1 has S1, S2, S3 as direct legs"
echo "   S1 leg: S1(₹2,500) + J1(₹2,500) + J2(₹2,500) + J3(₹2,500) = ₹10,000 ✅"
echo "   S2 leg: S2(₹2,500) = ₹2,500 ❌ (needs ₹10,000+ for Level 3)"
echo "   S3 leg: S3(₹2,500) = ₹2,500 ❌ (needs ₹10,000+ for Level 3)"
echo "   Level 3 requires: 3 legs with ₹10,000 each"
echo "   Adding purchases to S2 and S3 legs to make them ₹10,000+"
# Get S2 and S3 IDs
S2_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM users WHERE name = 'S2' LIMIT 1;" | tr -d ' ')
S3_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "SELECT id FROM users WHERE name = 'S3' LIMIT 1;" | tr -d ' ')
# Add downline to S2 to make its leg ₹10,000+ (for Level 3)
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
  echo "   ✅ S2Leg$i purchased ₹2,500"
done
echo "   ✅ S2 leg now: ₹12,500 (S2 ₹2,500 + 4 legs × ₹2,500)"
# Add downline to S3 to make its leg ₹10,000+ (for Level 3)
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
  echo "   ✅ S3Leg$i purchased ₹2,500"
done
echo "   ✅ S3 leg now: ₹12,500 (S3 ₹2,500 + 4 legs × ₹2,500)"
echo "   ✅ R1 now has 3 legs with ₹10,000+ each → Level 3 QUALIFIED"
echo ""

sleep 5

# Step 11: Make S1 eligible for Level 2 (NOT Level 3 or 4)
echo -e "${YELLOW}📈 Step 11: Making S1 eligible for Level 2 only...${NC}"
echo "   Level 2 requires: 2 legs with ₹5,000 each"
echo "   Level 3 requires: 3 legs with ₹5,000 each (will NOT qualify)"
echo "   Level 4 requires: 4 legs with ₹5,000 each (will NOT qualify)"
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
    -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
  echo "   ✅ S1Leg$i purchased ₹5,000"
done
echo ""

sleep 5

# Step 12: Check all users - Wallet, Ledger, Scheduled
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 MUKESH - WALLET, LEDGER & SCHEDULED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Mukesh Wallet
WALLET_MUKESH=$(curl -s -X GET "$API_BASE/users/$MUKESH_ID/wallet" \
  -H "Authorization: Bearer $MUKESH_TOKEN")
BALANCE_MUKESH=$(echo "$WALLET_MUKESH" | jq -r '.balance')
echo -e "${GREEN}💵 Mukesh Wallet Balance: ₹$BALANCE_MUKESH${NC}"
echo ""

# Mukesh Ledger - Credited SPOT
echo "📋 Mukesh Ledger - Credited SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries 
WHERE receiver_user_id = $MUKESH_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"
echo ""

# Mukesh Pending SPOT
echo "⏳ Mukesh Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID
GROUP BY level
ORDER BY level;
"
echo ""

# Mukesh Scheduled MONTHLY
echo "📅 Mukesh Scheduled MONTHLY:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  source_user_id,
  monthly_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE receiver_user_id = $MUKESH_ID 
  AND commission_type = 'MONTHLY'
ORDER BY start_date, source_user_id;
"
echo ""

# R1
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 R1 - WALLET, LEDGER & SCHEDULED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

WALLET_R1=$(curl -s -X GET "$API_BASE/users/$R1_ID/wallet" \
  -H "Authorization: Bearer $R1_TOKEN")
BALANCE_R1=$(echo "$WALLET_R1" | jq -r '.balance')
echo -e "${GREEN}💵 R1 Wallet Balance: ₹$BALANCE_R1${NC}"
echo ""

echo "📋 R1 Ledger - Credited SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries 
WHERE receiver_user_id = $R1_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"
echo ""

echo "⏳ R1 Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $R1_ID
GROUP BY level
ORDER BY level;
"
echo ""

echo "📅 R1 Scheduled MONTHLY:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  source_user_id,
  monthly_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE receiver_user_id = $R1_ID 
  AND commission_type = 'MONTHLY'
ORDER BY start_date, source_user_id;
"
echo ""

# S1
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 S1 - WALLET, LEDGER & SCHEDULED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

WALLET_S1=$(curl -s -X GET "$API_BASE/users/$S1_ID/wallet" \
  -H "Authorization: Bearer $S1_TOKEN")
BALANCE_S1=$(echo "$WALLET_S1" | jq -r '.balance')
echo -e "${GREEN}💵 S1 Wallet Balance: ₹$BALANCE_S1${NC}"
echo ""

echo "📋 S1 Ledger - Credited SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries 
WHERE receiver_user_id = $S1_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"
echo ""

echo "⏳ S1 Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $S1_ID
GROUP BY level
ORDER BY level;
"
echo ""

echo "📅 S1 Scheduled MONTHLY:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  source_user_id,
  monthly_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE receiver_user_id = $S1_ID 
  AND commission_type = 'MONTHLY'
ORDER BY start_date, source_user_id;
"
echo ""

# J1
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 J1 - WALLET, LEDGER & SCHEDULED${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

WALLET_J1=$(curl -s -X GET "$API_BASE/users/$J1_ID/wallet" \
  -H "Authorization: Bearer $J1_TOKEN")
BALANCE_J1=$(echo "$WALLET_J1" | jq -r '.balance')
echo -e "${GREEN}💵 J1 Wallet Balance: ₹$BALANCE_J1${NC}"
echo ""

echo "📋 J1 Ledger - Credited SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries 
WHERE receiver_user_id = $J1_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"
echo ""

echo "⏳ J1 Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $J1_ID
GROUP BY level
ORDER BY level;
"
echo ""

# K1
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 K1 - WALLET, LEDGER${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

K1_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT id FROM users WHERE name = 'K1' LIMIT 1;
" | tr -d ' ')

K1_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"k1@test.com"}')
K1_TOKEN=$(echo "$K1_LOGIN" | jq -r '.token')

WALLET_K1=$(curl -s -X GET "$API_BASE/users/$K1_ID/wallet" \
  -H "Authorization: Bearer $K1_TOKEN")
BALANCE_K1=$(echo "$WALLET_K1" | jq -r '.balance')
echo -e "${GREEN}💵 K1 Wallet Balance: ₹$BALANCE_K1${NC}"
echo ""

echo "📋 K1 Ledger - Credited SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as entries,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries 
WHERE receiver_user_id = $K1_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"
echo ""

# Eligibility Check
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🔍 ELIGIBILITY STATUS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "Mukesh Eligibility:"
MUKESH_ELIG=$(curl -s -X GET "$API_BASE/users/$MUKESH_ID/eligibility" \
  -H "Authorization: Bearer $MUKESH_TOKEN")
echo "$MUKESH_ELIG" | jq '.eligibility[] | select(.level <= 2) | {level, eligible}'
echo ""

echo "R1 Eligibility:"
R1_ELIG=$(curl -s -X GET "$API_BASE/users/$R1_ID/eligibility" \
  -H "Authorization: Bearer $R1_TOKEN")
echo "$R1_ELIG" | jq '.eligibility[] | select(.level <= 3) | {level, eligible}'
echo ""

echo "S1 Eligibility:"
S1_ELIG=$(curl -s -X GET "$API_BASE/users/$S1_ID/eligibility" \
  -H "Authorization: Bearer $S1_TOKEN")
echo "$S1_ELIG" | jq '.eligibility[] | select(.level <= 2) | {level, eligible}'
echo ""

# Final Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FINAL SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "✅ Test Complete!"
echo ""
echo "Expected Results:"
echo "  Mukesh (Level 2 qualified):"
echo "    ✅ Level 1 SPOT: Credited immediately"
echo "    ✅ Level 2 SPOT: Released instantly on qualification"
echo "    ⏳ Level 3+ SPOT: Held in pending until qualification"
echo ""
echo "  R1 (Level 3 qualified):"
echo "    ✅ Level 1 SPOT: Credited immediately"
echo "    ✅ Level 3 SPOT: Released instantly on qualification"
echo "    ⏳ Level 2 SPOT: Held in pending until qualification"
echo ""
echo "  S1 (Level 2 qualified):"
echo "    ✅ Level 1 SPOT: Credited immediately"
echo "    ✅ Level 2 SPOT: Released instantly on qualification"
echo ""
echo "  J1, K1:"
echo "    ✅ Level 1 SPOT: Credited immediately (direct referrers)"
echo ""

