#!/bin/bash
# Test Renew API Endpoint

set -e

API_URL="${API_URL:-http://localhost:3000}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  RENEW API TEST                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📡 API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Register a test user
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Step 1: Register test user"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "renewtest@example.com",
    "password": "password123",
    "name": "Renew Test User"
  }')

echo "Register response:"
echo "$REGISTER_RESPONSE" | jq . 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id' 2>/dev/null || echo "")
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to register user${NC}"
  exit 1
fi

echo -e "${GREEN}✅ User registered with ID: $USER_ID${NC}"
echo ""

# Step 2: Login
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Step 2: Login"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "renewtest@example.com",
    "password": "password123"
  }')

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null || echo "")
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo ""

# Step 3: Get available packages
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Step 3: Get available packages"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PACKAGES_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/packages" \
  -H "Authorization: Bearer $TOKEN")

echo "Packages response:"
echo "$PACKAGES_RESPONSE" | jq . 2>/dev/null || echo "$PACKAGES_RESPONSE"
echo ""

# Get first package ID (assuming at least one package exists)
PACKAGE1_ID=$(echo "$PACKAGES_RESPONSE" | jq -r '.[0].id' 2>/dev/null || echo "")
if [ -z "$PACKAGE1_ID" ] || [ "$PACKAGE1_ID" = "null" ]; then
  echo -e "${YELLOW}⚠️  No packages found. Please create a package first.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Using package ID: $PACKAGE1_ID${NC}"
echo ""

# Step 4: Create first purchase (to enable renewal later)
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Step 4: Create first purchase"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PURCHASE1_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE1_ID,
    \"txn_id\": \"TXN001\",
    \"payment_type\": \"UPI\"
  }")

echo "First purchase response:"
echo "$PURCHASE1_RESPONSE" | jq . 2>/dev/null || echo "$PURCHASE1_RESPONSE"
echo ""

PURCHASE1_ID=$(echo "$PURCHASE1_RESPONSE" | jq -r '.purchase.id' 2>/dev/null || echo "")
if [ -z "$PURCHASE1_ID" ] || [ "$PURCHASE1_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create first purchase${NC}"
  exit 1
fi

echo -e "${GREEN}✅ First purchase created with ID: $PURCHASE1_ID${NC}"
echo ""

# Step 5: Wait a moment for commission processing
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Step 5: Waiting 3 seconds for commission processing..."
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
sleep 3
echo ""

# Step 6: Try to renew (should fail - package not expired/2x yet)
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Step 6: Try to renew (should fail - package not expired/2x yet)"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

RENEW_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/purchases/renew" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE1_ID,
    \"txn_id\": \"TXN002\",
    \"payment_type\": \"UPI\"
  }")

echo "Renew response (expected to fail):"
echo "$RENEW_RESPONSE" | jq . 2>/dev/null || echo "$RENEW_RESPONSE"
echo ""

ERROR=$(echo "$RENEW_RESPONSE" | jq -r '.error' 2>/dev/null || echo "")
if [ "$ERROR" = "no_renewal_eligible" ]; then
  echo -e "${GREEN}✅ Correctly rejected renewal (package not expired/2x)${NC}"
else
  echo -e "${YELLOW}⚠️  Unexpected response (might be OK if package is expired/2x)${NC}"
fi
echo ""

# Step 7: Check purchase details
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Step 7: Check purchase details"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PURCHASE_DETAILS=$(curl -s -X GET "$API_URL/api/v1/purchases/$PURCHASE1_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Purchase details:"
echo "$PURCHASE_DETAILS" | jq . 2>/dev/null || echo "$PURCHASE_DETAILS"
echo ""

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Summary:"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "✅ User registered: $USER_ID"
echo "✅ First purchase created: $PURCHASE1_ID"
echo ""
echo "📝 Note: To test actual renewal, you need to:"
echo "   1. Wait for package to expire (active_until < today), OR"
echo "   2. Wait for package to reach 2x investment (SELF + GLOBAL_HELPING >= 2x amount)"
echo ""
echo "Then run:"
echo "   curl -X POST \"$API_URL/api/v1/purchases/renew\" \\"
echo "     -H \"Authorization: Bearer $TOKEN\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"package_id\": $PACKAGE1_ID, \"txn_id\": \"TXN003\"}'"
echo ""

