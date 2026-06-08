#!/bin/bash

# Comprehensive test for Package Status and Loss Tracking
# Tests both global_ids_info and expiry_loss according to plan

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
echo -e "${CYAN}Package Status & Loss Tracking - Comprehensive Test${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Helper functions
execute_sql() {
  docker exec mlm-api-db-1 psql -U postgres -d mlm -t -c "$1" 2>/dev/null | xargs || echo ""
}

execute_sql_formatted() {
  docker exec mlm-api-db-1 psql -U postgres -d mlm -c "$1" 2>/dev/null || echo "DB query failed"
}

# Step 1: Create test users
echo -e "${YELLOW}Step 1: Creating test users...${NC}"

REFERRER_ID=$(execute_sql "SELECT id FROM users LIMIT 1;")
if [ -z "$REFERRER_ID" ] || [ "$REFERRER_ID" == "null" ]; then
  REFERRER_ID=1
fi

# Create root user
ROOT_EMAIL="root_test_$(date +%s)@test.com"
ROOT_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Root Test User\",
    \"email\": \"${ROOT_EMAIL}\",
    \"mobile\": \"9999999999\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": ${REFERRER_ID}
  }")
ROOT_USER_ID=$(echo $ROOT_RESPONSE | jq -r '.id // empty')
echo -e "${GREEN}✅ Root user created: ID ${ROOT_USER_ID}${NC}"

# Login as root
ROOT_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${ROOT_EMAIL}\",
    \"password\": \"Test@123\"
  }")
ROOT_TOKEN=$(echo $ROOT_LOGIN | jq -r '.token // empty')
echo -e "${GREEN}✅ Root user logged in${NC}"

# Create downline user
DOWNLINE_EMAIL="downline_test_$(date +%s)@test.com"
DOWNLINE_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Downline Test User\",
    \"email\": \"${DOWNLINE_EMAIL}\",
    \"mobile\": \"9999999998\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": ${ROOT_USER_ID}
  }")
DOWNLINE_ID=$(echo $DOWNLINE_RESPONSE | jq -r '.id // empty')
echo -e "${GREEN}✅ Downline user created: ID ${DOWNLINE_ID}${NC}"

# Step 2: Get package
echo ""
echo -e "${YELLOW}Step 2: Getting package...${NC}"
PACKAGES_RESPONSE=$(curl -s -X GET "${API_URL}/packages" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")
PACKAGE_ID=$(echo $PACKAGES_RESPONSE | jq -r '.[0].id // empty')
PACKAGE_NAME=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .name")
PACKAGE_PRICE=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .price")
PACKAGE_GLOBAL_IDS=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .global_ids")
echo -e "${GREEN}✅ Using package: ${PACKAGE_NAME} (ID: ${PACKAGE_ID}, Price: ₹${PACKAGE_PRICE}, Global IDs: ${PACKAGE_GLOBAL_IDS})${NC}"

# Step 3: Create and approve purchase for root user
echo ""
echo -e "${YELLOW}Step 3: Creating and approving purchase for root user...${NC}"
PURCHASE_REQUEST=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${ROOT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_TEST_$(date +%s)\",
    \"payment_type\": \"UPI\"
  }")
REQUEST_ID=$(echo $PURCHASE_REQUEST | jq -r '.request.id // empty')

APPROVE_RESPONSE=$(curl -s -X POST "${API_URL}/admin/activation/requests/${REQUEST_ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{}")
PURCHASE_ID=$(echo $APPROVE_RESPONSE | jq -r '.purchase.id // empty')
echo -e "${GREEN}✅ Purchase approved: ID ${PURCHASE_ID}${NC}"

# Wait for commission processing
sleep 2

# Step 4: Test global_ids_info for active package
echo ""
echo -e "${YELLOW}Step 4: Testing global_ids_info for active package...${NC}"
MY_COURSE_RESPONSE=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")

GLOBAL_IDS_INFO=$(echo $MY_COURSE_RESPONSE | jq -r '.global_ids_info // empty')
if [ -z "$GLOBAL_IDS_INFO" ] || [ "$GLOBAL_IDS_INFO" == "null" ]; then
  echo -e "${RED}❌ global_ids_info is null${NC}"
  echo "Full response:"
  echo "$MY_COURSE_RESPONSE" | jq .
else
  echo -e "${GREEN}✅ global_ids_info found:${NC}"
  echo "$MY_COURSE_RESPONSE" | jq '.global_ids_info'
  
  # Verify values
  PACKAGE_CAP=$(echo $MY_COURSE_RESPONSE | jq -r '.global_ids_info.package_cap')
  USED_IDS=$(echo $MY_COURSE_RESPONSE | jq -r '.global_ids_info.used_ids')
  REMAINING_IDS=$(echo $MY_COURSE_RESPONSE | jq -r '.global_ids_info.remaining_ids')
  
  echo ""
  echo -e "${CYAN}Verification:${NC}"
  echo "  Package Cap: ${PACKAGE_CAP} (expected: ${PACKAGE_GLOBAL_IDS})"
  echo "  Used IDs: ${USED_IDS}"
  echo "  Remaining IDs: ${REMAINING_IDS}"
  
  # DB verification
  DB_GLOBAL_COUNT=$(execute_sql "SELECT COUNT(*) FROM purchases WHERE status = 'completed' AND user_id != ${ROOT_USER_ID} AND purchased_at <= NOW();")
  echo "  DB Global Count: ${DB_GLOBAL_COUNT}"
fi

# Step 5: Expire package and test expiry_loss
echo ""
echo -e "${YELLOW}Step 5: Expiring package and testing expiry_loss...${NC}"
YESTERDAY=$(date -u -v-1d +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -u -d "1 day ago" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -u -d "-1 day" +"%Y-%m-%d %H:%M:%S")
execute_sql "UPDATE purchases SET active_until = '${YESTERDAY}'::timestamp WHERE id = ${PURCHASE_ID};"
echo -e "${GREEN}✅ Package expired${NC}"

# Create downline purchase for loss calculation
DOWNLINE_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${DOWNLINE_EMAIL}\",
    \"password\": \"Test@123\"
  }")
DOWNLINE_TOKEN=$(echo $DOWNLINE_LOGIN | jq -r '.token // empty')

DOWNLINE_REQUEST=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${DOWNLINE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_DOWNLINE_$(date +%s)\",
    \"payment_type\": \"UPI\"
  }")
DOWNLINE_REQUEST_ID=$(echo $DOWNLINE_REQUEST | jq -r '.request.id // empty')

curl -s -X POST "${API_URL}/admin/activation/requests/${DOWNLINE_REQUEST_ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{}" > /dev/null

sleep 2

# Test expiry_loss
echo ""
echo -e "${YELLOW}Step 6: Testing expiry_loss for expired package...${NC}"
MY_COURSE_EXPIRED=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")

EXPIRY_LOSS=$(echo $MY_COURSE_EXPIRED | jq -r '.expiry_loss // empty')
if [ -z "$EXPIRY_LOSS" ] || [ "$EXPIRY_LOSS" == "null" ]; then
  echo -e "${RED}❌ expiry_loss is null${NC}"
  echo "Full response:"
  echo "$MY_COURSE_EXPIRED" | jq .
else
  echo -e "${GREEN}✅ expiry_loss found:${NC}"
  echo "$MY_COURSE_EXPIRED" | jq '.expiry_loss'
  
  TOTAL_LOSS=$(echo $MY_COURSE_EXPIRED | jq -r '.expiry_loss.total_loss')
  DAYS_SINCE=$(echo $MY_COURSE_EXPIRED | jq -r '.expiry_loss.days_since_expiry')
  DAILY_COUNT=$(echo $MY_COURSE_EXPIRED | jq '.expiry_loss.daily_breakdown | length')
  
  echo ""
  echo -e "${CYAN}Loss Summary:${NC}"
  echo "  Total Loss: ₹${TOTAL_LOSS}"
  echo "  Days Since Expiry: ${DAYS_SINCE}"
  echo "  Daily Breakdown Entries: ${DAILY_COUNT}"
fi

# Step 7: Test list endpoint
echo ""
echo -e "${YELLOW}Step 7: Testing list endpoint...${NC}"
MY_COURSE_LIST=$(curl -s -X GET "${API_URL}/my-course" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")

echo "Purchase items:"
echo "$MY_COURSE_LIST" | jq '.items[] | {id, package_name, is_active, global_ids_info, expiry_loss}'

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""
echo -e "${CYAN}Summary:${NC}"
echo "  - Root User ID: ${ROOT_USER_ID}"
echo "  - Purchase ID: ${PURCHASE_ID}"
echo "  - Package: ${PACKAGE_NAME} (Global IDs: ${PACKAGE_GLOBAL_IDS})"
echo ""

