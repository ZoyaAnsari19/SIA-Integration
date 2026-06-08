#!/bin/bash

# Test script for Package Status and Loss Tracking
# Tests global IDs tracking and expired package loss calculation

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Package Status and Loss Tracking Test${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Helper functions
execute_sql() {
  docker exec mlm-db-1 psql -U postgres -d mlm -t -c "$1" | xargs
}

execute_sql_formatted() {
  docker exec mlm-db-1 psql -U postgres -d mlm -c "$1"
}

# Step 1: Create test users
echo -e "${YELLOW}Step 1: Creating test users...${NC}"

# Create root user (will be expired package user)
ROOT_EMAIL="root_package_test_$(date +%s)@test.com"
ROOT_PASSWORD="Test@123"
ROOT_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Root User\",
    \"email\": \"${ROOT_EMAIL}\",
    \"mobile\": \"9999999999\",
    \"password\": \"${ROOT_PASSWORD}\",
    \"referrer_user_id\": null
  }")

ROOT_USER_ID=$(echo $ROOT_RESPONSE | jq -r '.id // empty')
if [ -z "$ROOT_USER_ID" ] || [ "$ROOT_USER_ID" == "null" ]; then
  echo -e "${RED}Failed to create root user${NC}"
  echo "$ROOT_RESPONSE" | jq .
  exit 1
fi
echo -e "${GREEN}✅ Root user created: ID ${ROOT_USER_ID}${NC}"

# Login as root user
ROOT_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${ROOT_EMAIL}\",
    \"password\": \"${ROOT_PASSWORD}\"
  }")
ROOT_TOKEN=$(echo $ROOT_LOGIN | jq -r '.token // empty')
if [ -z "$ROOT_TOKEN" ] || [ "$ROOT_TOKEN" == "null" ]; then
  echo -e "${RED}Failed to login as root user${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Root user logged in${NC}"

# Create downline users (for loss calculation)
DOWNLINE1_EMAIL="downline1_test_$(date +%s)@test.com"
DOWNLINE1_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Downline 1\",
    \"email\": \"${DOWNLINE1_EMAIL}\",
    \"mobile\": \"9999999998\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": ${ROOT_USER_ID}
  }")
DOWNLINE1_ID=$(echo $DOWNLINE1_RESPONSE | jq -r '.id // empty')
echo -e "${GREEN}✅ Downline 1 created: ID ${DOWNLINE1_ID}${NC}"

DOWNLINE2_EMAIL="downline2_test_$(date +%s)@test.com"
DOWNLINE2_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Downline 2\",
    \"email\": \"${DOWNLINE2_EMAIL}\",
    \"mobile\": \"9999999997\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": ${ROOT_USER_ID}
  }")
DOWNLINE2_ID=$(echo $DOWNLINE2_RESPONSE | jq -r '.id // empty')
echo -e "${GREEN}✅ Downline 2 created: ID ${DOWNLINE2_ID}${NC}"

# Step 2: Get package list
echo ""
echo -e "${YELLOW}Step 2: Getting package list...${NC}"
PACKAGES_RESPONSE=$(curl -s -X GET "${API_URL}/packages" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")
PACKAGE_ID=$(echo $PACKAGES_RESPONSE | jq -r '.[0].id // empty')
if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" == "null" ]; then
  echo -e "${RED}No packages found${NC}"
  exit 1
fi
PACKAGE_NAME=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .name")
PACKAGE_PRICE=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .price")
PACKAGE_GLOBAL_IDS=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .global_ids")
echo -e "${GREEN}✅ Using package: ${PACKAGE_NAME} (ID: ${PACKAGE_ID}, Price: ₹${PACKAGE_PRICE}, Global IDs: ${PACKAGE_GLOBAL_IDS})${NC}"

# Step 3: Create purchase request for root user (will expire it later)
echo ""
echo -e "${YELLOW}Step 3: Creating purchase request for root user...${NC}"
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
if [ -z "$REQUEST_ID" ] || [ "$REQUEST_ID" == "null" ]; then
  echo -e "${RED}Failed to create purchase request${NC}"
  echo "$PURCHASE_REQUEST" | jq .
  exit 1
fi
echo -e "${GREEN}✅ Purchase request created: ID ${REQUEST_ID}${NC}"

# Step 4: Approve purchase request (admin)
echo ""
echo -e "${YELLOW}Step 4: Approving purchase request...${NC}"
ADMIN_TOKEN="${ADMIN_TOKEN:-your_admin_token_here}"
if [ "$ADMIN_TOKEN" == "your_admin_token_here" ]; then
  echo -e "${YELLOW}⚠️  Skipping admin approval (set ADMIN_TOKEN env var)${NC}"
  echo -e "${YELLOW}   Manually approve request ID ${REQUEST_ID} or set ADMIN_TOKEN${NC}"
  read -p "Press Enter after approving the request..."
else
  APPROVE_RESPONSE=$(curl -s -X POST "${API_URL}/admin/activation/requests/${REQUEST_ID}/approve" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json")
  PURCHASE_ID=$(echo $APPROVE_RESPONSE | jq -r '.purchase.id // empty')
  if [ -z "$PURCHASE_ID" ] || [ "$PURCHASE_ID" == "null" ]; then
    echo -e "${RED}Failed to approve request${NC}"
    echo "$APPROVE_RESPONSE" | jq .
    exit 1
  fi
  echo -e "${GREEN}✅ Purchase approved: ID ${PURCHASE_ID}${NC}"
fi

# Get purchase ID from DB if not from approval
if [ -z "$PURCHASE_ID" ]; then
  PURCHASE_ID=$(execute_sql "SELECT id FROM purchases WHERE user_id = ${ROOT_USER_ID} ORDER BY id DESC LIMIT 1;")
  echo -e "${GREEN}✅ Found purchase ID from DB: ${PURCHASE_ID}${NC}"
fi

# Step 5: Check global IDs info for active package
echo ""
echo -e "${YELLOW}Step 5: Checking global IDs info for active package...${NC}"
MY_COURSE_RESPONSE=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")
echo "$MY_COURSE_RESPONSE" | jq .

GLOBAL_IDS_INFO=$(echo $MY_COURSE_RESPONSE | jq -r '.global_ids_info // empty')
if [ -z "$GLOBAL_IDS_INFO" ] || [ "$GLOBAL_IDS_INFO" == "null" ]; then
  echo -e "${RED}❌ global_ids_info not found in response${NC}"
else
  echo -e "${GREEN}✅ global_ids_info found:${NC}"
  echo "$MY_COURSE_RESPONSE" | jq '.global_ids_info'
  
  # Verify in DB
  echo ""
  echo -e "${CYAN}Verifying in database:${NC}"
  execute_sql_formatted "
  SELECT 
    p.id as purchase_id,
    p.user_id,
    p.package_id,
    p.effective_global_ids,
    pk.global_ids as package_global_ids,
    p.active_until,
    (SELECT COUNT(*) FROM purchases WHERE status = 'completed' AND user_id != ${ROOT_USER_ID} AND purchased_at <= NOW()) as total_global_users
  FROM purchases p
  JOIN packages pk ON p.package_id = pk.id
  WHERE p.id = ${PURCHASE_ID};
  "
fi

# Step 6: Create purchases for downline users (for loss calculation)
echo ""
echo -e "${YELLOW}Step 6: Creating purchases for downline users...${NC}"

# Login as downline 1
DOWNLINE1_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${DOWNLINE1_EMAIL}\",
    \"password\": \"Test@123\"
  }")
DOWNLINE1_TOKEN=$(echo $DOWNLINE1_LOGIN | jq -r '.token // empty')

# Create purchase request for downline 1
DOWNLINE1_REQUEST=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${DOWNLINE1_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_DOWNLINE1_$(date +%s)\",
    \"payment_type\": \"UPI\"
  }")
DOWNLINE1_REQUEST_ID=$(echo $DOWNLINE1_REQUEST | jq -r '.request.id // empty')
echo -e "${GREEN}✅ Downline 1 purchase request: ID ${DOWNLINE1_REQUEST_ID}${NC}"

# Approve if admin token available
if [ "$ADMIN_TOKEN" != "your_admin_token_here" ]; then
  curl -s -X POST "${API_URL}/admin/activation/requests/${DOWNLINE1_REQUEST_ID}/approve" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" > /dev/null
  echo -e "${GREEN}✅ Downline 1 purchase approved${NC}"
fi

# Step 7: Expire root user's package
echo ""
echo -e "${YELLOW}Step 7: Expiring root user's package (for loss calculation)...${NC}"
# Set active_until to yesterday
YESTERDAY=$(date -u -v-1d +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -u -d "1 day ago" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -u -d "-1 day" +"%Y-%m-%d %H:%M:%S")
execute_sql "UPDATE purchases SET active_until = '${YESTERDAY}'::timestamp WHERE id = ${PURCHASE_ID};"
echo -e "${GREEN}✅ Package expired (active_until set to yesterday)${NC}"

# Verify expiry
EXPIRY_CHECK=$(execute_sql "SELECT active_until < NOW() as is_expired FROM purchases WHERE id = ${PURCHASE_ID};")
if [ "$EXPIRY_CHECK" == "t" ]; then
  echo -e "${GREEN}✅ Package is expired${NC}"
else
  echo -e "${RED}❌ Package is not expired${NC}"
fi

# Step 8: Create more downline purchases after expiry (for SPOT income loss)
echo ""
echo -e "${YELLOW}Step 8: Creating downline purchase after expiry (for SPOT loss)...${NC}"

# Login as downline 2
DOWNLINE2_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${DOWNLINE2_EMAIL}\",
    \"password\": \"Test@123\"
  }")
DOWNLINE2_TOKEN=$(echo $DOWNLINE2_LOGIN | jq -r '.token // empty')

# Create purchase request for downline 2 (after expiry)
DOWNLINE2_REQUEST=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${DOWNLINE2_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_DOWNLINE2_$(date +%s)\",
    \"payment_type\": \"UPI\"
  }")
DOWNLINE2_REQUEST_ID=$(echo $DOWNLINE2_REQUEST | jq -r '.request.id // empty')
echo -e "${GREEN}✅ Downline 2 purchase request: ID ${DOWNLINE2_REQUEST_ID}${NC}"

# Approve if admin token available
if [ "$ADMIN_TOKEN" != "your_admin_token_here" ]; then
  curl -s -X POST "${API_URL}/admin/activation/requests/${DOWNLINE2_REQUEST_ID}/approve" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" > /dev/null
  echo -e "${GREEN}✅ Downline 2 purchase approved${NC}"
fi

# Wait a bit for commission processing
sleep 2

# Step 9: Check expiry loss for expired package
echo ""
echo -e "${YELLOW}Step 9: Checking expiry loss for expired package...${NC}"
MY_COURSE_EXPIRED=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")
echo "$MY_COURSE_EXPIRED" | jq .

EXPIRY_LOSS=$(echo $MY_COURSE_EXPIRED | jq -r '.expiry_loss // empty')
if [ -z "$EXPIRY_LOSS" ] || [ "$EXPIRY_LOSS" == "null" ]; then
  echo -e "${RED}❌ expiry_loss not found in response${NC}"
else
  echo -e "${GREEN}✅ expiry_loss found:${NC}"
  echo "$MY_COURSE_EXPIRED" | jq '.expiry_loss'
  
  # Verify calculations
  TOTAL_LOSS=$(echo $MY_COURSE_EXPIRED | jq -r '.expiry_loss.total_loss')
  DAYS_SINCE=$(echo $MY_COURSE_EXPIRED | jq -r '.expiry_loss.days_since_expiry')
  DAILY_COUNT=$(echo $MY_COURSE_EXPIRED | jq '.expiry_loss.daily_breakdown | length')
  
  echo ""
  echo -e "${CYAN}Loss Summary:${NC}"
  echo "  Total Loss: ₹${TOTAL_LOSS}"
  echo "  Days Since Expiry: ${DAYS_SINCE}"
  echo "  Daily Breakdown Entries: ${DAILY_COUNT}"
fi

# Step 10: Verify in ledger_entries
echo ""
echo -e "${YELLOW}Step 10: Verifying in ledger_entries...${NC}"
echo -e "${CYAN}Commissions for root user (should show SELF, GLOBAL_HELPING, SPOT, MONTHLY):${NC}"
execute_sql_formatted "
SELECT 
  commission_type,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total_amount,
  MIN(credited_at) as first_credit,
  MAX(credited_at) as last_credit
FROM ledger_entries
WHERE receiver_user_id = ${ROOT_USER_ID}
GROUP BY commission_type
ORDER BY commission_type;
"

# Step 11: Check my-course list endpoint
echo ""
echo -e "${YELLOW}Step 11: Checking my-course list endpoint...${NC}"
MY_COURSE_LIST=$(curl -s -X GET "${API_URL}/my-course" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")
echo "$MY_COURSE_LIST" | jq '.items[] | {id, package_name, is_active, global_ids_info, expiry_loss}'

# Step 12: Edge case - Check with no downline
echo ""
echo -e "${YELLOW}Step 12: Edge case - User with no downline...${NC}"
NO_DOWNLINE_EMAIL="nodownline_test_$(date +%s)@test.com"
NO_DOWNLINE_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"No Downline User\",
    \"email\": \"${NO_DOWNLINE_EMAIL}\",
    \"mobile\": \"9999999996\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": null
  }")
NO_DOWNLINE_ID=$(echo $NO_DOWNLINE_RESPONSE | jq -r '.id // empty')

# Login and create purchase
NO_DOWNLINE_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${NO_DOWNLINE_EMAIL}\",
    \"password\": \"Test@123\"
  }")
NO_DOWNLINE_TOKEN=$(echo $NO_DOWNLINE_LOGIN | jq -r '.token // empty')

NO_DOWNLINE_REQUEST=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${NO_DOWNLINE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_NODOWNLINE_$(date +%s)\",
    \"payment_type\": \"UPI\"
  }")
NO_DOWNLINE_REQUEST_ID=$(echo $NO_DOWNLINE_REQUEST | jq -r '.request.id // empty')

if [ "$ADMIN_TOKEN" != "your_admin_token_here" ]; then
  NO_DOWNLINE_APPROVE=$(curl -s -X POST "${API_URL}/admin/activation/requests/${NO_DOWNLINE_REQUEST_ID}/approve" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json")
  NO_DOWNLINE_PURCHASE_ID=$(echo $NO_DOWNLINE_APPROVE | jq -r '.purchase.id // empty')
  
  # Expire it
  execute_sql "UPDATE purchases SET active_until = '${YESTERDAY}'::timestamp WHERE id = ${NO_DOWNLINE_PURCHASE_ID};"
  
  # Check loss (should show only SELF income, no MONTHLY or SPOT)
  NO_DOWNLINE_COURSE=$(curl -s -X GET "${API_URL}/my-course/${NO_DOWNLINE_PURCHASE_ID}" \
    -H "Authorization: Bearer ${NO_DOWNLINE_TOKEN}")
  
  echo -e "${CYAN}Expiry loss for user with no downline:${NC}"
  echo "$NO_DOWNLINE_COURSE" | jq '.expiry_loss'
  
  # Verify MONTHLY and SPOT should be 0
  FIRST_DAY_MONTHLY=$(echo $NO_DOWNLINE_COURSE | jq -r '.expiry_loss.daily_breakdown[0].monthly_royalty // 0')
  FIRST_DAY_SPOT=$(echo $NO_DOWNLINE_COURSE | jq -r '.expiry_loss.daily_breakdown[0].spot_income // 0')
  
  if [ "$FIRST_DAY_MONTHLY" == "0" ] && [ "$FIRST_DAY_SPOT" == "0" ]; then
    echo -e "${GREEN}✅ Correct: No MONTHLY or SPOT income for user with no downline${NC}"
  else
    echo -e "${RED}❌ Error: Should have 0 MONTHLY and SPOT for user with no downline${NC}"
  fi
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""
echo -e "${CYAN}Summary:${NC}"
echo "  - Root User ID: ${ROOT_USER_ID}"
echo "  - Purchase ID: ${PURCHASE_ID}"
echo "  - Package: ${PACKAGE_NAME} (Global IDs: ${PACKAGE_GLOBAL_IDS})"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Check global_ids_info for active packages"
echo "  2. Check expiry_loss for expired packages"
echo "  3. Verify calculations in database"
echo "  4. Check ledger_entries for commission verification"
echo ""

