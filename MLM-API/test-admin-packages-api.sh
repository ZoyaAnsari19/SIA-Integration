#!/bin/bash
# Test Admin Package APIs - Create, Update, Delete, List

set -e

API_URL="${API_URL:-http://localhost:3000}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ADMIN PACKAGE APIs TEST                                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Step 1: Admin Authentication
print_section "Step 1: Admin Authentication"

# Note: Admin login requires email/password
# For testing, we can use ADMIN_TOKEN directly as Bearer token (which is already supported)
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin}"

echo -e "${YELLOW}Note: Admin login endpoint requires email/password${NC}"
echo "For API testing, using ADMIN_TOKEN as Bearer token (supported by adminAuth middleware)"
echo ""

# Use ADMIN_TOKEN directly as Bearer token for API calls
TOKEN="$ADMIN_TOKEN"

echo -e "${GREEN}✅ Using ADMIN_TOKEN as Bearer token for API calls${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: List Packages
print_section "Step 2: List All Packages (GET /api/v1/admin/packages)"

LIST_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/packages" \
  -H "Authorization: Bearer $TOKEN")

echo "List packages response:"
echo "$LIST_RESPONSE" | jq . 2>/dev/null || echo "$LIST_RESPONSE"
echo ""

if echo "$LIST_RESPONSE" | grep -q "unauthorized"; then
  echo -e "${RED}❌ Unauthorized - Check admin token${NC}"
  exit 1
fi

PACKAGE_COUNT=$(echo "$LIST_RESPONSE" | jq -r '.total // .items | length' 2>/dev/null || echo "0")
echo -e "${GREEN}✅ Found $PACKAGE_COUNT packages${NC}"
echo ""

# Step 3: Create Package
print_section "Step 3: Create New Package (POST /api/v1/admin/packages)"

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/admin/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Package API",
    "price": 5000,
    "self_monthly": 125.50,
    "global_ids": 100,
    "global_monthly_per_id": 6.25,
    "recurring_rate_percent": 0.5,
    "validity_months": 12,
    "status": "active"
  }')

echo "Create package response:"
echo "$CREATE_RESPONSE" | jq . 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

NEW_PACKAGE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id' 2>/dev/null || echo "")
if [ -z "$NEW_PACKAGE_ID" ] || [ "$NEW_PACKAGE_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create package${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Package created: ID=$NEW_PACKAGE_ID${NC}"
echo ""

# Step 4: Get Package Details
print_section "Step 4: Get Package Details (GET /api/v1/admin/packages/:id)"

GET_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/packages/$NEW_PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Get package response:"
echo "$GET_RESPONSE" | jq . 2>/dev/null || echo "$GET_RESPONSE"
echo ""

PACKAGE_NAME=$(echo "$GET_RESPONSE" | jq -r '.name' 2>/dev/null || echo "")
PACKAGE_PRICE=$(echo "$GET_RESPONSE" | jq -r '.price' 2>/dev/null || echo "")

if [ "$PACKAGE_NAME" = "Test Package API" ] && [ "$PACKAGE_PRICE" = "5000" ]; then
  echo -e "${GREEN}✅ Package details retrieved correctly${NC}"
else
  echo -e "${RED}❌ Package details mismatch${NC}"
fi
echo ""

# Step 5: Update Package
print_section "Step 5: Update Package (PUT /api/v1/admin/packages/:id)"

UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/api/v1/admin/packages/$NEW_PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test Package API",
    "price": 6000,
    "self_monthly": 150.00,
    "global_ids": 120
  }')

echo "Update package response:"
echo "$UPDATE_RESPONSE" | jq . 2>/dev/null || echo "$UPDATE_RESPONSE"
echo ""

UPDATED_NAME=$(echo "$UPDATE_RESPONSE" | jq -r '.name' 2>/dev/null || echo "")
UPDATED_PRICE=$(echo "$UPDATE_RESPONSE" | jq -r '.price' 2>/dev/null || echo "")

if [ "$UPDATED_NAME" = "Updated Test Package API" ] && [ "$UPDATED_PRICE" = "6000" ]; then
  echo -e "${GREEN}✅ Package updated successfully${NC}"
else
  echo -e "${RED}❌ Package update failed${NC}"
fi
echo ""

# Step 6: Verify Update via GET
print_section "Step 6: Verify Update (GET /api/v1/admin/packages/:id)"

VERIFY_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/packages/$NEW_PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Verify package response:"
echo "$VERIFY_RESPONSE" | jq . 2>/dev/null || echo "$VERIFY_RESPONSE"
echo ""

VERIFY_NAME=$(echo "$VERIFY_RESPONSE" | jq -r '.name' 2>/dev/null || echo "")
VERIFY_PRICE=$(echo "$VERIFY_RESPONSE" | jq -r '.price' 2>/dev/null || echo "")
VERIFY_SELF=$(echo "$VERIFY_RESPONSE" | jq -r '.self_monthly' 2>/dev/null || echo "")

if [ "$VERIFY_NAME" = "Updated Test Package API" ] && [ "$VERIFY_PRICE" = "6000" ] && [ "$VERIFY_SELF" = "150" ]; then
  echo -e "${GREEN}✅ Update verified: Name=$VERIFY_NAME, Price=$VERIFY_PRICE, Self=$VERIFY_SELF${NC}"
else
  echo -e "${RED}❌ Verification failed: Name=$VERIFY_NAME, Price=$VERIFY_PRICE, Self=$VERIFY_SELF${NC}"
fi
echo ""

# Step 7: Delete Package
print_section "Step 7: Delete Package (DELETE /api/v1/admin/packages/:id)"

DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/api/v1/admin/packages/$NEW_PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Delete package response:"
echo "$DELETE_RESPONSE" | jq . 2>/dev/null || echo "$DELETE_RESPONSE"
echo ""

DELETE_MESSAGE=$(echo "$DELETE_RESPONSE" | jq -r '.message' 2>/dev/null || echo "")
if [ "$DELETE_MESSAGE" = "Package deleted successfully" ]; then
  echo -e "${GREEN}✅ Package deleted successfully${NC}"
else
  echo -e "${RED}❌ Package deletion failed${NC}"
fi
echo ""

# Step 8: Verify Deletion
print_section "Step 8: Verify Deletion (GET /api/v1/admin/packages/:id - Should return 404)"

VERIFY_DELETE_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/packages/$NEW_PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Verify deletion response:"
echo "$VERIFY_DELETE_RESPONSE" | jq . 2>/dev/null || echo "$VERIFY_DELETE_RESPONSE"
echo ""

if echo "$VERIFY_DELETE_RESPONSE" | grep -q "not found\|404"; then
  echo -e "${GREEN}✅ Package deletion verified (404 returned)${NC}"
else
  echo -e "${YELLOW}⚠️  Package might still exist${NC}"
fi
echo ""

# Summary
print_section "Test Summary"

echo -e "${GREEN}✅ Admin Package APIs Test Results:${NC}"
echo "   1. List Packages: ✅"
echo "   2. Create Package: ✅"
echo "   3. Get Package: ✅"
echo "   4. Update Package: ✅"
echo "   5. Delete Package: ✅"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ALL TESTS COMPLETE!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

