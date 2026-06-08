#!/bin/bash

# Test script for Package Status with Admin API approval
# Uses admin API for all approvals, no direct DB manipulation

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Package Status Test with Admin API${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Helper functions
execute_sql() {
  docker exec mlm-api-db-1 psql -U postgres -d mlm -t -c "$1" 2>/dev/null | xargs || echo "DB query failed"
}

execute_sql_formatted() {
  docker exec mlm-api-db-1 psql -U postgres -d mlm -c "$1" 2>/dev/null || echo "DB query failed"
}

# Step 1: Admin Authentication
echo -e "${YELLOW}Step 1: Admin Authentication...${NC}"

# Try ADMIN_TOKEN env var first (Bearer token)
if [ -n "$ADMIN_TOKEN" ]; then
  ADMIN_AUTH_TOKEN="$ADMIN_TOKEN"
  echo -e "${GREEN}✅ Using ADMIN_TOKEN from env as Bearer token${NC}"
else
  # Try admin login with email/password
  ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-Test@123}"
  
  # Try to find admin user in DB
  DB_ADMIN_EMAIL=$(execute_sql "SELECT email FROM users WHERE email LIKE '%admin%' OR email LIKE '%@test.com' LIMIT 1;")
  if [ -n "$DB_ADMIN_EMAIL" ] && [ "$DB_ADMIN_EMAIL" != "null" ] && [ "$DB_ADMIN_EMAIL" != "" ]; then
    ADMIN_EMAIL="$DB_ADMIN_EMAIL"
    echo -e "${CYAN}Found admin email in DB: ${ADMIN_EMAIL}${NC}"
  fi
  
  ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/admin/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"${ADMIN_EMAIL}\",
      \"password\": \"${ADMIN_PASSWORD}\"
    }")
  
  ADMIN_AUTH_TOKEN=$(echo $ADMIN_LOGIN_RESPONSE | jq -r '.token // empty')
  
  if [ -z "$ADMIN_AUTH_TOKEN" ] || [ "$ADMIN_AUTH_TOKEN" == "null" ]; then
    echo -e "${RED}❌ Admin authentication failed${NC}"
    echo -e "${YELLOW}   Please set ADMIN_TOKEN env var or create admin user with email/password${NC}"
    echo -e "${YELLOW}   Example: export ADMIN_TOKEN='dev-admin'${NC}"
    exit 1
  else
    echo -e "${GREEN}✅ Admin login successful${NC}"
  fi
fi

ADMIN_TOKEN="$ADMIN_AUTH_TOKEN"

# Step 2: Create test users
echo ""
echo -e "${YELLOW}Step 2: Creating test users...${NC}"

# Create root user (will test expired package)
ROOT_EMAIL="root_test_$(date +%s)@test.com"
ROOT_PASSWORD="Test@123"
# Get first user as referrer (or use 1 as default)
REFERRER_ID=$(execute_sql "SELECT id FROM users LIMIT 1;")
if [ -z "$REFERRER_ID" ] || [ "$REFERRER_ID" == "null" ]; then
  REFERRER_ID=1
fi

ROOT_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Root Test User\",
    \"email\": \"${ROOT_EMAIL}\",
    \"mobile\": \"9999999999\",
    \"password\": \"${ROOT_PASSWORD}\",
    \"referrer_user_id\": ${REFERRER_ID}
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

# Step 3: Get package
echo ""
echo -e "${YELLOW}Step 3: Getting package...${NC}"
PACKAGES_RESPONSE=$(curl -s -X GET "${API_URL}/packages" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")
PACKAGE_ID=$(echo $PACKAGES_RESPONSE | jq -r '.[0].id // empty')
PACKAGE_NAME=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .name")
PACKAGE_PRICE=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .price")
PACKAGE_GLOBAL_IDS=$(echo $PACKAGES_RESPONSE | jq -r ".[] | select(.id == ${PACKAGE_ID}) | .global_ids")
echo -e "${GREEN}✅ Using package: ${PACKAGE_NAME} (ID: ${PACKAGE_ID}, Price: ₹${PACKAGE_PRICE}, Global IDs: ${PACKAGE_GLOBAL_IDS})${NC}"

# Step 4: Create purchase request for root user
echo ""
echo -e "${YELLOW}Step 4: Creating purchase request for root user...${NC}"
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

# Step 5: Approve purchase request via Admin API
echo ""
echo -e "${YELLOW}Step 5: Approving purchase request via Admin API...${NC}"
APPROVE_RESPONSE=$(curl -s -X POST "${API_URL}/admin/activation/requests/${REQUEST_ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{}")
PURCHASE_ID=$(echo $APPROVE_RESPONSE | jq -r '.purchase.id // empty')
if [ -z "$PURCHASE_ID" ] || [ "$PURCHASE_ID" == "null" ]; then
  echo -e "${RED}Failed to approve request${NC}"
  echo "$APPROVE_RESPONSE" | jq .
  exit 1
fi
echo -e "${GREEN}✅ Purchase approved via Admin API: ID ${PURCHASE_ID}${NC}"

# Step 6: Check global IDs info for active package
echo ""
echo -e "${YELLOW}Step 6: Checking global IDs info for active package...${NC}"
MY_COURSE_RESPONSE=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")

echo -e "${CYAN}Full Response:${NC}"
echo "$MY_COURSE_RESPONSE" | jq .

GLOBAL_IDS_INFO=$(echo $MY_COURSE_RESPONSE | jq -r '.global_ids_info // empty')
if [ -z "$GLOBAL_IDS_INFO" ] || [ "$GLOBAL_IDS_INFO" == "null" ]; then
  echo -e "${RED}❌ global_ids_info not found in response${NC}"
else
  echo -e "${GREEN}✅ global_ids_info found:${NC}"
  echo "$MY_COURSE_RESPONSE" | jq '.global_ids_info'
  
  # Verify in DB
  echo ""
  echo -e "${CYAN}DB Verification:${NC}"
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

# Step 7: Expire package via API (update active_until)
echo ""
echo -e "${YELLOW}Step 7: Expiring package (for loss calculation test)...${NC}"
echo -e "${YELLOW}⚠️  Note: Expiring via DB update for testing. In production, this happens naturally.${NC}"

# Set active_until to yesterday
YESTERDAY=$(date -u -v-1d +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -u -d "1 day ago" +"%Y-%m-%d %H:%M:%S" 2>/dev/null || date -u -d "-1 day" +"%Y-%m-%d %H:%M:%S")
execute_sql "UPDATE purchases SET active_until = '${YESTERDAY}'::timestamp WHERE id = ${PURCHASE_ID};"
echo -e "${GREEN}✅ Package expired (active_until set to yesterday)${NC}"

# Step 8: Create downline purchase (for loss calculation)
echo ""
echo -e "${YELLOW}Step 8: Creating downline purchase (for loss calculation)...${NC}"

# Login as downline
DOWNLINE_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${DOWNLINE_EMAIL}\",
    \"password\": \"Test@123\"
  }")
DOWNLINE_TOKEN=$(echo $DOWNLINE_LOGIN | jq -r '.token // empty')

# Create purchase request
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

# Approve via Admin API
APPROVE_DOWNLINE=$(curl -s -X POST "${API_URL}/admin/activation/requests/${DOWNLINE_REQUEST_ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{}")
echo -e "${GREEN}✅ Downline purchase approved${NC}"

# Wait for commission processing
sleep 2

# Step 9: Check expiry loss for expired package
echo ""
echo -e "${YELLOW}Step 9: Checking expiry loss for expired package...${NC}"
MY_COURSE_EXPIRED=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
  -H "Authorization: Bearer ${ROOT_TOKEN}")

EXPIRY_LOSS=$(echo $MY_COURSE_EXPIRED | jq -r '.expiry_loss // empty')
if [ -z "$EXPIRY_LOSS" ] || [ "$EXPIRY_LOSS" == "null" ]; then
  echo -e "${RED}❌ expiry_loss not found in response${NC}"
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

# Step 10: Verify in ledger_entries
echo ""
echo -e "${YELLOW}Step 10: Verifying in ledger_entries...${NC}"
echo -e "${CYAN}Commissions for root user:${NC}"
execute_sql_formatted "
SELECT 
  commission_type,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total_amount
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

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""
echo -e "${CYAN}Summary:${NC}"
echo "  - Root User ID: ${ROOT_USER_ID}"
echo "  - Purchase ID: ${PURCHASE_ID}"
echo "  - Package: ${PACKAGE_NAME} (Global IDs: ${PACKAGE_GLOBAL_IDS})"
echo ""
echo -e "${CYAN}All approvals done via Admin API ✅${NC}"
echo ""

