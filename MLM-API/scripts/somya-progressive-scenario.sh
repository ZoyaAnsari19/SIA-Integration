#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      SOMYA'S PROGRESSIVE MLM SCENARIO TEST                 ║"
echo "║      Users Added in Different Months (REALISTIC)           ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

API_BASE="http://localhost:3000/api/v1"

extract_value() {
  echo "$1" | grep -o "\"$2\":[^,}]*" | head -1 | sed 's/.*://;s/"//g;s/\r//g' | tr -d '\n\r'
}

# Get package ID (should be 1 after fresh setup)
PKG_ID=1

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 TEST SCENARIO:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "👤 Main User: Somya"
echo "📦 Package: Elite MLM (325 IDs) - ₹15,000"
echo ""
echo "📅 Timeline (PROGRESSIVE):"
echo "   • Nov 1 (Day 1): Somya + 10 direct + 114 global = 125 users"
echo "   • Dec 1 (Day 31): 15 direct + 75 global = 90 new users"
echo "   • Jan 1 (Day 61): 12 direct + 98 global = 110 new users"
echo ""
echo "   Total: 325 users over 3 months"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Helper function to register user on specific date
register_user_on_date() {
  local name=$1
  local email=$2
  local referrer_id=$3
  local package_id=$4
  local date=$5
  
  # Register user (with or without referrer)
  local reg_payload
  if [ "$referrer_id" = "null" ] || [ -z "$referrer_id" ]; then
    reg_payload="{\"email\": \"$email\", \"password\": \"test123\", \"name\": \"$name\"}"
  else
    reg_payload="{\"email\": \"$email\", \"password\": \"test123\", \"name\": \"$name\", \"referrer_user_id\": $referrer_id}"
  fi
  
  local reg_response=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "$reg_payload")
  
  local user_id=$(extract_value "$reg_response" "id")
  
  if [ -z "$user_id" ] || [ "$user_id" = "null" ]; then
    echo -e "${RED}❌ Failed to register $name${NC}"
    return 1
  fi
  
  # Login
  local login_response=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  local token=$(extract_value "$login_response" "token")
  
  # Purchase
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $package_id}" > /dev/null
  
  # Update purchase date in database
  docker exec mlm-db-1 psql -U postgres -d mlm -c "
    UPDATE purchases 
    SET purchased_at = '$date'::timestamptz,
        active_until = ('$date'::timestamptz + interval '12 months')
    WHERE user_id = $user_id;
  " > /dev/null 2>&1
  
  echo "$user_id"
}

echo -e "${YELLOW}👤 Step 1: Registering Somya (Nov 1, 2025)...${NC}"
SOMYA_REG=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "somya@mlm.com",
    "password": "test123",
    "name": "Somya"
  }')

SOMYA_ID=$(extract_value "$SOMYA_REG" "id")
echo -e "${GREEN}✅ Somya registered: ID=$SOMYA_ID${NC}"

# Login and purchase
SOMYA_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "somya@mlm.com", "password": "test123"}')

SOMYA_TOKEN=$(extract_value "$SOMYA_LOGIN" "token")

curl -s -X POST "$API_BASE/purchases" \
  -H "Authorization: Bearer $SOMYA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"package_id\": $PKG_ID}" > /dev/null

# Set Somya's purchase date to Nov 1
docker exec mlm-db-1 psql -U postgres -d mlm -c "
  UPDATE purchases 
  SET purchased_at = '2025-11-01 00:00:00+00'::timestamptz,
      active_until = '2026-11-01 00:00:00+00'::timestamptz
  WHERE user_id = $SOMYA_ID;
" > /dev/null

echo -e "${GREEN}✅ Somya's purchase date set to Nov 1, 2025${NC}"
echo ""

echo -e "${YELLOW}⏳ Waiting 5s for PgBoss...${NC}"
sleep 5
echo ""

# ==========================================
# MONTH 1: November (Day 1)
# ==========================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📅 MONTH 1 - NOVEMBER 1, 2025 (Day 1)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}👥 Adding 10 direct referrals...${NC}"
MONTH1_DIRECT=("Raj" "Priya" "Amit" "Sneha" "Vikram" "Pooja" "Ravi" "Sita" "Arjun" "Kavita")
MONTH1_COUNT=0
for name in "${MONTH1_DIRECT[@]}"; do
  email="$(echo $name | tr '[:upper:]' '[:lower:]')@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "$SOMYA_ID" "$PKG_ID" "2025-11-01 00:00:00+00")
  if [ ! -z "$user_id" ]; then
    echo -e "${GREEN}✅ $name (ID=$user_id) - Nov 1${NC}"
    MONTH1_COUNT=$((MONTH1_COUNT + 1))
  fi
done

echo ""
echo -e "${YELLOW}🌍 Adding 114 global users...${NC}"
for i in $(seq 1 114); do
  name="M1_Global${i}"
  email="m1_global${i}@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "null" "$PKG_ID" "2025-11-01 00:00:00+00")
  if [ $((i % 20)) -eq 0 ]; then
    echo -ne "${GREEN}✅ Month 1 global: $i/114 added\r${NC}"
  fi
done
echo ""
echo -e "${GREEN}✅ Month 1 complete: 125 total users (1 + 10 + 114)${NC}"
echo ""

# Run daily commissions for November (30 days)
echo -e "${YELLOW}⏰ Processing November daily commissions (30 days)...${NC}"
for day in $(seq 1 30); do
  date=$(date -j -v+${day}d -f "%Y-%m-%d" "2025-11-01" "+%Y-%m-%d" 2>/dev/null || date -d "2025-11-01 +${day} days" "+%Y-%m-%d" 2>/dev/null)
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts $date > /dev/null 2>&1
  if [ $((day % 10)) -eq 0 ]; then
    echo -e "${CYAN}   ✓ Day $day/30 processed${NC}"
  fi
done
echo -e "${GREEN}✅ November complete!${NC}"
echo ""

# ==========================================
# MONTH 2: December (Day 31)
# ==========================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📅 MONTH 2 - DECEMBER 1, 2025 (Day 31)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}👥 Adding 15 direct referrals...${NC}"
MONTH2_DIRECT=("Neha" "Karan" "Deepak" "Anjali" "Rohit" "Divya" "Sanjay" "Nisha" "Manish" "Ritu" "Anil" "Geeta" "Suresh" "Radha" "Vijay")
MONTH2_COUNT=0
for name in "${MONTH2_DIRECT[@]}"; do
  email="$(echo $name | tr '[:upper:]' '[:lower:]')@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "$SOMYA_ID" "$PKG_ID" "2025-12-01 00:00:00+00")
  if [ ! -z "$user_id" ]; then
    echo -e "${GREEN}✅ $name (ID=$user_id) - Dec 1${NC}"
    MONTH2_COUNT=$((MONTH2_COUNT + 1))
  fi
done

echo ""
echo -e "${YELLOW}🌍 Adding 75 global users...${NC}"
for i in $(seq 1 75); do
  name="M2_Global${i}"
  email="m2_global${i}@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "null" "$PKG_ID" "2025-12-01 00:00:00+00")
  if [ $((i % 15)) -eq 0 ]; then
    echo -ne "${GREEN}✅ Month 2 global: $i/75 added\r${NC}"
  fi
done
echo ""
echo -e "${GREEN}✅ Month 2 complete: 215 total users (125 + 90 new)${NC}"
echo ""

# Run daily commissions for December (31 days)
echo -e "${YELLOW}⏰ Processing December daily commissions (31 days)...${NC}"
for day in $(seq 31 61); do
  date=$(date -j -v+${day}d -f "%Y-%m-%d" "2025-11-01" "+%Y-%m-%d" 2>/dev/null || date -d "2025-11-01 +${day} days" "+%Y-%m-%d" 2>/dev/null)
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts $date > /dev/null 2>&1
  if [ $(((day - 30) % 10)) -eq 0 ]; then
    echo -e "${CYAN}   ✓ Day $((day - 30))/31 processed${NC}"
  fi
done
echo -e "${GREEN}✅ December complete!${NC}"
echo ""

# ==========================================
# MONTH 3: January (Day 61)
# ==========================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📅 MONTH 3 - JANUARY 1, 2026 (Day 61)${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}👥 Adding 12 direct referrals...${NC}"
MONTH3_DIRECT=("Mohan" "Seema" "Rakesh" "Poonam" "Naveen" "Shweta" "Rajesh" "Meena" "Dinesh" "Sunita" "Ramesh" "Jyoti")
MONTH3_COUNT=0
for name in "${MONTH3_DIRECT[@]}"; do
  email="$(echo $name | tr '[:upper:]' '[:lower:]')@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "$SOMYA_ID" "$PKG_ID" "2026-01-01 00:00:00+00")
  if [ ! -z "$user_id" ]; then
    echo -e "${GREEN}✅ $name (ID=$user_id) - Jan 1${NC}"
    MONTH3_COUNT=$((MONTH3_COUNT + 1))
  fi
done

echo ""
echo -e "${YELLOW}🌍 Adding 98 global users (CAP: 325)...${NC}"
for i in $(seq 1 98); do
  name="M3_Global${i}"
  email="m3_global${i}@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "null" "$PKG_ID" "2026-01-01 00:00:00+00")
  if [ $((i % 20)) -eq 0 ]; then
    echo -ne "${GREEN}✅ Month 3 global: $i/98 added\r${NC}"
  fi
done
echo ""
echo -e "${GREEN}✅ Month 3 complete: 325 total users (CAP REACHED!)${NC}"
echo ""

# Run daily commissions for January (30 days)
echo -e "${YELLOW}⏰ Processing January daily commissions (30 days)...${NC}"
for day in $(seq 62 91); do
  date=$(date -j -v+${day}d -f "%Y-%m-%d" "2025-11-01" "+%Y-%m-%d" 2>/dev/null || date -d "2025-11-01 +${day} days" "+%Y-%m-%d" 2>/dev/null)
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts $date > /dev/null 2>&1
  if [ $(((day - 61) % 10)) -eq 0 ]; then
    echo -e "${CYAN}   ✓ Day $((day - 61))/30 processed${NC}"
  fi
done
echo -e "${GREEN}✅ January complete!${NC}"
echo ""

# ==========================================
# FINAL RESULTS
# ==========================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 FINAL RESULTS - PROGRESSIVE CALCULATION${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Get final wallet balance
FINAL_WALLET=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT balance FROM user_balances WHERE user_id = $SOMYA_ID;")
echo -e "${BLUE}💰 Somya's Final Wallet: ₹${FINAL_WALLET}${NC}"
echo ""

# Get commission breakdown
echo -e "${YELLOW}📈 Commission Breakdown:${NC}"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT 
  commission_type as \"Type\",
  COUNT(*) as \"Entries\",
  ROUND(SUM(amount)::numeric, 2) as \"Total\"
FROM ledger_entries 
WHERE receiver_user_id = $SOMYA_ID 
GROUP BY commission_type 
ORDER BY commission_type;
"

echo ""
echo -e "${YELLOW}🔍 DETAILED PROGRESSIVE ANALYSIS:${NC}"
echo ""

echo -e "${CYAN}Expected Calculation (Progressive):${NC}"
echo ""
echo "1. SELF Commission:"
echo "   • Monthly: ₹525 = 52500 paise"
echo "   • Daily (30 days): 1750 paise/day"
echo "   • 91 days: 1750 × 91 = 159250 paise = ₹1,592.50"
echo ""
echo "2. GLOBAL_HELPING (Progressive):"
echo "   • November (30 days): 124 IDs × 20 paise × 30 = 74,400 paise = ₹744.00"
echo "   • December (31 days): 214 IDs × 20 paise × 31 = 132,680 paise = ₹1,326.80"
echo "   • January (30 days): 324 IDs × 20 paise × 30 = 194,400 paise = ₹1,944.00"
echo "   • Total: ₹744 + ₹1,326.80 + ₹1,944 = ₹4,014.80"
echo ""
echo "3. SPOT Commission:"
echo "   • 37 referrals × ₹750 = ₹27,750.00"
echo ""
echo "4. MONTHLY Recurring:"
echo "   • 10 refs (Nov 1) × 91 days × 250 paise = 227,500 paise = ₹2,275.00"
echo "   • 15 refs (Dec 1) × 61 days × 250 paise = 228,750 paise = ₹2,287.50"
echo "   • 12 refs (Jan 1) × 30 days × 250 paise = 90,000 paise = ₹900.00"
echo "   • Total: ₹2,275 + ₹2,287.50 + ₹900 = ₹5,462.50"
echo ""
echo -e "${MAGENTA}💵 EXPECTED TOTAL: ₹38,819.80${NC}"
echo ""

echo -e "${GREEN}🎉 TEST COMPLETE - PROGRESSIVE SCENARIO!${NC}"
echo ""

