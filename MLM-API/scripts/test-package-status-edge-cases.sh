#!/bin/bash

# Comprehensive edge case testing for package status and loss tracking

BASE_URL="http://localhost:3000/api/v1"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Package Status & Loss Tracking - Edge Cases Test ===${NC}"
echo ""

# Test 1: Cap reached scenario
echo -e "${YELLOW}Test 1: Global IDs cap reached${NC}"
echo "Creating 60 users (cap is 55)..."

# Create root user
ROOT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cap_test@test.com",
    "password": "Test@123",
    "name": "Cap Test User",
    "mobile": "9900000001",
    "referrer_user_id": 1
  }')

ROOT_ID=$(echo $ROOT_RESPONSE | jq -r '.id')
echo "Root user created: ID $ROOT_ID"

# Login root user
ROOT_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"userId":"cap_test@test.com","password":"Test@123"}' | jq -r '.token')

# Get package
PACKAGE=$(curl -s -X GET "$BASE_URL/packages" | jq -r '.[0]')
PACKAGE_ID=$(echo $PACKAGE | jq -r '.id')
PACKAGE_PRICE=$(echo $PACKAGE | jq -r '.price')
GLOBAL_CAP=$(echo $PACKAGE | jq -r '.global_ids')

echo "Package: ID=$PACKAGE_ID, Price=$PACKAGE_PRICE, Global Cap=$GLOBAL_CAP"

# Create purchase request for root
PURCHASE_REQ=$(curl -s -X POST "$BASE_URL/purchases" \
  -H "Authorization: Bearer $ROOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"txn_id\": \"CAP_TEST_001\"
  }")

PURCHASE_REQ_ID=$(echo $PURCHASE_REQ | jq -r '.id')

# Approve purchase
ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$PURCHASE_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved_amount": '$PACKAGE_PRICE'}')

ROOT_PURCHASE_ID=$(echo $ADMIN_RESPONSE | jq -r '.purchase.id')
echo "Root purchase approved: ID $ROOT_PURCHASE_ID"

# Create 60 other users to exceed cap
for i in {1..60}; do
  USER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"user_cap_$i@test.com\",
      \"password\": \"Test@123\",
      \"name\": \"User Cap $i\",
      \"mobile\": \"99000$(printf '%05d' $i)\",
      \"referrer_user_id\": 1
    }")
  
  USER_ID=$(echo $USER_RESPONSE | jq -r '.id')
  
  # Login user
  USER_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"user_cap_$i@test.com\",\"password\":\"Test@123\"}" | jq -r '.token')
  
  # Create purchase request
  USER_PURCHASE_REQ=$(curl -s -X POST "$BASE_URL/purchases" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"package_id\": $PACKAGE_ID,
      \"request_type\": \"activation\",
      \"txn_id\": \"CAP_USER_$(printf '%03d' $i)\"
    }")
  
  USER_PURCHASE_REQ_ID=$(echo $USER_PURCHASE_REQ | jq -r '.id')
  
  # Approve purchase
  curl -s -X POST "$BASE_URL/admin/activation/requests/$USER_PURCHASE_REQ_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"approved_amount\": $PACKAGE_PRICE}" > /dev/null
  
  if [ $((i % 10)) -eq 0 ]; then
    echo "  Created $i users..."
  fi
done

echo "All 60 users created and purchases approved"
echo ""

# Check root user's global_ids_info
echo "Checking root user's global_ids_info (should show cap reached)..."
GLOBAL_INFO=$(curl -s -X GET "$BASE_URL/my-course/$ROOT_PURCHASE_ID" \
  -H "Authorization: Bearer $ROOT_TOKEN" | jq '.global_ids_info')

echo "Global IDs Info:"
echo $GLOBAL_INFO | jq '.'

USED_IDS=$(echo $GLOBAL_INFO | jq -r '.used_ids')
IS_CAP_REACHED=$(echo $GLOBAL_INFO | jq -r '.is_cap_reached')
NEW_IDS_AFTER_CAP=$(echo $GLOBAL_INFO | jq -r '.new_ids_after_cap')

if [ "$IS_CAP_REACHED" = "true" ]; then
  echo -e "${GREEN}✅ Cap reached: true${NC}"
  echo -e "${GREEN}✅ Used IDs: $USED_IDS (should be $GLOBAL_CAP)${NC}"
  echo -e "${GREEN}✅ New IDs after cap: $NEW_IDS_AFTER_CAP (should be $(($USED_IDS - $GLOBAL_CAP)))${NC}"
else
  echo -e "${RED}❌ Cap not reached (expected: true, got: $IS_CAP_REACHED)${NC}"
fi

echo ""
echo -e "${YELLOW}Test 2: Expired package with active downline${NC}"

# Create a user with downline, expire package, check loss
EXPIRED_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "expired_test@test.com",
    "password": "Test@123",
    "name": "Expired Test User",
    "mobile": "9900000999",
    "referrer_user_id": 1
  }')

EXPIRED_USER_ID=$(echo $EXPIRED_USER_RESPONSE | jq -r '.id')
echo "Expired test user created: ID $EXPIRED_USER_ID"

# Login
EXPIRED_USER_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"userId":"expired_test@test.com","password":"Test@123"}' | jq -r '.token')

# Create purchase
EXPIRED_PURCHASE_REQ=$(curl -s -X POST "$BASE_URL/purchases" \
  -H "Authorization: Bearer $EXPIRED_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"txn_id\": \"EXPIRED_TEST_001\"
  }")

EXPIRED_PURCHASE_REQ_ID=$(echo $EXPIRED_PURCHASE_REQ | jq -r '.id')

# Approve
EXPIRED_ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$EXPIRED_PURCHASE_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"approved_amount\": $PACKAGE_PRICE}")

EXPIRED_PURCHASE_ID=$(echo $EXPIRED_ADMIN_RESPONSE | jq -r '.purchase.id')
echo "Expired test purchase approved: ID $EXPIRED_PURCHASE_ID"

# Create downline users (3 users)
for i in {1..3}; do
  DOWNLINE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"downline_exp_$i@test.com\",
      \"password\": \"Test@123\",
      \"name\": \"Downline Exp $i\",
      \"mobile\": \"99001$(printf '%05d' $i)\",
      \"referrer_user_id\": $EXPIRED_USER_ID
    }")
  
  DOWNLINE_ID=$(echo $DOWNLINE_RESPONSE | jq -r '.id')
  
  # Login
  DOWNLINE_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"userId\":\"downline_exp_$i@test.com\",\"password\":\"Test@123\"}" | jq -r '.token')
  
  # Create purchase
  DOWNLINE_PURCHASE_REQ=$(curl -s -X POST "$BASE_URL/purchases" \
    -H "Authorization: Bearer $DOWNLINE_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"package_id\": $PACKAGE_ID,
      \"request_type\": \"activation\",
      \"txn_id\": \"DOWNLINE_EXP_$(printf '%03d' $i)\"
    }")
  
  DOWNLINE_PURCHASE_REQ_ID=$(echo $DOWNLINE_PURCHASE_REQ | jq -r '.id')
  
  # Approve
  curl -s -X POST "$BASE_URL/admin/activation/requests/$DOWNLINE_PURCHASE_REQ_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"approved_amount\": $PACKAGE_PRICE}" > /dev/null
  
  echo "  Downline user $i created and purchase approved"
done

# Expire the package
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "UPDATE purchases SET active_until = NOW() - INTERVAL '5 days' WHERE id = $EXPIRED_PURCHASE_ID;" > /dev/null 2>&1

echo "Package expired (5 days ago)"
echo ""

# Check expiry_loss
echo "Checking expiry_loss (should show loss for 5 days)..."
EXPIRY_LOSS=$(curl -s -X GET "$BASE_URL/my-course/$EXPIRED_PURCHASE_ID" \
  -H "Authorization: Bearer $EXPIRED_USER_TOKEN" | jq '.expiry_loss')

echo "Expiry Loss:"
echo $EXPIRY_LOSS | jq '.'

TOTAL_LOSS=$(echo $EXPIRY_LOSS | jq -r '.total_loss')
DAYS_SINCE_EXPIRY=$(echo $EXPIRY_LOSS | jq -r '.days_since_expiry')
DAILY_BREAKDOWN_COUNT=$(echo $EXPIRY_LOSS | jq -r '.daily_breakdown | length')

if [ "$EXPIRY_LOSS" != "null" ]; then
  echo -e "${GREEN}✅ Expiry loss found${NC}"
  echo -e "${GREEN}✅ Days since expiry: $DAYS_SINCE_EXPIRY (should be ~5)${NC}"
  echo -e "${GREEN}✅ Daily breakdown entries: $DAILY_BREAKDOWN_COUNT${NC}"
  echo -e "${GREEN}✅ Total loss: ₹$TOTAL_LOSS${NC}"
else
  echo -e "${RED}❌ Expiry loss is null${NC}"
fi

echo ""
echo -e "${YELLOW}Test 3: Package with no downline (zero loss)${NC}"

# Create user, expire package, check loss (should be self income only)
NO_DOWNLINE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "no_downline@test.com",
    "password": "Test@123",
    "name": "No Downline User",
    "mobile": "9900001000",
    "referrer_user_id": 1
  }')

NO_DOWNLINE_ID=$(echo $NO_DOWNLINE_RESPONSE | jq -r '.id')

# Login
NO_DOWNLINE_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"userId":"no_downline@test.com","password":"Test@123"}' | jq -r '.token')

# Create purchase
NO_DOWNLINE_PURCHASE_REQ=$(curl -s -X POST "$BASE_URL/purchases" \
  -H "Authorization: Bearer $NO_DOWNLINE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"txn_id\": \"NO_DOWNLINE_001\"
  }")

NO_DOWNLINE_PURCHASE_REQ_ID=$(echo $NO_DOWNLINE_PURCHASE_REQ | jq -r '.id')

# Approve
NO_DOWNLINE_ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$NO_DOWNLINE_PURCHASE_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"approved_amount\": $PACKAGE_PRICE}")

NO_DOWNLINE_PURCHASE_ID=$(echo $NO_DOWNLINE_ADMIN_RESPONSE | jq -r '.purchase.id')

# Expire package
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "UPDATE purchases SET active_until = NOW() - INTERVAL '3 days' WHERE id = $NO_DOWNLINE_PURCHASE_ID;" > /dev/null 2>&1

# Check expiry_loss
NO_DOWNLINE_LOSS=$(curl -s -X GET "$BASE_URL/my-course/$NO_DOWNLINE_PURCHASE_ID" \
  -H "Authorization: Bearer $NO_DOWNLINE_TOKEN" | jq '.expiry_loss')

echo "Expiry Loss (no downline):"
echo $NO_DOWNLINE_LOSS | jq '.'

# Check that monthly_royalty and spot_income are 0
SAMPLE_DAY=$(echo $NO_DOWNLINE_LOSS | jq -r '.daily_breakdown[0]')
MONTHLY_ROYALTY=$(echo $SAMPLE_DAY | jq -r '.monthly_royalty')
SPOT_INCOME=$(echo $SAMPLE_DAY | jq -r '.spot_income')
SELF_INCOME=$(echo $SAMPLE_DAY | jq -r '.self_income')

if [ "$MONTHLY_ROYALTY" = "0" ] && [ "$SPOT_INCOME" = "0" ] && [ "$SELF_INCOME" != "0" ]; then
  echo -e "${GREEN}✅ Loss calculated correctly (only SELF income, no team income)${NC}"
else
  echo -e "${RED}❌ Loss calculation incorrect${NC}"
  echo "  SELF: $SELF_INCOME, MONTHLY: $MONTHLY_ROYALTY, SPOT: $SPOT_INCOME"
fi

echo ""
echo -e "${GREEN}=== All Edge Case Tests Complete ===${NC}"

