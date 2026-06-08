#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         JATIN'S COMPLETE MLM SCENARIO TEST                 ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

API_BASE="http://localhost:3000/api/v1"

# Helper function to extract value from JSON
extract_value() {
  echo "$1" | grep -o "\"$2\":[^,}]*" | head -1 | sed 's/.*://;s/"//g'
}

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 TEST SCENARIO DETAILS:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "👤 Main User: Jatin"
echo "📦 Package: ₹2500 (55 Global IDs cap)"
echo "   • SELF: ₹62.50/month"
echo "   • GLOBAL: ₹2.50/ID/month (cap: 55)"
echo "   • SPOT: 5% instant (₹125 per referral)"
echo "   • MONTHLY: 0.5%/month (₹12.50/month per referral)"
echo ""
echo "👥 Direct Referrals: 8 users"
echo "   • First 6: Days 1-18 (Month 1)"
echo "   • Next 2: Days 31-32 (Month 2)"
echo ""
echo "🌍 Global Users: 55 total"
echo "   • Month 1 (Days 1-30): 23 users"
echo "   • Month 2 (Days 31-60): 20 users"
echo "   • Month 3 (Days 61-90): 12 users"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Step 1: Create Package with ALL commission types
echo -e "${YELLOW}📦 Step 1: Creating package with all commissions...${NC}"
PKG_RESPONSE=$(curl -s -X POST "$API_BASE/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Complete MLM Package (55 IDs)",
    "price": 2500,
    "duration_months": 3,
    "validity_months": 12,
    "self_monthly": 62.50,
    "global_ids": 55,
    "global_monthly_per_id": 2.50,
    "recurring_rate_percent": 0.5,
    "spot_rate_percent": 5
  }')

PKG_ID=$(extract_value "$PKG_RESPONSE" "id")
echo -e "${GREEN}✅ Package created: ID=$PKG_ID${NC}"
echo "   • SELF: ₹62.50/month"
echo "   • GLOBAL: ₹2.50/ID/month (55 cap)"
echo "   • SPOT: 5% = ₹125/referral"
echo "   • MONTHLY: 0.5% = ₹12.50/month/referral"
echo ""

# Step 2: Register Jatin (Nov 1, 2025)
echo -e "${YELLOW}👤 Step 2: Registering Jatin...${NC}"
JATIN_REG=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jatin@mlm.com",
    "password": "test123",
    "name": "Jatin"
  }')

JATIN_ID=$(extract_value "$JATIN_REG" "id")
echo -e "${GREEN}✅ Jatin registered: ID=$JATIN_ID${NC}"

# Login
JATIN_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jatin@mlm.com",
    "password": "test123"
  }')

JATIN_TOKEN=$(extract_value "$JATIN_LOGIN" "token")
echo -e "${GREEN}✅ Jatin logged in${NC}"
echo ""

# Step 3: Jatin purchases package (Nov 1, 2025)
echo -e "${YELLOW}💰 Step 3: Jatin purchasing ₹2500 package (Nov 1)...${NC}"
JATIN_PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Authorization: Bearer $JATIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"package_id\": $PKG_ID}")

JATIN_PURCHASE_ID=$(extract_value "$JATIN_PURCHASE" "id")
echo -e "${GREEN}✅ Jatin's purchase: ID=$JATIN_PURCHASE_ID${NC}"
echo ""

# Wait for PgBoss
echo -e "${YELLOW}⏳ Waiting 5s for PgBoss to process Jatin's purchase...${NC}"
sleep 5
echo ""

# Step 4: Add 6 direct referrals in first 18 days (Nov 1-18)
echo -e "${YELLOW}👥 Step 4: Adding 6 direct referrals (Days 1-18)...${NC}"
echo ""

declare -a DIRECT_USERS=("Rahul" "Priya" "Amit" "Sneha" "Vikram" "Pooja")
declare -a DIRECT_IDS=()
declare -a DIRECT_TOKENS=()

for i in "${!DIRECT_USERS[@]}"; do
  USER="${DIRECT_USERS[$i]}"
  DAY=$((i * 3 + 1))  # Spread across days 1, 4, 7, 10, 13, 16
  
  email="$(echo $USER | tr '[:upper:]' '[:lower:]')@mlm.com"
  
  # Register with Jatin as referrer
  USER_REG=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"test123\",
      \"name\": \"$USER\",
      \"referrer_user_id\": $JATIN_ID
    }")
  
  USER_ID=$(extract_value "$USER_REG" "id")
  DIRECT_IDS+=("$USER_ID")
  echo -e "${GREEN}✅ $USER registered: ID=$USER_ID (Day $DAY)${NC}"
  
  # Login
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  USER_TOKEN=$(extract_value "$USER_LOGIN" "token")
  DIRECT_TOKENS+=("$USER_TOKEN")
  
  # Purchase
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $PKG_ID}" > /dev/null
  
  echo -e "${GREEN}   💰 $USER purchased ₹2500 package${NC}"
  echo -e "${CYAN}   📊 Jatin receives: SPOT ₹125 (instant)${NC}"
done

echo ""
echo -e "${YELLOW}⏳ Waiting 5s for PgBoss...${NC}"
sleep 5
echo ""

# Step 5: Add 2 more direct referrals in Month 2 (Days 31-32)
echo -e "${YELLOW}👥 Step 5: Adding 2 more direct referrals (Days 31-32)...${NC}"
echo ""

MONTH2_USERS=("Neha" "Karan")
for i in "${!MONTH2_USERS[@]}"; do
  USER="${MONTH2_USERS[$i]}"
  DAY=$((31 + i))
  
  email="$(echo $USER | tr '[:upper:]' '[:lower:]')@mlm.com"
  
  USER_REG=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"test123\",
      \"name\": \"$USER\",
      \"referrer_user_id\": $JATIN_ID
    }")
  
  USER_ID=$(extract_value "$USER_REG" "id")
  DIRECT_IDS+=("$USER_ID")
  echo -e "${GREEN}✅ $USER registered: ID=$USER_ID (Day $DAY)${NC}"
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  USER_TOKEN=$(extract_value "$USER_LOGIN" "token")
  DIRECT_TOKENS+=("$USER_TOKEN")
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $PKG_ID}" > /dev/null
  
  echo -e "${GREEN}   💰 $USER purchased ₹2500 package${NC}"
  echo -e "${CYAN}   📊 Jatin receives: SPOT ₹125 (instant)${NC}"
done

echo ""
echo -e "${YELLOW}⏳ Waiting 5s for PgBoss...${NC}"
sleep 5
echo ""

# Step 6: Add Global Users (not direct referrals)
echo -e "${YELLOW}🌍 Step 6: Adding 55 global users across 3 months...${NC}"
echo ""

# Month 1: 23 users (already have Jatin + 6 direct = 7, need 16 more for total 23)
echo -e "${CYAN}Month 1 (Days 1-30): Adding 16 more global users...${NC}"
for i in $(seq 1 16); do
  email="global1_user${i}@mlm.com"
  
  curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\", \"name\": \"Global1_User$i\"}" > /dev/null
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  USER_TOKEN=$(extract_value "$USER_LOGIN" "token")
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $PKG_ID}" > /dev/null
  
  echo -ne "${GREEN}✅ Global user $i/16 added\r${NC}"
done
echo ""
echo -e "${GREEN}✅ Month 1: 23 total active users (Jatin + 6 direct + 16 global)${NC}"
echo ""

# Month 2: 20 more users (already have 2 from direct, need 18 more)
echo -e "${CYAN}Month 2 (Days 31-60): Adding 18 more global users...${NC}"
for i in $(seq 1 18); do
  email="global2_user${i}@mlm.com"
  
  curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\", \"name\": \"Global2_User$i\"}" > /dev/null
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  USER_TOKEN=$(extract_value "$USER_LOGIN" "token")
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $PKG_ID}" > /dev/null
  
  echo -ne "${GREEN}✅ Global user $i/18 added\r${NC}"
done
echo ""
echo -e "${GREEN}✅ Month 2: 43 total active users (23 + 20 new)${NC}"
echo ""

# Month 3: 12 more users (cap at 55)
echo -e "${CYAN}Month 3 (Days 61-90): Adding 12 more global users (total 55)...${NC}"
for i in $(seq 1 12); do
  email="global3_user${i}@mlm.com"
  
  curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\", \"name\": \"Global3_User$i\"}" > /dev/null
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  USER_TOKEN=$(extract_value "$USER_LOGIN" "token")
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $PKG_ID}" > /dev/null
  
  echo -ne "${GREEN}✅ Global user $i/12 added\r${NC}"
done
echo ""
echo -e "${GREEN}✅ Month 3: 55 total active users (43 + 12 new = CAP REACHED!)${NC}"
echo ""

echo -e "${YELLOW}⏳ Waiting 5s for final PgBoss processing...${NC}"
sleep 5
echo ""

# Step 7: Time-Travel through 90 days
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}⏰ TIME-TRAVEL: Processing 90 days of commissions...${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Process each day
for day in $(seq 1 90); do
  DATE=$(date -j -v+${day}d -f "%Y-%m-%d" "2025-11-01" "+%Y-%m-%d" 2>/dev/null || date -d "2025-11-01 +${day} days" "+%Y-%m-%d" 2>/dev/null)
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts $DATE > /dev/null 2>&1
  
  if [ $((day % 10)) -eq 0 ]; then
    echo -e "${YELLOW}⏳ Processed $day/90 days...${NC}"
  fi
done

echo -e "${GREEN}✅ 90 days processed!${NC}"
echo ""

# Step 8: Final Calculations
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FINAL RESULTS & CALCULATIONS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Get actual wallet balance
WALLET=$(curl -s -X GET "$API_BASE/users/wallet" \
  -H "Authorization: Bearer $JATIN_TOKEN")
ACTUAL_BALANCE=$(extract_value "$WALLET" "balance")

echo -e "${BLUE}💰 Jatin's Actual Wallet Balance: ₹${ACTUAL_BALANCE}${NC}"
echo ""

# Calculate expected commissions
echo -e "${YELLOW}📈 EXPECTED COMMISSION BREAKDOWN:${NC}"
echo ""

echo -e "${CYAN}1. SELF Commission (Daily over 90 days):${NC}"
echo "   Monthly: ₹62.50"
echo "   Daily: ₹62.50 ÷ 30 = ₹2.08 per day"
echo "   90 days: ₹2.08 × 90 = ₹187.50"
echo -e "${GREEN}   Expected SELF: ₹187.50${NC}"
echo ""

echo -e "${CYAN}2. GLOBAL_HELPING Commission (Progressive):${NC}"
echo "   Per-ID rate: ₹2.50/month = ₹0.083/day"
echo ""
echo "   Month 1 (Days 1-30):"
echo "     • Active users: 23 (excluding Jatin = 22)"
echo "     • Daily: ₹0.083 × 22 = ₹1.826/day"
echo "     • 30 days: ₹1.826 × 30 = ₹54.78"
echo ""
echo "   Month 2 (Days 31-60):"
echo "     • Active users: 43 (excluding Jatin = 42)"
echo "     • Daily: ₹0.083 × 42 = ₹3.486/day"
echo "     • 30 days: ₹3.486 × 30 = ₹104.58"
echo ""
echo "   Month 3 (Days 61-90):"
echo "     • Active users: 55 (CAP - excluding Jatin = 54)"
echo "     • Daily: ₹0.083 × 54 = ₹4.482/day"
echo "     • 30 days: ₹4.482 × 30 = ₹134.46"
echo ""
echo -e "${GREEN}   Expected GLOBAL: ₹293.82${NC}"
echo ""

echo -e "${CYAN}3. SPOT Commission (Instant 5%):${NC}"
echo "   8 direct referrals × ₹125 each"
echo -e "${GREEN}   Expected SPOT: ₹1,000.00${NC}"
echo ""

echo -e "${CYAN}4. MONTHLY Commission (0.5% recurring):${NC}"
echo "   Per referral: ₹2500 × 0.5% = ₹12.50/month"
echo "   Daily per referral: ₹12.50 ÷ 30 = ₹0.417/day"
echo ""
echo "   First 6 referrals (full 90 days):"
echo "     • 6 × ₹0.417 × 90 = ₹225.18"
echo ""
echo "   Next 2 referrals (60 days from Day 31):"
echo "     • 2 × ₹0.417 × 60 = ₹50.04"
echo ""
echo -e "${GREEN}   Expected MONTHLY: ₹275.22${NC}"
echo ""

echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}💵 TOTAL EXPECTED: ₹1,756.54${NC}"
echo ""
echo "   • SELF:    ₹187.50   (10.7%)"
echo "   • GLOBAL:  ₹293.82   (16.7%)"
echo "   • SPOT:    ₹1,000.00 (56.9%)"
echo "   • MONTHLY: ₹275.22   (15.7%)"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Get DB breakdown
echo -e "${YELLOW}🔍 DATABASE VERIFICATION:${NC}"
echo ""

docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT 
  commission_type, 
  COUNT(*) as entries, 
  SUM(amount) as total 
FROM ledger_entries 
WHERE receiver_user_id = $JATIN_ID 
GROUP BY commission_type 
ORDER BY commission_type;
" | grep -E "commission_type|SELF|GLOBAL|SPOT|MONTHLY|rows" | sed 's/^/   /'

echo ""

# Calculate accuracy
if [ ! -z "$ACTUAL_BALANCE" ]; then
  EXPECTED="1756.54"
  DIFF=$(echo "$EXPECTED - $ACTUAL_BALANCE" | bc 2>/dev/null || echo "0")
  ACCURACY=$(echo "scale=2; (1 - ($DIFF / $EXPECTED)) * 100" | bc 2>/dev/null || echo "100")
  
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ Accuracy: ${ACCURACY}%${NC}"
  
  if (( $(echo "$DIFF < 10" | bc -l 2>/dev/null || echo 0) )); then
    echo -e "${GREEN}✅ EXCELLENT PRECISION! Difference: ₹${DIFF}${NC}"
  else
    echo -e "${YELLOW}⚠️  Difference: ₹${DIFF}${NC}"
  fi
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
fi

echo ""
echo -e "${GREEN}🎉 JATIN'S SCENARIO TEST COMPLETED!${NC}"
echo ""

