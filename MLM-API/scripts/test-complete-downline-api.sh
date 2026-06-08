#!/bin/bash
# Complete Downline Test via API: Mukesh → R1 → S1 → K1
# Tests automatic qualification and SPOT commission release
# Mukesh: Level 3 qualified
# R1: Level 2 qualified  
# S1: Level 1 qualified

set -e

API_BASE="http://localhost:3000/api/v1"
ADMIN_TOKEN="dev-admin"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  COMPLETE DOWNLINE TEST VIA API: MUKESH → R1 → S1 → K1       ║"
echo "║  Testing Automatic Qualification & SPOT Release               ║"
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

# Step 2: Set business requirements via DB (for testing)
echo -e "${YELLOW}📋 Step 2: Setting business requirements...${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
UPDATE levels SET business_requirement = '{\"required_leg_count\": 1, \"required_leg_min_amount\": 2500}'::jsonb WHERE level = 1;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 2, \"required_leg_min_amount\": 5000}'::jsonb WHERE level = 2;
UPDATE levels SET business_requirement = '{\"required_leg_count\": 3, \"required_leg_min_amount\": 10000}'::jsonb WHERE level = 3;
" > /dev/null
echo -e "${GREEN}✅ Business requirements set${NC}"
echo "  Level 1: 1 leg with ₹2,500"
echo "  Level 2: 2 legs with ₹5,000 each"
echo "  Level 3: 3 legs with ₹10,000 each"
echo ""

# Step 3: Create package via API
echo -e "${YELLOW}📦 Step 3: Creating package via API...${NC}"
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

# Step 4: Register Mukesh via API
echo -e "${YELLOW}👤 Step 4: Registering Mukesh via API...${NC}"
MUKESH_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mukesh","email":"mukesh@test.com"}')
MUKESH_ID=$(echo "$MUKESH_RESP" | jq -r '.id')

MUKESH_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mukesh@test.com"}')
MUKESH_TOKEN=$(echo "$MUKESH_LOGIN" | jq -r '.token')

# Mukesh purchases via API
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MUKESH_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 2
echo -e "${GREEN}✅ Mukesh ID: $MUKESH_ID (purchased)${NC}"
echo ""

# Step 5: Register R1 under Mukesh via API
echo -e "${YELLOW}👥 Step 5: Registering R1 under Mukesh via API...${NC}"
R1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"R1\",\"email\":\"r1@test.com\",\"referrer_user_id\":$MUKESH_ID}")
R1_ID=$(echo "$R1_RESP" | jq -r '.id')

R1_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"r1@test.com"}')
R1_TOKEN=$(echo "$R1_LOGIN" | jq -r '.token')

# R1 purchases via API
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $R1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 2
echo -e "${GREEN}✅ R1 ID: $R1_ID (purchased)${NC}"
echo ""

# Step 6: Register S1 under R1 via API
echo -e "${YELLOW}👥 Step 6: Registering S1 under R1 via API...${NC}"
S1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"S1\",\"email\":\"s1@test.com\",\"referrer_user_id\":$R1_ID}")
S1_ID=$(echo "$S1_RESP" | jq -r '.id')

S1_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"s1@test.com"}')
S1_TOKEN=$(echo "$S1_LOGIN" | jq -r '.token')

# S1 purchases via API
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $S1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 2
echo -e "${GREEN}✅ S1 ID: $S1_ID (purchased)${NC}"
echo ""

# Step 7: Register K1 under S1 via API
echo -e "${YELLOW}👥 Step 7: Registering K1 under S1 via API...${NC}"
K1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"K1\",\"email\":\"k1@test.com\",\"referrer_user_id\":$S1_ID}")
K1_ID=$(echo "$K1_RESP" | jq -r '.id')

K1_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"k1@test.com"}')
K1_TOKEN=$(echo "$K1_LOGIN" | jq -r '.token')

# K1 purchases via API
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $K1_TOKEN" \
  -d "{\"package_id\":$PKG_ID}" > /dev/null
sleep 2
echo -e "${GREEN}✅ K1 ID: $K1_ID (purchased)${NC}"
echo ""

# Step 8: Create ₹5,000 package for qualification
echo -e "${YELLOW}📦 Step 8: Creating ₹5,000 package for qualification...${NC}"
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
echo -e "${GREEN}✅ ₹5,000 Package created: ID=$PKG_5K_ID${NC}"
echo ""

# Step 9: Create ₹10,000 package for Level 3 qualification
echo -e "${YELLOW}📦 Step 9: Creating ₹10,000 package for Level 3 qualification...${NC}"
PKG_10K_RESP=$(curl -s -X POST "$API_BASE/admin/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name":"₹10,000 Course",
    "price":10000,
    "validity_months":13,
    "self_monthly":250.00,
    "global_ids":55,
    "global_monthly_per_id":25.00,
    "recurring_rate_percent":0.5
  }')
PKG_10K_ID=$(echo "$PKG_10K_RESP" | jq -r '.id')
echo -e "${GREEN}✅ ₹10,000 Package created: ID=$PKG_10K_ID${NC}"
echo ""

# Step 10: Qualify S1 for Level 1 (needs 1 leg with ₹2,500 - already has K1)
echo -e "${YELLOW}📈 Step 10: S1 should auto-qualify for Level 1 (has K1 with ₹2,500)...${NC}"
echo "  Triggering eligibility recalculation via API..."
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"user_id\":$S1_ID}" > /dev/null
sleep 3
echo -e "${GREEN}✅ Eligibility recalculated for S1${NC}"
echo ""

# Step 11: Qualify R1 for Level 2 (needs 2 legs with ₹5,000 each)
echo -e "${YELLOW}📈 Step 11: Qualifying R1 for Level 2 (needs 2 legs with ₹5,000 each)...${NC}"
echo "  Creating 2 more direct referrals for R1..."

# Create R1Leg2
R1LEG2_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"R1Leg2\",\"email\":\"r1leg2@test.com\",\"referrer_user_id\":$R1_ID}")
R1LEG2_ID=$(echo "$R1LEG2_RESP" | jq -r '.id')
R1LEG2_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"r1leg2@test.com"}')
R1LEG2_TOKEN=$(echo "$R1LEG2_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $R1LEG2_TOKEN" \
  -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
sleep 2

# Create R1Leg3
R1LEG3_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"R1Leg3\",\"email\":\"r1leg3@test.com\",\"referrer_user_id\":$R1_ID}")
R1LEG3_ID=$(echo "$R1LEG3_RESP" | jq -r '.id')
R1LEG3_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"r1leg3@test.com"}')
R1LEG3_TOKEN=$(echo "$R1LEG3_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $R1LEG3_TOKEN" \
  -d "{\"package_id\":$PKG_5K_ID}" > /dev/null
sleep 2

echo "  Triggering eligibility recalculation via API..."
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"user_id\":$R1_ID}" > /dev/null
sleep 3
echo -e "${GREEN}✅ R1 should now qualify for Level 2${NC}"
echo ""

# Step 12: Qualify Mukesh for Level 3 (needs 3 legs with ₹10,000 each)
echo -e "${YELLOW}📈 Step 12: Qualifying Mukesh for Level 3 (needs 3 legs with ₹10,000 each)...${NC}"
echo "  Creating 3 more direct referrals for Mukesh..."

# Create MukeshLeg2
MLEG2_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"MukeshLeg2\",\"email\":\"mleg2@test.com\",\"referrer_user_id\":$MUKESH_ID}")
MLEG2_ID=$(echo "$MLEG2_RESP" | jq -r '.id')
MLEG2_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mleg2@test.com"}')
MLEG2_TOKEN=$(echo "$MLEG2_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MLEG2_TOKEN" \
  -d "{\"package_id\":$PKG_10K_ID}" > /dev/null
sleep 2

# Create MukeshLeg3
MLEG3_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"MukeshLeg3\",\"email\":\"mleg3@test.com\",\"referrer_user_id\":$MUKESH_ID}")
MLEG3_ID=$(echo "$MLEG3_RESP" | jq -r '.id')
MLEG3_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mleg3@test.com"}')
MLEG3_TOKEN=$(echo "$MLEG3_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MLEG3_TOKEN" \
  -d "{\"package_id\":$PKG_10K_ID}" > /dev/null
sleep 2

# Create MukeshLeg4
MLEG4_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"MukeshLeg4\",\"email\":\"mleg4@test.com\",\"referrer_user_id\":$MUKESH_ID}")
MLEG4_ID=$(echo "$MLEG4_RESP" | jq -r '.id')
MLEG4_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"mleg4@test.com"}')
MLEG4_TOKEN=$(echo "$MLEG4_LOGIN" | jq -r '.token')
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MLEG4_TOKEN" \
  -d "{\"package_id\":$PKG_10K_ID}" > /dev/null
sleep 2

echo "  Triggering eligibility recalculation via API..."
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"user_id\":$MUKESH_ID}" > /dev/null
sleep 3
echo -e "${GREEN}✅ Mukesh should now qualify for Level 3${NC}"
echo ""

# Step 13: Final eligibility recalculation for all users
echo -e "${YELLOW}🔄 Step 13: Final eligibility recalculation for all users...${NC}"
curl -s -X POST "$API_BASE/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' > /dev/null
sleep 5
echo -e "${GREEN}✅ All users eligibility recalculated${NC}"
echo ""

# Step 14: Comprehensive Summary Table
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 COMPREHENSIVE SUMMARY TABLE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

docker compose exec -T db psql -U postgres -d mlm -c "
WITH user_info AS (
  SELECT 
    u.id,
    u.name,
    COALESCE(ub.balance, 0)::numeric(10,2) as wallet_balance,
    le.eligibility
  FROM users u
  LEFT JOIN user_balances ub ON ub.user_id = u.id
  LEFT JOIN level_eligibility le ON le.user_id = u.id
  WHERE u.name IN ('Mukesh', 'R1', 'S1', 'K1')
),
spot_credited AS (
  SELECT 
    receiver_user_id,
    COUNT(*) as spot_count,
    SUM(amount)::numeric(10,2) as spot_total
  FROM ledger_entries
  WHERE commission_type = 'SPOT'
  GROUP BY receiver_user_id
),
spot_pending AS (
  SELECT 
    receiver_user_id,
    COUNT(*) as pending_count,
    SUM(amount)::numeric(10,2) as pending_total
  FROM pending_commissions
  WHERE commission_type = 'SPOT'
  GROUP BY receiver_user_id
),
monthly_scheduled AS (
  SELECT 
    receiver_user_id,
    COUNT(*) as monthly_count,
    SUM(monthly_amount)::numeric(10,2) as monthly_total
  FROM scheduled_commissions
  WHERE commission_type = 'MONTHLY'
  GROUP BY receiver_user_id
),
qualified_level AS (
  SELECT 
    ui.id,
    ui.name,
    (
      SELECT MAX((key)::int)
      FROM jsonb_each_text(ui.eligibility::jsonb)
      WHERE value = 'true'
    ) as max_level
  FROM user_info ui
)
SELECT 
  ui.name as \"User\",
  COALESCE(ql.max_level, 0) as \"Qualified Level\",
  ui.wallet_balance as \"Wallet Balance\",
  COALESCE(sc.spot_count, 0) as \"SPOT Credited (Count)\",
  COALESCE(sc.spot_total, 0)::numeric(10,2) as \"SPOT Credited (Amount)\",
  COALESCE(sp.pending_count, 0) as \"SPOT Pending (Count)\",
  COALESCE(sp.pending_total, 0)::numeric(10,2) as \"SPOT Pending (Amount)\",
  COALESCE(ms.monthly_count, 0) as \"MONTHLY Scheduled (Count)\",
  COALESCE(ms.monthly_total, 0)::numeric(10,2) as \"MONTHLY Scheduled (Amount)\"
FROM user_info ui
LEFT JOIN qualified_level ql ON ql.id = ui.id
LEFT JOIN spot_credited sc ON sc.receiver_user_id = ui.id
LEFT JOIN spot_pending sp ON sp.receiver_user_id = ui.id
LEFT JOIN monthly_scheduled ms ON ms.receiver_user_id = ui.id
ORDER BY 
  CASE ui.name
    WHEN 'Mukesh' THEN 1
    WHEN 'R1' THEN 2
    WHEN 'S1' THEN 3
    WHEN 'K1' THEN 4
  END;
"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 DETAILED BREAKDOWN BY LEVEL${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Mukesh (Expected: Level 3 Qualified)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries
WHERE receiver_user_id = $MUKESH_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"

echo ""
echo -e "${BLUE}R1 (Expected: Level 2 Qualified)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries
WHERE receiver_user_id = $R1_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"

echo ""
echo -e "${BLUE}S1 (Expected: Level 1 Qualified)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries
WHERE receiver_user_id = $S1_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"

echo ""
echo -e "${BLUE}K1 (Expected: No Level)${NC}"
docker compose exec -T db psql -U postgres -d mlm -c "
SELECT 
  (metadata->>'level')::int as level,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total
FROM ledger_entries
WHERE receiver_user_id = $K1_ID 
  AND commission_type = 'SPOT'
GROUP BY (metadata->>'level')::int
ORDER BY (metadata->>'level')::int;
"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}✅ TEST COMPLETE${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Expected Results:"
echo "  ✅ Mukesh: Level 3 qualified - SPOT from K1 (Level 3) should be credited"
echo "  ✅ R1: Level 2 qualified - SPOT from K1 (Level 2) should be credited"
echo "  ✅ S1: Level 1 qualified - SPOT from K1 (Level 1) should be credited"
echo "  ✅ K1: No level - No SPOT commissions"
echo ""
echo "All SPOT commissions should be automatically released when users qualify!"

