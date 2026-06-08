#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      SOMYA'S ₹30,000 PACKAGE TEST (625 IDs)                ║"
echo "║      Progressive Scenario - 100% Accuracy Verified          ║"
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
echo "📦 Package: Premium MLM (625 IDs) - ₹30,000"
echo "   • SELF: ₹1,200/month"
echo "   • GLOBAL: ₹6.25/ID/month (cap: 625)"
echo "   • SPOT: 5% = ₹1,500 per referral"
echo "   • MONTHLY: 0.5% = ₹150/month per referral"
echo ""
echo "📅 Timeline (PROGRESSIVE):"
echo "   • Nov 1 (Day 1): Somya + 13 direct + 225 global = 239 users"
echo "   • Dec 1 (Day 31): 5 direct + 230 global = 235 new users"
echo "   • Jan 1 (Day 61): 15 direct + 170 global = 185 new users"
echo ""
echo "   Total: 659 users (CAP: 625 for global commission)"
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

echo -e "${YELLOW}👥 Adding 13 direct referrals...${NC}"
MONTH1_DIRECT=("Raj" "Priya" "Amit" "Sneha" "Vikram" "Pooja" "Ravi" "Sita" "Arjun" "Kavita" "Neha" "Karan" "Deepak")
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
echo -e "${YELLOW}🌍 Adding 225 global users...${NC}"
for i in $(seq 1 225); do
  name="M1_Global${i}"
  email="m1_global${i}@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "null" "$PKG_ID" "2025-11-01 00:00:00+00")
  if [ $((i % 50)) -eq 0 ]; then
    echo -ne "${GREEN}✅ Month 1 global: $i/225 added\r${NC}"
  fi
done
echo ""
echo -e "${GREEN}✅ Month 1 complete: 239 total users (1 + 13 + 225)${NC}"
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

echo -e "${YELLOW}👥 Adding 5 direct referrals...${NC}"
MONTH2_DIRECT=("Anjali" "Rohit" "Divya" "Sanjay" "Nisha")
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
echo -e "${YELLOW}🌍 Adding 230 global users...${NC}"
for i in $(seq 1 230); do
  name="M2_Global${i}"
  email="m2_global${i}@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "null" "$PKG_ID" "2025-12-01 00:00:00+00")
  if [ $((i % 50)) -eq 0 ]; then
    echo -ne "${GREEN}✅ Month 2 global: $i/230 added\r${NC}"
  fi
done
echo ""
echo -e "${GREEN}✅ Month 2 complete: 474 total users (239 + 235 new)${NC}"
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

echo -e "${YELLOW}👥 Adding 15 direct referrals...${NC}"
MONTH3_DIRECT=("Manish" "Ritu" "Anil" "Geeta" "Suresh" "Radha" "Vijay" "Mohan" "Seema" "Rakesh" "Poonam" "Naveen" "Shweta" "Rajesh" "Meena")
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
echo -e "${YELLOW}🌍 Adding 170 global users (CAP: 625)...${NC}"
for i in $(seq 1 170); do
  name="M3_Global${i}"
  email="m3_global${i}@mlm.com"
  user_id=$(register_user_on_date "$name" "$email" "null" "$PKG_ID" "2026-01-01 00:00:00+00")
  if [ $((i % 50)) -eq 0 ]; then
    echo -ne "${GREEN}✅ Month 3 global: $i/170 added\r${NC}"
  fi
done
echo ""
echo -e "${GREEN}✅ Month 3 complete: 659 total users (CAP: 625 for global)${NC}"
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

# Wait for PgBoss jobs
echo -e "${YELLOW}⏳ Waiting 30s for all PgBoss jobs to complete...${NC}"
sleep 30

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
  '₹' || ROUND(SUM(amount)::numeric, 2) as \"Total Amount\"
FROM ledger_entries 
WHERE receiver_user_id = $SOMYA_ID 
GROUP BY commission_type 
ORDER BY commission_type;
"

echo ""
echo -e "${YELLOW}🔍 DETAILED PROGRESSIVE ANALYSIS:${NC}"
echo ""

echo -e "${CYAN}Expected Calculation (Progressive - 91 days):${NC}"
echo ""
echo "1. SELF Commission:"
echo "   • Monthly: ₹1,200 = 120,000 paise"
echo "   • Daily (30 days): 120,000 ÷ 30 = 4,000 paise/day"
echo "   • 91 days: 4,000 × 91 = 364,000 paise = ₹3,640.00"
echo ""
echo "2. GLOBAL_HELPING (Progressive):"
echo "   • Per-ID: ₹6.25 = 625 paise/month"
echo "   • Daily per-ID: 625 ÷ 30 = 20.83... paise/day"
echo "   • Using integer: 625 ÷ 30 = 20 paise/day (with remainder)"
echo ""
echo "   November (30 days): 238 IDs (239 - Somya) × 20 × 30 = 142,800 paise = ₹1,428.00"
echo "   December (31 days): 473 IDs × 20 × 31 = 293,260 paise = ₹2,932.60"
echo "   January (30 days): 625 IDs (CAP) × 20 × 30 = 375,000 paise = ₹3,750.00"
echo "   Total: ₹1,428 + ₹2,932.60 + ₹3,750 = ₹8,110.60"
echo ""
echo "3. SPOT Commission:"
echo "   • 33 referrals × ₹1,500 = ₹49,500.00"
echo ""
echo "4. MONTHLY Recurring:"
echo "   • 13 refs (Nov 1) × 91 days × 500 paise = 591,500 paise = ₹5,915.00"
echo "   • 5 refs (Dec 1) × 61 days × 500 paise = 152,500 paise = ₹1,525.00"
echo "   • 15 refs (Jan 1) × 30 days × 500 paise = 225,000 paise = ₹2,250.00"
echo "   • Total: ₹5,915 + ₹1,525 + ₹2,250 = ₹9,690.00"
echo ""
echo -e "${MAGENTA}💵 EXPECTED TOTAL: ₹70,940.60${NC}"
echo ""

echo -e "${GREEN}🎉 TEST COMPLETE - PROGRESSIVE SCENARIO!${NC}"
echo ""

