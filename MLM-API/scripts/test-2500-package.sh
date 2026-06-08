#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      ₹2,500 PACKAGE TEST (55 IDs, 13 Months)               ║"
echo "╚════════════════════════════════════════════════════════════╝"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

API_BASE="http://localhost:3000/api/v1"

extract_value() {
  echo "$1" | grep -o "\"$2\":[^,}]*" | head -1 | sed 's/.*://;s/"//g;s/\r//g' | tr -d '\n\r'
}

PKG_ID=1

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 TEST SCENARIO:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "📦 Package: Standard MLM (55 IDs) - ₹2,500"
echo "   • SELF: ₹62.50/month"
echo "   • GLOBAL: ₹6.25/ID/month (cap: 55)"
echo "   • SPOT: 5% = ₹125 per referral"
echo "   • MONTHLY: 0.5% = ₹12.50/month per referral"
echo "   • Validity: 13 months"
echo ""

echo -e "${YELLOW}👤 Step 1: Registering Main User...${NC}"
MAIN_REG=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "main@mlm.com",
    "password": "test123",
    "name": "Main User"
  }')

MAIN_ID=$(extract_value "$MAIN_REG" "id")
echo -e "${GREEN}✅ Main User registered: ID=$MAIN_ID${NC}"

MAIN_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "main@mlm.com", "password": "test123"}')

MAIN_TOKEN=$(extract_value "$MAIN_LOGIN" "token")

echo ""
echo -e "${YELLOW}💰 Step 2: Main User purchases package...${NC}"
PURCHASE_RESP=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Authorization: Bearer $MAIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"package_id\": $PKG_ID}")

PURCHASE_ID=$(extract_value "$PURCHASE_RESP" "id")
echo -e "${GREEN}✅ Purchase created: ID=$PURCHASE_ID${NC}"

echo ""
echo -e "${YELLOW}⏳ Waiting 10s for PgBoss to process purchase...${NC}"
sleep 10

echo ""
echo -e "${YELLOW}👥 Step 3: Registering 3 direct referrals...${NC}"
DIRECT_NAMES=("Referral1" "Referral2" "Referral3")
for name in "${DIRECT_NAMES[@]}"; do
  email="$(echo $name | tr '[:upper:]' '[:lower:]')@mlm.com"
  
  REG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\", \"name\": \"$name\", \"referrer_user_id\": $MAIN_ID}")
  
  USER_ID=$(extract_value "$REG_RESP" "id")
  
  LOGIN_RESP=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  TOKEN=$(extract_value "$LOGIN_RESP" "token")
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $PKG_ID}" > /dev/null
  
  echo -e "${GREEN}✅ $name (ID=$USER_ID) registered and purchased${NC}"
done

echo ""
echo -e "${YELLOW}🌍 Step 4: Registering 10 global users...${NC}"
for i in $(seq 1 10); do
  name="Global${i}"
  email="global${i}@mlm.com"
  
  REG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\", \"name\": \"$name\"}")
  
  USER_ID=$(extract_value "$REG_RESP" "id")
  
  LOGIN_RESP=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"test123\"}")
  
  TOKEN=$(extract_value "$LOGIN_RESP" "token")
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"package_id\": $PKG_ID}" > /dev/null
done
echo -e "${GREEN}✅ 10 global users registered${NC}"

echo ""
echo -e "${YELLOW}⏳ Waiting 20s for all PgBoss jobs to complete...${NC}"
sleep 20

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📊 CHECKING RESULTS${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Check schedules
echo -e "${YELLOW}📅 Scheduled Commissions:${NC}"
docker exec mlm-db-1 psql -U postgres -d mlm -c "SELECT commission_type, COUNT(*) as count, ROUND(AVG(monthly_amount::numeric), 2) as avg_monthly, MIN(start_date) as first_start, MAX(end_date) as last_end FROM scheduled_commissions WHERE receiver_user_id = $MAIN_ID GROUP BY commission_type ORDER BY commission_type;"

echo ""
echo -e "${YELLOW}💰 Wallet Balance:${NC}"
WALLET=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT balance FROM user_balances WHERE user_id = $MAIN_ID;")
echo -e "${GREEN}Balance: ₹${WALLET}${NC}"

echo ""
echo -e "${YELLOW}📈 Ledger Entries:${NC}"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT 
  commission_type,
  COUNT(*) as entries,
  ROUND(SUM(amount)::numeric, 2) as total
FROM ledger_entries 
WHERE receiver_user_id = $MAIN_ID 
GROUP BY commission_type 
ORDER BY commission_type;
"

echo ""
echo -e "${YELLOW}👥 Referrals:${NC}"
REF_COUNT=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT COUNT(*) FROM users WHERE referrer_user_id = $MAIN_ID;")
echo -e "${GREEN}Total referrals: ${REF_COUNT}${NC}"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}🧮 EXPECTED CALCULATIONS:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "1. SPOT Commission:"
echo "   • 3 referrals × ₹125 = ₹375.00"
echo ""
echo "2. SELF Commission:"
echo "   • Scheduled for 13 months"
echo "   • Monthly: ₹62.50"
echo "   • Will be credited daily (not yet processed)"
echo ""
echo "3. GLOBAL_HELPING Commission:"
echo "   • Scheduled for 13 months"
echo "   • 10 global users (below 55 cap)"
echo "   • Per-ID: ₹6.25/month"
echo "   • Total: 10 × ₹6.25 = ₹62.50/month"
echo "   • Will be credited daily (not yet processed)"
echo ""
echo "4. MONTHLY Recurring:"
echo "   • 3 referrals × ₹12.50/month"
echo "   • Scheduled for 13 months"
echo "   • Will be credited daily (not yet processed)"
echo ""
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""

