#!/bin/bash

# Fee System Endpoints Test Script
# Make sure server is running on http://localhost:3000

BASE_URL="http://localhost:3000"
ADMIN_TOKEN="${ADMIN_TOKEN:-your-admin-token-here}"

echo "=========================================="
echo "Fee System Endpoints Test"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Login to get user token
echo -e "${YELLOW}Step 1: Login to get user token${NC}"
echo "POST $BASE_URL/api/v1/auth/login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed. Response: $LOGIN_RESPONSE${NC}"
  echo "Please check if server is running and user exists."
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Step 2: Get user's fee history
echo -e "${YELLOW}Step 2: Get user's fee history${NC}"
echo "GET $BASE_URL/api/v1/fees/history?page=1&limit=10"
curl -s -X GET "$BASE_URL/api/v1/fees/history?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "Response received"
echo ""

# Step 3: Get active fee rules (user)
echo -e "${YELLOW}Step 3: Get active fee rules (user)${NC}"
echo "GET $BASE_URL/api/v1/fees/rules"
curl -s -X GET "$BASE_URL/api/v1/fees/rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "Response received"
echo ""

# Step 4: Test report download (will deduct fee)
echo -e "${YELLOW}Step 4: Test report download (will deduct ₹20)${NC}"
echo "POST $BASE_URL/api/v1/reports/download"
curl -s -X POST "$BASE_URL/api/v1/reports/download" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "income",
    "format": "pdf"
  }' | jq '.' || echo "Response received"
echo ""

# Step 5: Admin - List fee rules
echo -e "${YELLOW}Step 5: Admin - List fee rules${NC}"
echo "GET $BASE_URL/api/v1/admin/fees/rules"
curl -s -X GET "$BASE_URL/api/v1/admin/fees/rules?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "Response received"
echo ""

# Step 6: Admin - Create fee rule
echo -e "${YELLOW}Step 6: Admin - Create fee rule${NC}"
echo "POST $BASE_URL/api/v1/admin/fees/rules"
curl -s -X POST "$BASE_URL/api/v1/admin/fees/rules" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_code": "TEST_FEE",
    "rule_name": "Test Fee",
    "description": "Test fee for testing",
    "amount": 5.00,
    "is_active": true,
    "applies_to": "all_users"
  }' | jq '.' || echo "Response received"
echo ""

# Step 7: Admin - Get fee rule by ID (assuming ID 1 exists)
echo -e "${YELLOW}Step 7: Admin - Get fee rule by ID${NC}"
echo "GET $BASE_URL/api/v1/admin/fees/rules/1"
curl -s -X GET "$BASE_URL/api/v1/admin/fees/rules/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "Response received"
echo ""

# Step 8: Admin - Update fee rule
echo -e "${YELLOW}Step 8: Admin - Update fee rule${NC}"
echo "PUT $BASE_URL/api/v1/admin/fees/rules/1"
curl -s -X PUT "$BASE_URL/api/v1/admin/fees/rules/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "Updated Test Fee",
    "amount": 10.00
  }' | jq '.' || echo "Response received"
echo ""

# Step 9: Admin - List all fee transactions
echo -e "${YELLOW}Step 9: Admin - List all fee transactions${NC}"
echo "GET $BASE_URL/api/v1/admin/fees/transactions"
curl -s -X GET "$BASE_URL/api/v1/admin/fees/transactions?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "Response received"
echo ""

# Step 10: Admin - Get user's fee transactions
echo -e "${YELLOW}Step 10: Admin - Get user fee transactions${NC}"
echo "GET $BASE_URL/api/v1/admin/fees/transactions/{userId}"
USER_ID=$(echo $LOGIN_RESPONSE | grep -o '"user_id":"[^"]*' | cut -d'"' -f4 || echo "1")
curl -s -X GET "$BASE_URL/api/v1/admin/fees/transactions/$USER_ID?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" | jq '.' || echo "Response received"
echo ""

# Step 11: Test insufficient balance (if balance is low)
echo -e "${YELLOW}Step 11: Test insufficient balance scenario${NC}"
echo "POST $BASE_URL/api/v1/reports/download (with low balance)"
curl -s -X POST "$BASE_URL/api/v1/reports/download" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "wallet",
    "format": "pdf"
  }' | jq '.' || echo "Response received"
echo ""

echo -e "${GREEN}=========================================="
echo "Test completed!"
echo "==========================================${NC}"

