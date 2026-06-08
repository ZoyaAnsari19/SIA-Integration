#!/bin/bash
# Test Mukesh and R1 qualification with SPOT commission release
# Mukesh → Level 2 qualified
# R1 → Level 3 qualified

set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     TEST: MUKESH & R1 QUALIFICATION WITH SPOT RELEASE         ║"
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
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 3;
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

# Step 4: Register Mukesh and R1, R2, R3
echo -e "${YELLOW}👥 Step 4: Registering Mukesh and R1, R2, R3...${NC}"

# Mukesh
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

# R1, R2, R3
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

# Step 5: Register S1, S2, S3 under R1 (Level 2 for Mukesh)
echo -e "${YELLOW}👥 Step 5: Registering S1, S2, S3 under R1...${NC}"
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
  echo -e "${GREEN}✅ S$i ID: $S_ID${NC}"
done
echo ""

sleep 5

# Step 6: Register J1, J2, J3 under S1 (Level 3 for R1, Level 3 for Mukesh)
echo -e "${YELLOW}👥 Step 6: Registering J1, J2, J3 under S1...${NC}"
S1_ID=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT id FROM users WHERE name = 'S1' LIMIT 1;
" | tr -d ' ')

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
  echo -e "${GREEN}✅ J$i ID: $J_ID${NC}"
done
echo ""

sleep 5

# Check initial state
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 INITIAL STATE (Before Qualification)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo "Mukesh Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT level, COUNT(*) as count, SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $MUKESH_ID
GROUP BY level
ORDER BY level;
"
echo ""

echo "R1 Pending SPOT:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT level, COUNT(*) as count, SUM(amount)::numeric(10,2) as total
FROM pending_commissions 
WHERE receiver_user_id = $R1_ID
GROUP BY level
ORDER BY level;
"
echo ""

# Step 7: Make Mukesh eligible for Level 2 (need 2 legs with ₹5,000 each)
echo -e "${YELLOW}📈 Step 7: Making Mukesh eligible for Level 2...${NC}"
echo "   Level 2 requires: 2 legs with ₹5,000 each"
echo "   Creating 2 more direct referrals with ₹5,000 purchases..."

# Create ₹5,000 package
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

# Create 2 new direct referrals for Mukesh
for i in 4 5; do
  LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Leg$i\",\"email\":\"leg$i@test.com\",\"referrer_user_id\":$MUKESH_ID}")
  LEG_ID=$(echo "$LEG_RESP" | jq -r '.id')
  LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"leg$i@test.com\"}")
  LEG_TOKEN=$(echo "$LEG_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LEG_TOKEN" \
    -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
  echo "   ✅ Leg$i purchased ₹5,000"
done
echo ""

# Step 8: Make R1 eligible for Level 3 (need 2 legs with ₹5,000 each)
echo -e "${YELLOW}📈 Step 8: Making R1 eligible for Level 3...${NC}"
echo "   Level 3 requires: 2 legs with ₹5,000 each"
echo "   Creating 2 more direct referrals for R1..."

for i in 4 5; do
  R1_LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"R1Leg$i\",\"email\":\"r1leg$i@test.com\",\"referrer_user_id\":$R1_ID}")
  R1_LEG_ID=$(echo "$R1_LEG_RESP" | jq -r '.id')
  R1_LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"r1leg$i@test.com\"}")
  R1_LEG_TOKEN=$(echo "$R1_LEG_LOGIN" | jq -r '.token')
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $R1_LEG_TOKEN" \
    -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
  echo "   ✅ R1Leg$i purchased ₹5,000"
done
echo ""

sleep 5

# Step 9: Trigger eligibility recalculation
echo -e "${YELLOW}🔄 Step 9: Triggering eligibility recalculation...${NC}"
curl -s -X POST "$API_BASE/admin/release-pending" \
  -H "Authorization: Bearer dev-admin" > /dev/null
echo -e "${GREEN}✅ Eligibility recalculation triggered${NC}"
echo ""

echo -e "${YELLOW}⏳ Waiting 10 seconds for job processing...${NC}"
sleep 10
echo ""

# Step 10: Check Mukesh - Wallet, Ledger, Scheduled
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 MUKESH - WALLET, LEDGER & SCHEDULED COMMISSIONS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Wallet
WALLET_MUKESH=$(curl -s -X GET "$API_BASE/users/$MUKESH_ID/wallet" \
  -H "Authorization: Bearer $MUKESH_TOKEN")
BALANCE_MUKESH=$(echo "$WALLET_MUKESH" | jq -r '.balance')
echo -e "${GREEN}💵 Mukesh Wallet Balance: ₹$BALANCE_MUKESH${NC}"
echo ""

# Ledger - Credited SPOT
echo "📋 Ledger - Credited SPOT Commissions:"
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

# Pending SPOT
echo "⏳ Pending SPOT Commissions:"
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

# Scheduled MONTHLY
echo "📅 Scheduled MONTHLY Commissions:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  source_user_id,
  monthly_amount::numeric(10,2),
  daily_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE receiver_user_id = $MUKESH_ID 
  AND commission_type = 'MONTHLY'
ORDER BY start_date, source_user_id;
"
echo ""

# Step 11: Check R1 - Wallet, Ledger, Scheduled
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 R1 - WALLET, LEDGER & SCHEDULED COMMISSIONS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Wallet
WALLET_R1=$(curl -s -X GET "$API_BASE/users/$R1_ID/wallet" \
  -H "Authorization: Bearer $R1_TOKEN")
BALANCE_R1=$(echo "$WALLET_R1" | jq -r '.balance')
echo -e "${GREEN}💵 R1 Wallet Balance: ₹$BALANCE_R1${NC}"
echo ""

# Ledger - Credited SPOT
echo "📋 Ledger - Credited SPOT Commissions:"
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

# Pending SPOT
echo "⏳ Pending SPOT Commissions:"
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

# Scheduled MONTHLY
echo "📅 Scheduled MONTHLY Commissions:"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  source_user_id,
  monthly_amount::numeric(10,2),
  daily_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE receiver_user_id = $R1_ID 
  AND commission_type = 'MONTHLY'
ORDER BY start_date, source_user_id;
"
echo ""

# Step 12: Check Eligibility
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

# Final Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FINAL SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "✅ Test Complete!"
echo ""
echo "Expected Results:"
echo "  Mukesh (Level 2 qualified):"
echo "    ✅ Level 1 SPOT: Credited immediately (₹375)"
echo "    ✅ Level 2 SPOT: Released from pending and credited"
echo "    ✅ Level 2 MONTHLY: Scheduled from qualification date"
echo ""
echo "  R1 (Level 3 qualified):"
echo "    ✅ Level 1 SPOT: Credited immediately (₹375)"
echo "    ✅ Level 3 SPOT: Released from pending and credited"
echo "    ✅ Level 3 MONTHLY: Scheduled from qualification date"
echo ""


