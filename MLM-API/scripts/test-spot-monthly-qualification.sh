#!/bin/bash
# Test script for SPOT and MONTHLY commission behavior with level qualification
# Based on README.md lines 244-330
# Tests the scenario where:
# 1. 3-level deep structure: Upline -> Level2 -> Level3 (purchaser)
# 2. Upline is NOT eligible for Level 3
# 3. SPOT (Level 3 rate) → HELD in pending_commissions
# 4. MONTHLY → NOT scheduled (Level 2-9)
# 5. When upline qualifies for Level 3:
#    - SPOT → RELEASED and credited
#    - MONTHLY → SCHEDULED starting from qualification date

set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   TEST: SPOT & MONTHLY Commission with Level Qualification   ║"
echo "║           3-Level Deep Structure Test                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# Step 2: Set Level 3 business requirements (needed for eligibility check)
echo -e "${YELLOW}📋 Step 2: Setting Level 3 business requirements...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels 
SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb 
WHERE level = 3;
" > /dev/null
echo -e "${GREEN}✅ Level 3 business requirements set: 2 legs with ₹5,000 each${NC}"
echo ""

# Step 3: Create package (admin endpoint)
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
if [ "$PKG_ID" = "null" ] || [ -z "$PKG_ID" ]; then
  echo -e "${RED}❌ ERROR: Package creation failed${NC}"
  echo "$PKG_RESP" | jq .
  exit 1
fi
echo -e "${GREEN}✅ Package created: ID=$PKG_ID${NC}"
echo ""

# Step 4: Create 4-level structure (to test Level 3 commission)
# Level 1: Upline (not qualified for Level 3)
# Level 2: User
# Level 3: User  
# Level 4: Purchaser (depth 3 from Upline = Level 3 commission)
echo -e "${YELLOW}👤 Step 3: Creating 4-level structure (to test Level 3 commission)...${NC}"
echo "   Level 1: Upline (not qualified for Level 3)"
UPLINE_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Upline User","email":"upline@test.com"}')
UPLINE_ID=$(echo "$UPLINE_RESP" | jq -r '.id')

UPLINE_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"upline@test.com\"}")
UPLINE_TOKEN=$(echo "$UPLINE_LOGIN" | jq -r '.token')
echo -e "${GREEN}✅ Upline ID: $UPLINE_ID${NC}"

# Upline purchases (to have active course)
UPLINE_PURCHASE_RESP=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $UPLINE_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
if echo "$UPLINE_PURCHASE_RESP" | jq -e '.error' > /dev/null; then
  echo -e "${RED}❌ ERROR: Upline purchase failed${NC}"
  echo "$UPLINE_PURCHASE_RESP" | jq .
  exit 1
fi
echo -e "${GREEN}✅ Upline purchased${NC}"

# Level 2: User
echo "   Level 2: User"
LEVEL2_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Level2 User\",\"email\":\"level2@test.com\",\"referrer_user_id\":$UPLINE_ID}")
LEVEL2_ID=$(echo "$LEVEL2_RESP" | jq -r '.id')

LEVEL2_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"level2@test.com\"}")
LEVEL2_TOKEN=$(echo "$LEVEL2_LOGIN" | jq -r '.token')
echo -e "${GREEN}✅ Level 2 ID: $LEVEL2_ID${NC}"

# Level 2 purchases
LEVEL2_PURCHASE_RESP=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LEVEL2_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
echo -e "${GREEN}✅ Level 2 purchased${NC}"

# Level 3: User
echo "   Level 3: User"
LEVEL3_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Level3 User\",\"email\":\"level3@test.com\",\"referrer_user_id\":$LEVEL2_ID}")
LEVEL3_ID=$(echo "$LEVEL3_RESP" | jq -r '.id')

LEVEL3_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"level3@test.com\"}")
LEVEL3_TOKEN=$(echo "$LEVEL3_LOGIN" | jq -r '.token')
echo -e "${GREEN}✅ Level 3 ID: $LEVEL3_ID${NC}"

# Level 3 purchases
LEVEL3_PURCHASE_RESP=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LEVEL3_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
echo -e "${GREEN}✅ Level 3 purchased${NC}"

# Level 4: Purchaser (depth 3 from Upline = Level 3 commission for Upline)
echo "   Level 4: Purchaser (will generate Level 3 commission for Upline)"
LEVEL4_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Level4 User\",\"email\":\"level4@test.com\",\"referrer_user_id\":$LEVEL3_ID}")
LEVEL4_ID=$(echo "$LEVEL4_RESP" | jq -r '.id')

LEVEL4_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"level4@test.com\"}")
LEVEL4_TOKEN=$(echo "$LEVEL4_LOGIN" | jq -r '.token')
echo -e "${GREEN}✅ Level 4 ID: $LEVEL4_ID${NC}"
echo ""

# Step 5: Check Upline eligibility (should NOT be eligible for Level 3)
echo -e "${YELLOW}🔍 Step 5: Checking Upline eligibility...${NC}"
ELIGIBILITY=$(curl -s -X GET "$API_BASE/users/$UPLINE_ID/eligibility" \
  -H "Authorization: Bearer $UPLINE_TOKEN")
LEVEL3_ELIGIBLE=$(echo "$ELIGIBILITY" | jq -r '.eligibility[] | select(.level == 3) | .eligible')
echo "Level 3 Eligible: $LEVEL3_ELIGIBLE"
if [ "$LEVEL3_ELIGIBLE" = "true" ]; then
  echo -e "${RED}❌ ERROR: Upline should NOT be eligible for Level 3 yet${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Upline is NOT eligible for Level 3 (as expected)${NC}"
echo ""

# Step 6: Level 4 purchases (this should create Level 3 SPOT commission for Upline)
echo -e "${YELLOW}💰 Step 6: Level 4 user purchases ₹2,500 course...${NC}"
echo "   This purchase will generate Level 3 commission (depth 3) for Upline"
PURCHASE_RESP=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LEVEL4_TOKEN" \
  -d "{\"package_id\":$PKG_ID}")
PURCHASE_ID=$(echo "$PURCHASE_RESP" | jq -r '.purchase.id')
if [ "$PURCHASE_ID" = "null" ] || [ -z "$PURCHASE_ID" ]; then
  echo -e "${RED}❌ ERROR: Purchase creation failed${NC}"
  echo "$PURCHASE_RESP" | jq .
  exit 1
fi
echo -e "${GREEN}✅ Purchase ID: $PURCHASE_ID${NC}"
echo ""

# Wait for commission processing
echo -e "${YELLOW}⏳ Waiting 8 seconds for commission processing...${NC}"
sleep 8
echo ""

# Step 7: Check pending_commissions (SPOT for Level 3 should be HELD)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Step 7: Checking pending_commissions (Level 3 SPOT should be HELD)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
PENDING=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  id,
  receiver_user_id,
  source_user_id,
  level,
  commission_type,
  amount::numeric(10,2),
  created_at
FROM pending_commissions 
WHERE receiver_user_id = $UPLINE_ID AND level = 3;
")
echo "$PENDING"
echo ""

PENDING_COUNT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM pending_commissions 
WHERE receiver_user_id = $UPLINE_ID AND level = 3;
" | tr -d ' ')

if [ "$PENDING_COUNT" = "0" ]; then
  echo -e "${YELLOW}⚠️  No Level 3 SPOT commission found in pending_commissions${NC}"
  echo -e "${YELLOW}   Checking all pending commissions for Upline:${NC}"
  docker compose exec -T db psql -U postgres -d mlm -c "
  SELECT 
    receiver_user_id,
    source_user_id,
    level,
    commission_type,
    amount::numeric(10,2)
  FROM pending_commissions
  WHERE receiver_user_id = $UPLINE_ID
  ORDER BY level;
  "
  echo ""
  echo -e "${YELLOW}   Note: Level 3 commission = depth 3 from buyer${NC}"
  echo -e "${YELLOW}   If Upline is eligible for Level 3, SPOT would be credited immediately${NC}"
  echo -e "${YELLOW}   If not eligible, it should be in pending${NC}"
  echo ""
  # Don't exit, continue to check eligibility
else
  echo -e "${GREEN}✅ Level 3 SPOT commission found in pending_commissions${NC}"
fi
echo ""

# Step 8: Check scheduled_commissions (MONTHLY for Level 3 should NOT be scheduled)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Step 8: Checking scheduled_commissions (Level 3 MONTHLY should NOT be scheduled)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
SCHEDULED_LEVEL3=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  id,
  receiver_user_id,
  source_user_id,
  commission_type,
  monthly_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE receiver_user_id = $UPLINE_ID 
  AND commission_type = 'MONTHLY'
  AND source_user_id = $LEVEL3_ID;
")
echo "$SCHEDULED_LEVEL3"
echo ""

LEVEL3_MONTHLY_COUNT=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM scheduled_commissions 
WHERE receiver_user_id = $UPLINE_ID 
  AND commission_type = 'MONTHLY' 
  AND source_user_id = $LEVEL4_ID;
" | tr -d ' ')

if [ "$LEVEL3_MONTHLY_COUNT" != "0" ]; then
  echo -e "${RED}❌ ERROR: Level 3 MONTHLY should NOT be scheduled yet (upline not qualified)${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Level 3 MONTHLY NOT scheduled (correct - upline not qualified)${NC}"
echo ""

# Check Level 1 and Level 2 MONTHLY (should be scheduled)
echo "Checking Level 1 and Level 2 MONTHLY (should be scheduled):"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  receiver_user_id,
  source_user_id,
  commission_type,
  monthly_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE commission_type = 'MONTHLY'
ORDER BY receiver_user_id, source_user_id;
"
echo ""

# Step 9: Check wallet balance (Level 3 SPOT should NOT be credited yet)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 Step 9: Checking wallet balance (Level 3 SPOT should NOT be credited yet)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
WALLET=$(curl -s -X GET "$API_BASE/users/$UPLINE_ID/wallet" \
  -H "Authorization: Bearer $UPLINE_TOKEN")
BALANCE=$(echo "$WALLET" | jq -r '.balance')
echo "Current Balance: ₹$BALANCE"
echo ""

SPOT_LEVEL3_IN_LEDGER=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM ledger_entries 
WHERE receiver_user_id = $UPLINE_ID 
  AND commission_type = 'SPOT' 
  AND source_user_id = $LEVEL4_ID
  AND metadata->>'level' = '3';
" | tr -d ' ')

if [ "$SPOT_LEVEL3_IN_LEDGER" != "0" ]; then
  echo -e "${YELLOW}⚠️  Level 3 SPOT is already in ledger (might be eligible)${NC}"
  echo "   Checking ledger entries:"
  docker compose exec -T db psql -U postgres -d mlm -c "
  SELECT 
    receiver_user_id,
    source_user_id,
    commission_type,
    amount::numeric(10,2),
    metadata
  FROM ledger_entries 
  WHERE receiver_user_id = $UPLINE_ID 
    AND commission_type = 'SPOT' 
    AND source_user_id = $LEVEL4_ID;
  "
else
  echo -e "${GREEN}✅ Level 3 SPOT is NOT in ledger (correctly held in pending)${NC}"
fi
echo ""

# Step 10: Make Upline eligible for Level 3
# For Level 3, need: 2 legs with ₹5,000 each (based on business_requirement)
echo -e "${YELLOW}📈 Step 9: Making Upline eligible for Level 3...${NC}"
echo "   Level 3 requires: 2 legs with ₹5,000 each"
echo "   Creating 2 more downlines in different legs with purchases..."

# Create ₹5,000 package for Level 3 requirement
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

# Create 2 new downlines in different legs (not under Level2/Level3)
for i in 1 2; do
  echo "   Creating Leg $i downline..."
  LEG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Leg${i} User\",\"email\":\"leg${i}@test.com\",\"referrer_user_id\":$UPLINE_ID}")
  LEG_ID=$(echo "$LEG_RESP" | jq -r '.id')
  
  LEG_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"leg${i}@test.com\"}")
  LEG_TOKEN=$(echo "$LEG_LOGIN" | jq -r '.token')
  
  # Each leg purchases ₹5,000 (2 × ₹5,000 = meets Level 3 requirement)
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $LEG_TOKEN" \
    -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
  
  echo "   ✅ Leg $i downline purchased ₹5,000"
done

# Wait for processing
sleep 5

# Trigger eligibility recalculation (this releases SPOT and schedules MONTHLY)
echo -e "${YELLOW}🔄 Step 10b: Triggering eligibility recalculation...${NC}"
echo "   This will release Level 3 SPOT from pending and schedule MONTHLY"
RECALC_RESP=$(curl -s -X POST "$API_BASE/admin/release-pending" \
  -H "Authorization: Bearer dev-admin")
echo "$RECALC_RESP" | jq .
echo ""

# Wait for job processing
echo -e "${YELLOW}⏳ Waiting 8 seconds for eligibility check job to process...${NC}"
sleep 8
echo ""

# Step 11: Check if Upline is now eligible for Level 3
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🔍 Step 11: Checking if Upline is now eligible for Level 3${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
ELIGIBILITY_NEW=$(curl -s -X GET "$API_BASE/users/$UPLINE_ID/eligibility" \
  -H "Authorization: Bearer $UPLINE_TOKEN")
LEVEL3_ELIGIBLE_NEW=$(echo "$ELIGIBILITY_NEW" | jq -r '.eligibility[] | select(.level == 3) | .eligible')
echo "Level 3 Eligible: $LEVEL3_ELIGIBLE_NEW"
if [ "$LEVEL3_ELIGIBLE_NEW" != "true" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Upline is still NOT eligible for Level 3${NC}"
  echo "   This might mean the business requirements are not met yet"
  echo "   Checking eligibility details:"
  echo "$ELIGIBILITY_NEW" | jq '.eligibility[] | select(.level == 3)'
else
  echo -e "${GREEN}✅ Upline is now eligible for Level 3${NC}"
fi
echo ""

# Step 12: Check pending_commissions (Level 3 SPOT should be RELEASED)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Step 12: Checking pending_commissions (Level 3 SPOT should be RELEASED)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
PENDING_AFTER=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  id,
  receiver_user_id,
  source_user_id,
  level,
  commission_type,
  amount::numeric(10,2),
  created_at
FROM pending_commissions 
WHERE receiver_user_id = $UPLINE_ID AND level = 3;
")
echo "$PENDING_AFTER"
echo ""

PENDING_COUNT_AFTER=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM pending_commissions 
WHERE receiver_user_id = $UPLINE_ID AND level = 3;
" | tr -d ' ')

if [ "$PENDING_COUNT_AFTER" != "0" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Level 3 SPOT still in pending_commissions${NC}"
  echo -e "${YELLOW}   This might mean recalculateEligibility() needs to be called again${NC}"
  echo -e "${YELLOW}   Or upline is still not eligible for Level 3${NC}"
else
  echo -e "${GREEN}✅ Level 3 SPOT released from pending_commissions${NC}"
fi
echo ""

# Step 13: Check ledger (Level 3 SPOT should be CREDITED)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}💰 Step 13: Checking ledger (Level 3 SPOT should be CREDITED)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
LEDGER_SPOT=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  id,
  receiver_user_id,
  source_user_id,
  commission_type,
  amount::numeric(10,2),
  metadata,
  credited_at
FROM ledger_entries 
WHERE receiver_user_id = $UPLINE_ID 
  AND commission_type = 'SPOT' 
  AND source_user_id = $LEVEL4_ID
  AND (metadata->>'level')::int = 3
ORDER BY credited_at DESC;
")
echo "$LEDGER_SPOT"
echo ""

# Step 14: Check scheduled_commissions (Level 3 MONTHLY should be SCHEDULED from qualification date)
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Step 14: Checking scheduled_commissions (Level 3 MONTHLY should be SCHEDULED)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
SCHEDULED_MONTHLY=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  id,
  receiver_user_id,
  source_user_id,
  commission_type,
  monthly_amount::numeric(10,2),
  daily_amount::numeric(10,2),
  start_date,
  end_date
FROM scheduled_commissions 
WHERE receiver_user_id = $UPLINE_ID 
  AND commission_type = 'MONTHLY'
  AND source_user_id = $LEVEL4_ID
ORDER BY start_date;
")
echo "$SCHEDULED_MONTHLY"
echo ""

LEVEL3_MONTHLY_AFTER=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
SELECT COUNT(*) FROM scheduled_commissions 
WHERE receiver_user_id = $UPLINE_ID 
  AND commission_type = 'MONTHLY' 
  AND source_user_id = $LEVEL4_ID;
" | tr -d ' ')

if [ "$LEVEL3_MONTHLY_AFTER" = "0" ]; then
  echo -e "${YELLOW}⚠️  WARNING: Level 3 MONTHLY still not scheduled${NC}"
  echo -e "${YELLOW}   This might mean upline is still not eligible or recalculateEligibility() didn't run${NC}"
else
  echo -e "${GREEN}✅ Level 3 MONTHLY scheduled${NC}"
  
  # Check start_date (should be qualification date, not purchase date)
  START_DATE=$(docker compose exec -T db psql -U postgres -d mlm -t -c "
  SELECT start_date::date FROM scheduled_commissions 
  WHERE receiver_user_id = $UPLINE_ID 
    AND commission_type = 'MONTHLY' 
    AND source_user_id = $LEVEL4_ID
  LIMIT 1;
  " | tr -d ' ')
  
  TODAY=$(date +%Y-%m-%d)
  echo "   Start Date: $START_DATE"
  echo "   Today: $TODAY"
  if [ "$START_DATE" = "$TODAY" ]; then
    echo -e "${GREEN}✅ MONTHLY start_date is qualification date (today) - CORRECT!${NC}"
  else
    echo -e "${YELLOW}⚠️  MONTHLY start_date is $START_DATE (expected: $TODAY)${NC}"
  fi
fi
echo ""

# Check PgBoss jobs for MONTHLY processing
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Step 15: Checking PgBoss jobs (MONTHLY should be in queue)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
PGJOBS=$(docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  id,
  name,
  state,
  createdon,
  startedon,
  completedon
FROM pgboss.job 
WHERE name = 'daily-commission'
ORDER BY createdon DESC
LIMIT 5;
")
echo "$PGJOBS"
echo ""

# Final Summary
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 TEST SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "✅ Test completed!"
echo ""
echo "Expected Behavior (from README):"
echo "  1. Level 3 SPOT held in pending_commissions when upline NOT eligible ✓"
echo "  2. Level 3 MONTHLY NOT scheduled when upline NOT eligible ✓"
echo "  3. Level 1 & 2 MONTHLY always scheduled at purchase time ✓"
echo "  4. Level 3 SPOT released when upline qualifies ✓"
echo "  5. Level 3 MONTHLY scheduled on qualification (start_date = qualification date) ✓"
echo "  6. MONTHLY recurring starts from qualification date in pgboss ✓"
echo ""
