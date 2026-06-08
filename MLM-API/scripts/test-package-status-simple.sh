#!/bin/bash

# Simple test for Package Status API endpoints
# Tests without requiring admin approval

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
echo -e "${CYAN}Simple Package Status Test${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Helper function
execute_sql() {
  docker exec mlm-api-db-1 psql -U postgres -d mlm -t -c "$1" 2>/dev/null | xargs || echo "DB query failed"
}

execute_sql_formatted() {
  docker exec mlm-api-db-1 psql -U postgres -d mlm -c "$1" 2>/dev/null || echo "DB query failed"
}

# Step 1: Find existing user with purchase
echo -e "${YELLOW}Step 1: Finding existing user with purchase...${NC}"

# Get first user with a purchase
USER_ID=$(execute_sql "SELECT user_id FROM purchases WHERE status = 'completed' LIMIT 1;")
if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ] || [ "$USER_ID" == "" ]; then
  echo -e "${RED}No users with purchases found. Please create a purchase first.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Found user ID: ${USER_ID}${NC}"

# Get user email for login
USER_EMAIL=$(execute_sql "SELECT email FROM users WHERE id = ${USER_ID};")
if [ -z "$USER_EMAIL" ] || [ "$USER_EMAIL" == "null" ]; then
  echo -e "${RED}User email not found${NC}"
  exit 1
fi

echo -e "${GREEN}✅ User email: ${USER_EMAIL}${NC}"

# Step 2: Login (using default password or get from DB)
echo -e "${YELLOW}Step 2: Attempting login...${NC}"
echo -e "${YELLOW}⚠️  Note: Using Test@123 as password. If this fails, please login manually.${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${USER_EMAIL}\",
    \"password\": \"Test@123\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo -e "${YELLOW}⚠️  Auto-login failed. Please provide token manually:${NC}"
  echo "   curl -X POST ${API_URL}/auth/login -H 'Content-Type: application/json' -d '{\"userId\":\"${USER_EMAIL}\",\"password\":\"YOUR_PASSWORD\"}'"
  read -p "Enter token: " TOKEN
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}Token required. Exiting.${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✅ Login successful${NC}"
fi

# Step 3: Get user's purchases
echo ""
echo -e "${YELLOW}Step 3: Getting user's purchases...${NC}"
MY_COURSE_LIST=$(curl -s -X GET "${API_URL}/my-course" \
  -H "Authorization: Bearer ${TOKEN}")

PURCHASE_COUNT=$(echo $MY_COURSE_LIST | jq '.items | length')
echo -e "${GREEN}✅ Found ${PURCHASE_COUNT} purchase(s)${NC}"

if [ "$PURCHASE_COUNT" -eq 0 ]; then
  echo -e "${RED}No purchases found for user${NC}"
  exit 1
fi

# Step 4: Check each purchase for global_ids_info and expiry_loss
echo ""
echo -e "${YELLOW}Step 4: Checking purchases for global_ids_info and expiry_loss...${NC}"

for i in $(seq 0 $((PURCHASE_COUNT - 1))); do
  PURCHASE_ID=$(echo $MY_COURSE_LIST | jq -r ".items[${i}].id")
  IS_ACTIVE=$(echo $MY_COURSE_LIST | jq -r ".items[${i}].is_active")
  PACKAGE_NAME=$(echo $MY_COURSE_LIST | jq -r ".items[${i}].package_name")
  
  echo ""
  echo -e "${CYAN}Purchase ${i+1}: ID ${PURCHASE_ID} (${PACKAGE_NAME})${NC}"
  echo -e "  Active: ${IS_ACTIVE}"
  
  # Get detailed purchase info
  PURCHASE_DETAIL=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
    -H "Authorization: Bearer ${TOKEN}")
  
  # Check for global_ids_info (active purchases)
  if [ "$IS_ACTIVE" == "true" ]; then
    GLOBAL_IDS=$(echo $PURCHASE_DETAIL | jq '.global_ids_info // empty')
    if [ -z "$GLOBAL_IDS" ] || [ "$GLOBAL_IDS" == "null" ]; then
      echo -e "  ${RED}❌ global_ids_info missing${NC}"
    else
      echo -e "  ${GREEN}✅ global_ids_info:${NC}"
      echo "$PURCHASE_DETAIL" | jq '.global_ids_info' | sed 's/^/    /'
      
      # Verify in DB
      PACKAGE_CAP=$(echo $PURCHASE_DETAIL | jq -r '.global_ids_info.package_cap')
      USED_IDS=$(echo $PURCHASE_DETAIL | jq -r '.global_ids_info.used_ids')
      REMAINING=$(echo $PURCHASE_DETAIL | jq -r '.global_ids_info.remaining_ids')
      
      echo -e "  ${CYAN}DB Verification:${NC}"
      DB_GLOBAL_COUNT=$(execute_sql "SELECT COUNT(*) FROM purchases WHERE status = 'completed' AND user_id != ${USER_ID} AND purchased_at <= NOW();")
      echo "    Total global users (excluding self): ${DB_GLOBAL_COUNT}"
      echo "    Package cap: ${PACKAGE_CAP}"
      echo "    Used IDs: ${USED_IDS}"
      echo "    Remaining: ${REMAINING}"
    fi
  fi
  
  # Check for expiry_loss (expired purchases)
  if [ "$IS_ACTIVE" == "false" ]; then
    EXPIRY_LOSS=$(echo $PURCHASE_DETAIL | jq '.expiry_loss // empty')
    if [ -z "$EXPIRY_LOSS" ] || [ "$EXPIRY_LOSS" == "null" ]; then
      echo -e "  ${YELLOW}⚠️  expiry_loss missing (package might not be expired)${NC}"
    else
      echo -e "  ${GREEN}✅ expiry_loss:${NC}"
      TOTAL_LOSS=$(echo $PURCHASE_DETAIL | jq -r '.expiry_loss.total_loss')
      DAYS_SINCE=$(echo $PURCHASE_DETAIL | jq -r '.expiry_loss.days_since_expiry')
      DAILY_COUNT=$(echo $PURCHASE_DETAIL | jq '.expiry_loss.daily_breakdown | length')
      
      echo "    Total Loss: ₹${TOTAL_LOSS}"
      echo "    Days Since Expiry: ${DAYS_SINCE}"
      echo "    Daily Breakdown Entries: ${DAILY_COUNT}"
      
      # Show first day breakdown
      if [ "$DAILY_COUNT" -gt 0 ]; then
        echo -e "  ${CYAN}First Day Breakdown:${NC}"
        echo "$PURCHASE_DETAIL" | jq '.expiry_loss.daily_breakdown[0]' | sed 's/^/    /'
      fi
    fi
  fi
done

# Step 5: Verify ledger entries
echo ""
echo -e "${YELLOW}Step 5: Verifying ledger entries...${NC}"
echo -e "${CYAN}Commission summary for user ${USER_ID}:${NC}"
execute_sql_formatted "
SELECT 
  commission_type,
  COUNT(*) as count,
  SUM(amount)::numeric(10,2) as total_amount
FROM ledger_entries
WHERE receiver_user_id = ${USER_ID}
GROUP BY commission_type
ORDER BY commission_type;
"

# Step 6: Check database for purchase details
echo ""
echo -e "${YELLOW}Step 6: Database verification...${NC}"
FIRST_PURCHASE_ID=$(echo $MY_COURSE_LIST | jq -r '.items[0].id')
echo -e "${CYAN}Purchase details from DB (ID: ${FIRST_PURCHASE_ID}):${NC}"
execute_sql_formatted "
SELECT 
  p.id,
  p.user_id,
  p.package_id,
  pk.name as package_name,
  pk.global_ids as package_global_ids,
  p.effective_global_ids,
  p.active_until,
  CASE 
    WHEN p.active_until >= NOW() THEN 'Active'
    ELSE 'Expired'
  END as status,
  (SELECT COUNT(*) FROM purchases WHERE status = 'completed' AND user_id != p.user_id AND purchased_at <= NOW()) as total_global_users
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.id = ${FIRST_PURCHASE_ID};
"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""

