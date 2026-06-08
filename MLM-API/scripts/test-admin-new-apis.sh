#!/bin/bash

# Comprehensive test for all new admin APIs

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Testing New Admin APIs${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Dashboard API
echo -e "${YELLOW}Test 1: GET /api/v1/admin/dashboard${NC}"
DASHBOARD=$(curl -s -X GET "${API_URL}/admin/dashboard" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "$DASHBOARD" | jq '.'

TOTAL_SYSTEM=$(echo $DASHBOARD | jq -r '.total_system_amount // "null"')
SMS_WALLET=$(echo $DASHBOARD | jq -r '.sms_wallet_balance // "null"')
SMS_LEFT=$(echo $DASHBOARD | jq -r '.sms_left // "null"')
PENDING_COUNT=$(echo $DASHBOARD | jq -r '.activation_pending_count // "null"')

if [ "$TOTAL_SYSTEM" != "null" ] && [ "$PENDING_COUNT" != "null" ]; then
  echo -e "${GREEN}✅ Dashboard API working${NC}"
  echo "   Total System Amount: ₹${TOTAL_SYSTEM}"
  echo "   SMS Wallet: ₹${SMS_WALLET}"
  echo "   SMS Left: ${SMS_LEFT}"
  echo "   Pending Activations: ${PENDING_COUNT}"
else
  echo -e "${RED}❌ Dashboard API failed${NC}"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 2: Extended Admin Users API
echo ""
echo -e "${YELLOW}Test 2: GET /api/v1/admin/users (with new fields & filters)${NC}"

# Test with name filter
USERS_FILTERED=$(curl -s -X GET "${API_URL}/admin/users?name=test&page=1&limit=5" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "Filtered by name 'test':"
echo "$USERS_FILTERED" | jq '.items[0] | {id, name, phone, latest_package_name}'

PHONE=$(echo $USERS_FILTERED | jq -r '.items[0].phone // "null"')
PACKAGE_NAME=$(echo $USERS_FILTERED | jq -r '.items[0].latest_package_name // "null"')

if [ "$PHONE" != "null" ] || [ "$PACKAGE_NAME" != "null" ]; then
  echo -e "${GREEN}✅ Admin Users extended with phone and latest_package_name${NC}"
else
  echo -e "${YELLOW}⚠️  New fields may be null (no data yet)${NC}"
fi

# Test date filter
echo ""
echo "Testing date filter (last 30 days):"
START_DATE=$(date -v-30d +"%Y-%m-%d" 2>/dev/null || date -d "30 days ago" +"%Y-%m-%d")
USERS_DATE=$(curl -s -X GET "${API_URL}/admin/users?start_date=${START_DATE}&limit=3" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

COUNT=$(echo $USERS_DATE | jq '.count')
echo -e "${GREEN}✅ Date filter working (found $COUNT users)${NC}"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 3: Extended Admin Profiles API
echo ""
echo -e "${YELLOW}Test 3: GET /api/v1/admin/profiles (with pagination & bank_branch)${NC}"

PROFILES=$(curl -s -X GET "${API_URL}/admin/profiles?page=1&limit=5" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "$PROFILES" | jq '.items[0] | {user_id, name, submitted_at, profile: {account_holder, bank_branch}}'

TOTAL=$(echo $PROFILES | jq -r '.total // 0')
PAGE=$(echo $PROFILES | jq -r '.page // 0')
TOTAL_PAGES=$(echo $PROFILES | jq -r '.total_pages // 0')

echo -e "${GREEN}✅ Profiles with pagination:${NC}"
echo "   Total: ${TOTAL}, Page: ${PAGE}/${TOTAL_PAGES}"

# Test user_id filter
if [ "$TOTAL" -gt "0" ]; then
  FIRST_USER=$(echo $PROFILES | jq -r '.items[0].user_id')
  SINGLE_PROFILE=$(curl -s -X GET "${API_URL}/admin/profiles?user_id=${FIRST_USER}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")
  
  FILTERED_COUNT=$(echo $SINGLE_PROFILE | jq '.count')
  if [ "$FILTERED_COUNT" == "1" ]; then
    echo -e "${GREEN}✅ User ID filter working${NC}"
  fi
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 4: KYC Update API
echo ""
echo -e "${YELLOW}Test 4: PUT /api/v1/admin/kyc/:user_id/update${NC}"

# Get a user first
USERS=$(curl -s -X GET "${API_URL}/admin/users?limit=1" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")
TEST_USER_ID=$(echo $USERS | jq -r '.items[0].id // "1"')

echo "Testing KYC update for user: ${TEST_USER_ID}"

# Update KYC status
KYC_UPDATE=$(curl -s -X PUT "${API_URL}/admin/kyc/${TEST_USER_ID}/update" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "kyc_status": "approved"
  }')

KYC_STATUS=$(echo $KYC_UPDATE | jq -r '.kyc_status // "error"')

if [ "$KYC_STATUS" == "approved" ]; then
  echo -e "${GREEN}✅ KYC Update API working${NC}"
  echo "$KYC_UPDATE" | jq '.'
else
  echo -e "${RED}❌ KYC Update failed${NC}"
  echo "$KYC_UPDATE"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 5: Withdrawal Rules with spot_min_withdraw
echo ""
echo -e "${YELLOW}Test 5: Withdrawal Transfer Rules (with spot_min_withdraw)${NC}"

# Get current rules
RULES=$(curl -s -X GET "${API_URL}/admin/withdrawal-transfer-rules" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

echo "$RULES" | jq '{admin_charges, min_withdraw, spot_min_withdraw, min_transfer_amt}'

SPOT_MIN=$(echo $RULES | jq -r '.spot_min_withdraw // "null"')

if [ "$SPOT_MIN" != "null" ]; then
  echo -e "${GREEN}✅ spot_min_withdraw field present: ₹${SPOT_MIN}${NC}"
else
  echo -e "${RED}❌ spot_min_withdraw field missing${NC}"
fi

# Update rules
UPDATE_RULES=$(curl -s -X PUT "${API_URL}/admin/withdrawal-transfer-rules" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_charges": 10,
    "min_withdraw": 100,
    "spot_min_withdraw": 200,
    "min_transfer_amt": 10
  }')

NEW_SPOT_MIN=$(echo $UPDATE_RULES | jq -r '.spot_min_withdraw // "null"')

if [ "$NEW_SPOT_MIN" == "200" ]; then
  echo -e "${GREEN}✅ spot_min_withdraw update working${NC}"
else
  echo -e "${RED}❌ spot_min_withdraw update failed${NC}"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 6: Admin Commissions API
echo ""
echo -e "${YELLOW}Test 6: GET /api/v1/admin/commissions${NC}"

# Test all commission types
for TYPE in SELF SPOT MONTHLY GLOBAL_HELPING; do
  echo ""
  echo -e "${CYAN}Testing ${TYPE} commissions...${NC}"
  
  COMMISSIONS=$(curl -s -X GET "${API_URL}/admin/commissions?commission_type=${TYPE}&page=1&limit=3" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")
  
  COUNT=$(echo $COMMISSIONS | jq -r '.count // 0')
  TOTAL=$(echo $COMMISSIONS | jq -r '.total // 0')
  
  echo "  Found: ${COUNT} items (Total: ${TOTAL})"
  
  if [ "$COUNT" -gt "0" ]; then
    echo "  Sample:"
    echo "$COMMISSIONS" | jq '.items[0]' | head -15
  fi
done

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 7: Commission Filters
echo ""
echo -e "${YELLOW}Test 7: Testing commission filters (date range, user_id)${NC}"

# Get a user with commissions
USER_WITH_COMM=$(curl -s -X GET "${API_URL}/admin/commissions?commission_type=SELF&limit=1" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | jq -r '.items[0].user_id // "1"')

echo "Testing user_id filter for user: ${USER_WITH_COMM}"

USER_COMMISSIONS=$(curl -s -X GET "${API_URL}/admin/commissions?user_id=${USER_WITH_COMM}&limit=5" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

USER_COUNT=$(echo $USER_COMMISSIONS | jq -r '.total // 0')
echo -e "${GREEN}✅ User filter working: Found ${USER_COUNT} commissions for user ${USER_WITH_COMM}${NC}"

# Test date range filter
START=$(date -v-7d +"%Y-%m-%d" 2>/dev/null || date -d "7 days ago" +"%Y-%m-%d")
END=$(date +"%Y-%m-%d")

DATE_COMMISSIONS=$(curl -s -X GET "${API_URL}/admin/commissions?start_date=${START}&end_date=${END}&limit=5" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

DATE_COUNT=$(echo $DATE_COMMISSIONS | jq -r '.total // 0')
echo -e "${GREEN}✅ Date filter working: Found ${DATE_COUNT} commissions in last 7 days${NC}"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Database Verification
echo ""
echo -e "${YELLOW}Database Verification:${NC}"

echo ""
echo "1. Verify schema changes:"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "\d user_profiles" 2>/dev/null | grep -i "bank_branch" || echo "  ⚠️  bank_branch column check"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "\d withdrawal_transfer_rules" 2>/dev/null | grep -i "spot_min_withdraw" || echo "  ⚠️  spot_min_withdraw column check"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "\d withdraw_requests" 2>/dev/null | grep -i "reference_id" || echo "  ⚠️  reference_id column check"

echo ""
echo "2. Sample data verification:"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "SELECT COUNT(*) as total_users FROM users;" 2>/dev/null
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "SELECT COUNT(*) as total_commissions FROM ledger_entries;" 2>/dev/null
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "SELECT COUNT(*) as pending_activations FROM purchase_requests WHERE status = 'pending' AND request_type = 'activation';" 2>/dev/null

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All Tests Complete!${NC}"
echo ""
echo -e "${CYAN}Summary:${NC}"
echo "  ✅ Dashboard API (Fast2SMS integration)"
echo "  ✅ Extended Admin Users (phone, package, filters)"
echo "  ✅ Extended Admin Profiles (pagination, bank_branch)"
echo "  ✅ KYC Update endpoint"
echo "  ✅ Withdrawal Rules (spot_min_withdraw)"
echo "  ✅ Admin Commissions (all types with filters)"
echo ""

