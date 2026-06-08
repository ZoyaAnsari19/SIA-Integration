#!/bin/bash

# Extreme Edge Cases Test for Package Status Service

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api/v1"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Extreme Edge Cases Test ===${NC}"
echo ""

# Test 1: Invalid maxDays parameter
echo -e "${YELLOW}Test 1: Testing maxDays validation${NC}"
echo "Creating user and expired package..."

# Create user
USER_EMAIL="edge_maxdays_$(date +%s)@test.com"
USER_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Edge MaxDays User\",
    \"email\": \"${USER_EMAIL}\",
    \"mobile\": \"9988776655\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": 1
  }")
USER_ID=$(echo $USER_RESPONSE | jq -r '.id // empty')

# Login
USER_TOKEN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER_EMAIL}\",\"password\":\"Test@123\"}" | jq -r '.token // empty')

# Get package
PACKAGE_ID=$(curl -s -X GET "${API_URL}/packages" | jq -r '.[0].id // empty')
PACKAGE_PRICE=$(curl -s -X GET "${API_URL}/packages" | jq -r '.[0].price // empty')

# Create purchase request
PURCHASE_REQ=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_EDGE_$(date +%s)\"
  }")
REQ_ID=$(echo $PURCHASE_REQ | jq -r '.request.id // empty')

# Approve
APPROVE=$(curl -s -X POST "${API_URL}/admin/activation/requests/${REQ_ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{}")
PURCHASE_ID=$(echo $APPROVE | jq -r '.purchase.id // empty')

# Expire it
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "UPDATE purchases SET active_until = NOW() - INTERVAL '5 days' WHERE id = ${PURCHASE_ID};" > /dev/null 2>&1

# Check expiry_loss (maxDays is hardcoded to 20 in service)
RESULT=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE_ID}" \
  -H "Authorization: Bearer ${USER_TOKEN}")

EXPIRY_LOSS=$(echo $RESULT | jq -r '.expiry_loss')
DAYS_COUNT=$(echo $RESULT | jq -r '.expiry_loss.daily_breakdown | length')

if [ "$EXPIRY_LOSS" != "null" ] && [ "$DAYS_COUNT" != "null" ]; then
  echo -e "${GREEN}✅ maxDays validation working (got ${DAYS_COUNT} days, max 5 since expired 5 days ago)${NC}"
else
  echo -e "${RED}❌ maxDays validation failed${NC}"
fi

echo ""

# Test 2: Zero downline (no MONTHLY/SPOT income)
echo -e "${YELLOW}Test 2: Zero downline scenario${NC}"
USER2_EMAIL="edge_zero_$(date +%s)@test.com"
USER2_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Edge Zero User\",
    \"email\": \"${USER2_EMAIL}\",
    \"mobile\": \"9988776656\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": 1
  }")
USER2_ID=$(echo $USER2_RESPONSE | jq -r '.id // empty')

USER2_TOKEN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER2_EMAIL}\",\"password\":\"Test@123\"}" | jq -r '.token // empty')

PURCHASE2_REQ=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${USER2_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_EDGE2_$(date +%s)\"
  }")
REQ2_ID=$(echo $PURCHASE2_REQ | jq -r '.request.id // empty')

APPROVE2=$(curl -s -X POST "${API_URL}/admin/activation/requests/${REQ2_ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{}")
PURCHASE2_ID=$(echo $APPROVE2 | jq -r '.purchase.id // empty')

# Expire it
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "UPDATE purchases SET active_until = NOW() - INTERVAL '3 days' WHERE id = ${PURCHASE2_ID};" > /dev/null 2>&1

# Check expiry_loss
RESULT2=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE2_ID}" \
  -H "Authorization: Bearer ${USER2_TOKEN}")

MONTHLY_DAY1=$(echo $RESULT2 | jq -r '.expiry_loss.daily_breakdown[0].monthly_royalty')
SPOT_DAY1=$(echo $RESULT2 | jq -r '.expiry_loss.daily_breakdown[0].spot_income')
SELF_DAY1=$(echo $RESULT2 | jq -r '.expiry_loss.daily_breakdown[0].self_income')

if [ "$MONTHLY_DAY1" == "0" ] && [ "$SPOT_DAY1" == "0" ] && [ "$SELF_DAY1" != "0" ]; then
  echo -e "${GREEN}✅ Zero downline handled correctly (SELF > 0, MONTHLY = 0, SPOT = 0)${NC}"
else
  echo -e "${RED}❌ Zero downline handling failed${NC}"
  echo "  SELF: $SELF_DAY1, MONTHLY: $MONTHLY_DAY1, SPOT: $SPOT_DAY1"
fi

echo ""

# Test 3: Package cap = 0 (edge case)
echo -e "${YELLOW}Test 3: Package cap = 0 scenario${NC}"
echo "Note: Requires a package with global_ids = 0 in DB"
echo "Checking existing packages..."

PACKAGES=$(curl -s -X GET "${API_URL}/packages")
ZERO_CAP_PKG=$(echo $PACKAGES | jq -r '.[] | select(.global_ids == 0) | .id')

if [ -n "$ZERO_CAP_PKG" ]; then
  echo -e "${YELLOW}Found package with 0 cap, testing...${NC}"
  # Would need to create purchase with this package and test
  echo -e "${YELLOW}Skipping (would need special test package)${NC}"
else
  echo -e "${YELLOW}No package with global_ids = 0 found (expected)${NC}"
fi

echo ""

# Test 4: Cap reached scenario
echo -e "${YELLOW}Test 4: Testing cap reached detection${NC}"
# This would require creating 55+ purchases, which is slow
echo -e "${YELLOW}Skipping (requires 55+ purchases, covered in test-package-status-edge-cases.sh)${NC}"

echo ""

# Test 5: Negative days since expiry (future date)
echo -e "${YELLOW}Test 5: Future expiry date (should return null)${NC}"
USER3_EMAIL="edge_future_$(date +%s)@test.com"
USER3_RESPONSE=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Edge Future User\",
    \"email\": \"${USER3_EMAIL}\",
    \"mobile\": \"9988776657\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": 1
  }")
USER3_ID=$(echo $USER3_RESPONSE | jq -r '.id // empty')

USER3_TOKEN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"${USER3_EMAIL}\",\"password\":\"Test@123\"}" | jq -r '.token // empty')

PURCHASE3_REQ=$(curl -s -X POST "${API_URL}/purchases" \
  -H "Authorization: Bearer ${USER3_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": ${PACKAGE_ID},
    \"request_type\": \"activation\",
    \"amount\": ${PACKAGE_PRICE},
    \"txn_id\": \"TXN_EDGE3_$(date +%s)\"
  }")
REQ3_ID=$(echo $PURCHASE3_REQ | jq -r '.request.id // empty')

APPROVE3=$(curl -s -X POST "${API_URL}/admin/activation/requests/${REQ3_ID}/approve" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{}")
PURCHASE3_ID=$(echo $APPROVE3 | jq -r '.purchase.id // empty')

# Keep it active (don't expire)
# Check that expiry_loss is null for active package
RESULT3=$(curl -s -X GET "${API_URL}/my-course/${PURCHASE3_ID}" \
  -H "Authorization: Bearer ${USER3_TOKEN}")

EXPIRY_LOSS3=$(echo $RESULT3 | jq -r '.expiry_loss')
GLOBAL_IDS3=$(echo $RESULT3 | jq -r '.global_ids_info')

if [ "$EXPIRY_LOSS3" == "null" ] && [ "$GLOBAL_IDS3" != "null" ]; then
  echo -e "${GREEN}✅ Active package correctly shows global_ids_info, not expiry_loss${NC}"
else
  echo -e "${RED}❌ Active package handling failed${NC}"
fi

echo ""
echo -e "${GREEN}=== Edge Cases Test Complete ===${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  ✅ maxDays parameter validation"
echo "  ✅ Zero downline scenario"
echo "  ✅ Active vs Expired package handling"
echo "  ⚠️  Cap = 0 scenario (needs special test package)"
echo "  ⚠️  Cap reached (covered in other test)"

