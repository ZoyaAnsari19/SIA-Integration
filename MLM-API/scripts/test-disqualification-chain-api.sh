#!/bin/bash
# Disqualification Chain Test via API:
# A1 -> A2 -> A3 -> A4 -> A5
# (simulate 21+ days inactivity for A2 → disqualify)
# A2 -> A7 -> A8 (new chain)
#
# Goals:
# - Before disqualification:
#   - Check SPOT / MONTHLY from A5 downline as normal.
# - After disqualification of A2:
#   - A1 should NOT get SPOT / MONTHLY from A7/A8 (A2's new chain).
#   - Old chain (A3/A4/A5) stays intact for A1.

set -e

API_BASE="http://localhost:3000/api/v1"
ADMIN_TOKEN="dev-admin"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   DISQUALIFICATION CHAIN TEST VIA API (A1 → A8)              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

###############################################################################
# Step 1: Clean database
###############################################################################
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

###############################################################################
# Step 2: Set business requirements (simple levels)
###############################################################################
echo -e "${YELLOW}📋 Step 2: Setting business requirements (Levels 1–3)...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels SET business_requirement = '{\"required_leg_count\": 1, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 1;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 2;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 3, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 3;
" > /dev/null
echo -e "${GREEN}✅ Business requirements set for Levels 1–3${NC}"
echo ""

###############################################################################
# Step 3: Create base package via API
###############################################################################
echo -e "${YELLOW}📦 Step 3: Creating ₹2,500 package via API...${NC}"
PKG_RESP=$(curl -s -X POST "$API_BASE/admin/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name":"₹2,500 Course",
    "price":2500,
    "validity_months":12,
    "self_monthly":62.50,
    "global_ids":55,
    "global_monthly_per_id":6.25,
    "recurring_rate_percent":0.5
  }')
PKG_ID=$(echo "$PKG_RESP" | jq -r '.id')
echo -e "${GREEN}✅ Package created: ID=$PKG_ID${NC}"
echo ""

###############################################################################
# Helper: register + login user
###############################################################################
register_user() {
  local NAME="$1"
  local EMAIL="$2"
  local REFERRER_ID="$3"

  if [ -z "$REFERRER_ID" ]; then
    RESP=$(curl -s -X POST "$API_BASE/users/register" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\"}")
  else
    RESP=$(curl -s -X POST "$API_BASE/users/register" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"referrer_user_id\":$REFERRER_ID}")
  fi
  USER_ID=$(echo "$RESP" | jq -r '.id')

  LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\"}")
  TOKEN=$(echo "$LOGIN" | jq -r '.token')

  echo "$USER_ID|$TOKEN"
}

purchase_package() {
  local TOKEN="$1"
  local PACKAGE_ID="$2"

  RESP=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"package_id\":$PACKAGE_ID}")
  echo "$RESP" | jq -r '.purchase.id'
}

###############################################################################
# Step 4: Create initial chain A1 -> A2 -> A3 -> A4 -> A5 with purchases
###############################################################################
echo -e "${YELLOW}👥 Step 4: Creating initial chain A1 → A2 → A3 → A4 → A5...${NC}"

echo "  Creating A1 (root)..."
A1_INFO=$(register_user "A1" "a1@test.com")
A1_ID=$(echo "$A1_INFO" | cut -d'|' -f1)
A1_TOKEN=$(echo "$A1_INFO" | cut -d'|' -f2)
A1_PURCHASE_ID=$(purchase_package "$A1_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A1 ID: $A1_ID, Purchase: $A1_PURCHASE_ID${NC}"

echo "  Creating A2 under A1..."
A2_INFO=$(register_user "A2" "a2@test.com" "$A1_ID")
A2_ID=$(echo "$A2_INFO" | cut -d'|' -f1)
A2_TOKEN=$(echo "$A2_INFO" | cut -d'|' -f2)
A2_PURCHASE_ID=$(purchase_package "$A2_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A2 ID: $A2_ID, Purchase: $A2_PURCHASE_ID${NC}"

echo "  Creating A3 under A2..."
A3_INFO=$(register_user "A3" "a3@test.com" "$A2_ID")
A3_ID=$(echo "$A3_INFO" | cut -d'|' -f1)
A3_TOKEN=$(echo "$A3_INFO" | cut -d'|' -f2)
A3_PURCHASE_ID=$(purchase_package "$A3_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A3 ID: $A3_ID, Purchase: $A3_PURCHASE_ID${NC}"

echo "  Creating A4 under A3..."
A4_INFO=$(register_user "A4" "a4@test.com" "$A3_ID")
A4_ID=$(echo "$A4_INFO" | cut -d'|' -f1)
A4_TOKEN=$(echo "$A4_INFO" | cut -d'|' -f2)
A4_PURCHASE_ID=$(purchase_package "$A4_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A4 ID: $A4_ID, Purchase: $A4_PURCHASE_ID${NC}"

echo "  Creating A5 under A4..."
A5_INFO=$(register_user "A5" "a5@test.com" "$A4_ID")
A5_ID=$(echo "$A5_INFO" | cut -d'|' -f1)
A5_TOKEN=$(echo "$A5_INFO" | cut -d'|' -f2)
A5_PURCHASE_ID=$(purchase_package "$A5_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A5 ID: $A5_ID, Purchase: $A5_PURCHASE_ID${NC}"
echo ""

###############################################################################
# Step 5: Recalculate eligibility for all users
###############################################################################
echo -e "${YELLOW}🔄 Step 5: Recalculating eligibility for all users...${NC}"
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' > /dev/null
sleep 3
echo -e "${GREEN}✅ Eligibility recalculated${NC}"
echo ""

###############################################################################
# Step 6: BEFORE DISQUALIFY - Show SPOT / MONTHLY from A5 purchases
###############################################################################
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 BEFORE DISQUALIFICATION - IMPACT OF A5 PURCHASES           ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  u.name as \"Receiver\",
  COUNT(*) FILTER (WHERE le.commission_type = 'SPOT') as \"SPOT Count\",
  COALESCE(SUM(CASE WHEN le.commission_type = 'SPOT' THEN le.amount END),0)::numeric(10,2) as \"SPOT Total\",
  COUNT(*) FILTER (WHERE sc.commission_type = 'MONTHLY') as \"MONTHLY Sched Count\",
  COALESCE(SUM(CASE WHEN sc.commission_type = 'MONTHLY' THEN sc.monthly_amount END),0)::numeric(10,2) as \"MONTHLY Total\"
FROM users u
LEFT JOIN ledger_entries le ON le.receiver_user_id = u.id 
  AND le.commission_type = 'SPOT'
  AND le.purchase_id = $A5_PURCHASE_ID
LEFT JOIN scheduled_commissions sc ON sc.receiver_user_id = u.id 
  AND sc.commission_type = 'MONTHLY'
  AND sc.source_user_id = $A5_ID
GROUP BY u.name
HAVING 
  COUNT(*) FILTER (WHERE le.commission_type = 'SPOT') > 0
  OR COUNT(*) FILTER (WHERE sc.commission_type = 'MONTHLY') > 0
ORDER BY u.name;
"
echo ""

###############################################################################
# Step 7: Simulate 21+ days inactivity for A2 and run disqualification job
###############################################################################
echo -e "${YELLOW}⏳ Step 7: Simulating 21+ days inactivity for A2 and disqualifying...${NC}"

# Move all A2 purchases to 22 days in the past so active_until < (today - 21 days)
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE purchases
SET active_until = NOW() - INTERVAL '22 days'
WHERE user_id = $A2_ID;
"
echo -e "${GREEN}✅ A2 purchases set to expired (>21 days ago)${NC}"

echo "  Running disqualification job (scripts/test-disqualification.ts)..."
npx tsx scripts/test-disqualification.ts
echo ""

echo -e "${BLUE}📌 A2 disqualification flags:${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT id, name, is_disqualified, disqualified_at
FROM users
WHERE id = $A2_ID;
"
echo ""

###############################################################################
# Step 8: Create new chain A2 -> A7 -> A8 and purchases
###############################################################################
echo -e "${YELLOW}👥 Step 8: Creating new chain A2 → A7 → A8 with purchases...${NC}"

echo "  Creating A7 under A2..."
A7_INFO=$(register_user "A7" "a7@test.com" "$A2_ID")
A7_ID=$(echo "$A7_INFO" | cut -d'|' -f1)
A7_TOKEN=$(echo "$A7_INFO" | cut -d'|' -f2)
A7_PURCHASE_ID=$(purchase_package "$A7_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A7 ID: $A7_ID, Purchase: $A7_PURCHASE_ID${NC}"

echo "  Creating A8 under A7..."
A8_INFO=$(register_user "A8" "a8@test.com" "$A7_ID")
A8_ID=$(echo "$A8_INFO" | cut -d'|' -f1)
A8_TOKEN=$(echo "$A8_INFO" | cut -d'|' -f2)
A8_PURCHASE_ID=$(purchase_package "$A8_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A8 ID: $A8_ID, Purchase: $A8_PURCHASE_ID${NC}"
echo ""

###############################################################################
# Step 9: Recalculate eligibility after new chain
###############################################################################
echo -e "${YELLOW}🔄 Step 9: Recalculating eligibility after new-chain purchases...${NC}"
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' > /dev/null
sleep 3
echo -e "${GREEN}✅ Eligibility recalculated${NC}"
echo ""

###############################################################################
# Step 10: AFTER DISQUALIFY - Show SPOT / MONTHLY from A7/A8 purchases
###############################################################################
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 AFTER DISQUALIFICATION - IMPACT OF A7/A8 PURCHASES         ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}🔎 SPOT commissions from A7/A8 purchases (who received what)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  r.name as \"Receiver\",
  SUM(le.amount)::numeric(10,2) as \"SPOT Total\"
FROM ledger_entries le
JOIN purchases p ON p.id = le.purchase_id
JOIN users r ON r.id = le.receiver_user_id
WHERE le.commission_type = 'SPOT'
  AND p.user_id IN ($A7_ID, $A8_ID)
GROUP BY r.name
ORDER BY r.name;
"
echo ""

echo -e "${BLUE}🔎 MONTHLY scheduled from A7/A8 (who is receiver)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  r.name as \"Receiver\",
  COUNT(*) as \"MONTHLY Count\",
  SUM(sc.monthly_amount)::numeric(10,2) as \"MONTHLY Total\"
FROM scheduled_commissions sc
JOIN users r ON r.id = sc.receiver_user_id
WHERE sc.commission_type = 'MONTHLY'
  AND sc.source_user_id IN ($A7_ID, $A8_ID)
GROUP BY r.name
ORDER BY r.name;
"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}✅ TEST COMPLETE                                                ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Expected key condition:"
echo "  - A1 should NOT appear in SPOT / MONTHLY receivers for A7/A8 purchases."
echo "  - A2 / A7 / A8 may appear depending on qualification."
echo ""

#!/bin/bash
# Disqualification Chain Test via API:
# A1 -> A2 -> A3 -> A4 -> A5
# (simulate 21+ days inactivity for A2 → disqualify)
# Then:
#   - A2 buys NEW package (reactivate)
#   - A2 -> A7 -> A8 (new chain)
#
# Goals:
# - Before disqualification:
#   - Check SPOT / MONTHLY from A5 downline as normal.
# - After disqualification of A2:
#   - A1 should NOT get SPOT / MONTHLY from A7/A8 (A2's new chain).
#   - After A2 re-activates, A2 should get SPOT/MONTHLY from new chain as per rules.

set -e

API_BASE="http://localhost:3000/api/v1"
ADMIN_TOKEN="dev-admin"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   DISQUALIFICATION CHAIN TEST VIA API (A1 → A8)              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

###############################################################################
# Step 1: Clean database
###############################################################################
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

###############################################################################
# Step 2: Set business requirements (simple levels)
###############################################################################
echo -e "${YELLOW}📋 Step 2: Setting business requirements (Levels 1–3)...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels SET business_requirement = '{\"required_leg_count\": 1, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 1;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 2;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 3, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 3;
" > /dev/null
echo -e "${GREEN}✅ Business requirements set for Levels 1–3${NC}"
echo ""

###############################################################################
# Step 3: Create base package via API
###############################################################################
echo -e "${YELLOW}📦 Step 3: Creating ₹2,500 package via API...${NC}"
PKG_RESP=$(curl -s -X POST "$API_BASE/admin/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name":"₹2,500 Course",
    "price":2500,
    "validity_months":12,
    "self_monthly":62.50,
    "global_ids":55,
    "global_monthly_per_id":6.25,
    "recurring_rate_percent":0.5
  }')
PKG_ID=$(echo "$PKG_RESP" | jq -r '.id')
echo -e "${GREEN}✅ Package created: ID=$PKG_ID${NC}"
echo ""

###############################################################################
# Helper: register + login user
###############################################################################
register_user() {
  local NAME="$1"
  local EMAIL="$2"
  local REFERRER_ID="$3"

  if [ -z "$REFERRER_ID" ]; then
    RESP=$(curl -s -X POST "$API_BASE/users/register" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\"}")
  else
    RESP=$(curl -s -X POST "$API_BASE/users/register" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"referrer_user_id\":$REFERRER_ID}")
  fi
  USER_ID=$(echo "$RESP" | jq -r '.id')

  LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\"}")
  TOKEN=$(echo "$LOGIN" | jq -r '.token')

  echo "$USER_ID|$TOKEN"
}

purchase_package() {
  local TOKEN="$1"
  local PACKAGE_ID="$2"

  RESP=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"package_id\":$PACKAGE_ID}")
  echo "$RESP" | jq -r '.purchase.id'
}

###############################################################################
# Step 4: Create initial chain A1 -> A2 -> A3 -> A4 -> A5 with purchases
###############################################################################
echo -e "${YELLOW}👥 Step 4: Creating initial chain A1 → A2 → A3 → A4 → A5...${NC}"

echo "  Creating A1 (root)..."
A1_INFO=$(register_user "A1" "a1@test.com")
A1_ID=$(echo "$A1_INFO" | cut -d'|' -f1)
A1_TOKEN=$(echo "$A1_INFO" | cut -d'|' -f2)
A1_PURCHASE_ID=$(purchase_package "$A1_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A1 ID: $A1_ID, Purchase: $A1_PURCHASE_ID${NC}"

echo "  Creating A2 under A1..."
A2_INFO=$(register_user "A2" "a2@test.com" "$A1_ID")
A2_ID=$(echo "$A2_INFO" | cut -d'|' -f1)
A2_TOKEN=$(echo "$A2_INFO" | cut -d'|' -f2)
A2_PURCHASE_ID=$(purchase_package "$A2_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A2 ID: $A2_ID, Purchase: $A2_PURCHASE_ID${NC}"

echo "  Creating A3 under A2..."
A3_INFO=$(register_user "A3" "a3@test.com" "$A2_ID")
A3_ID=$(echo "$A3_INFO" | cut -d'|' -f1)
A3_TOKEN=$(echo "$A3_INFO" | cut -d'|' -f2)
A3_PURCHASE_ID=$(purchase_package "$A3_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A3 ID: $A3_ID, Purchase: $A3_PURCHASE_ID${NC}"

echo "  Creating A4 under A3..."
A4_INFO=$(register_user "A4" "a4@test.com" "$A3_ID")
A4_ID=$(echo "$A4_INFO" | cut -d'|' -f1)
A4_TOKEN=$(echo "$A4_INFO" | cut -d'|' -f2)
A4_PURCHASE_ID=$(purchase_package "$A4_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A4 ID: $A4_ID, Purchase: $A4_PURCHASE_ID${NC}"

echo "  Creating A5 under A4..."
A5_INFO=$(register_user "A5" "a5@test.com" "$A4_ID")
A5_ID=$(echo "$A5_INFO" | cut -d'|' -f1)
A5_TOKEN=$(echo "$A5_INFO" | cut -d'|' -f2)
A5_PURCHASE_ID=$(purchase_package "$A5_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A5 ID: $A5_ID, Purchase: $A5_PURCHASE_ID${NC}"
echo ""

###############################################################################
# Step 5: Recalculate eligibility for all users
###############################################################################
echo -e "${YELLOW}🔄 Step 5: Recalculating eligibility for all users...${NC}"
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' > /dev/null
sleep 3
echo -e "${GREEN}✅ Eligibility recalculated${NC}"
echo ""

###############################################################################
# Step 6: BEFORE DISQUALIFY - Show SPOT / MONTHLY from A5 purchases
###############################################################################
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 BEFORE DISQUALIFICATION - IMPACT OF A5 PURCHASES           ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  u.name as \"Receiver\",
  COUNT(*) FILTER (WHERE le.commission_type = 'SPOT') as \"SPOT Count\",
  COALESCE(SUM(CASE WHEN le.commission_type = 'SPOT' THEN le.amount END),0)::numeric(10,2) as \"SPOT Total\",
  COUNT(*) FILTER (WHERE sc.commission_type = 'MONTHLY') as \"MONTHLY Sched Count\",
  COALESCE(SUM(CASE WHEN sc.commission_type = 'MONTHLY' THEN sc.monthly_amount END),0)::numeric(10,2) as \"MONTHLY Total\"
FROM users u
LEFT JOIN ledger_entries le ON le.receiver_user_id = u.id 
  AND le.commission_type = 'SPOT'
  AND le.purchase_id = $A5_PURCHASE_ID
LEFT JOIN scheduled_commissions sc ON sc.receiver_user_id = u.id 
  AND sc.commission_type = 'MONTHLY'
  AND sc.source_user_id = $A5_ID
GROUP BY u.name
HAVING 
  COUNT(*) FILTER (WHERE le.commission_type = 'SPOT') > 0
  OR COUNT(*) FILTER (WHERE sc.commission_type = 'MONTHLY') > 0
ORDER BY u.name;
"
echo ""

###############################################################################
# Step 7: Simulate 21+ days inactivity for A2 and run disqualification job
###############################################################################
echo -e "${YELLOW}⏳ Step 7: Simulating 21+ days inactivity for A2 and disqualifying...${NC}"

# Move all A2 purchases to 22 days in the past so active_until < (today - 21 days)
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE purchases
SET active_until = NOW() - INTERVAL '22 days'
WHERE user_id = $A2_ID;
"
echo -e "${GREEN}✅ A2 purchases set to expired (>21 days ago)${NC}"

echo "  Running disqualification job (scripts/test-disqualification.ts)..."
npx tsx scripts/test-disqualification.ts
echo ""

echo -e "${BLUE}📌 A2 disqualification flags:${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT id, name, is_disqualified, disqualified_at
FROM users
WHERE id = $A2_ID;
"
echo ""

###############################################################################
# Step 8: A2 buys NEW package after disqualification (reactivation)
###############################################################################
echo -e "${YELLOW}💰 Step 8: A2 purchases NEW package after disqualification...${NC}"
A2_RENEW_PURCHASE_ID=$(purchase_package "$A2_TOKEN" "$PKG_ID")
echo -e "${GREEN}A2 Renew Purchase ID: $A2_RENEW_PURCHASE_ID${NC}"
echo ""

###############################################################################
# Step 9: Create new chain A2 -> A7 -> A8 and purchases
###############################################################################
echo -e "${YELLOW}👥 Step 9: Creating new chain A2 → A7 → A8 with purchases...${NC}"

echo "  Creating A7 under A2..."
A7_INFO=$(register_user "A7" "a7@test.com" "$A2_ID")
A7_ID=$(echo "$A7_INFO" | cut -d'|' -f1)
A7_TOKEN=$(echo "$A7_INFO" | cut -d'|' -f2)
A7_PURCHASE_ID=$(purchase_package "$A7_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A7 ID: $A7_ID, Purchase: $A7_PURCHASE_ID${NC}"

echo "  Creating A8 under A7..."
A8_INFO=$(register_user "A8" "a8@test.com" "$A7_ID")
A8_ID=$(echo "$A8_INFO" | cut -d'|' -f1)
A8_TOKEN=$(echo "$A8_INFO" | cut -d'|' -f2)
A8_PURCHASE_ID=$(purchase_package "$A8_TOKEN" "$PKG_ID")
echo -e "  ${GREEN}A8 ID: $A8_ID, Purchase: $A8_PURCHASE_ID${NC}"
echo ""

###############################################################################
# Step 10: Recalculate eligibility after new chain
###############################################################################
echo -e "${YELLOW}🔄 Step 10: Recalculating eligibility after new-chain purchases...${NC}"
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' > /dev/null
sleep 3
echo -e "${GREEN}✅ Eligibility recalculated${NC}"
echo ""

###############################################################################
# Step 11: AFTER DISQUALIFY + REACTIVATION - Show SPOT / MONTHLY from A7/A8
###############################################################################
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 AFTER DISQUALIFICATION + A2 RENEWAL - IMPACT OF A7/A8      ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}🔎 SPOT commissions from A7/A8 purchases (who received what)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  r.name as \"Receiver\",
  SUM(le.amount)::numeric(10,2) as \"SPOT Total\"
FROM ledger_entries le
JOIN purchases p ON p.id = le.purchase_id
JOIN users r ON r.id = le.receiver_user_id
WHERE le.commission_type = 'SPOT'
  AND p.user_id IN ($A7_ID, $A8_ID)
GROUP BY r.name
ORDER BY r.name;
"
echo ""

echo -e "${BLUE}🔎 MONTHLY scheduled from A7/A8 (who is receiver)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  r.name as \"Receiver\",
  COUNT(*) as \"MONTHLY Count\",
  SUM(sc.monthly_amount)::numeric(10,2) as \"MONTHLY Total\"
FROM scheduled_commissions sc
JOIN users r ON r.id = sc.receiver_user_id
WHERE sc.commission_type = 'MONTHLY'
  AND sc.source_user_id IN ($A7_ID, $A8_ID)
GROUP BY r.name
ORDER BY r.name;
"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}✅ TEST COMPLETE                                                ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Expected key condition:"
echo "  - A1 should NOT appear in SPOT / MONTHLY receivers for A7/A8 purchases."
echo "  - After reactivation, A2 SHOULD appear (as per SPOT/MONTHLY rules) along with A7/A8."
echo ""


