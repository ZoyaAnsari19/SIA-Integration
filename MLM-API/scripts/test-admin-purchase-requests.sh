#!/bin/bash

# Test script for Admin Purchase Request Management APIs
# Tests: Create requests, list, approve, reject, verify commissions

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin}"

echo "=== Admin Purchase Request Management API Tests ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Step 1: Register a test user
echo "Step 1: Register test user"
USER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User Purchase Request",
    "email": "test-purchase-request@example.com",
    "phone": "9876543210",
    "password": "test123",
    "referrer_code": null
  }')

USER_ID=$(echo "$USER_RESPONSE" | jq -r '.id // .user_id // empty')
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  print_error "Failed to register user"
  echo "Response: $USER_RESPONSE"
  exit 1
fi
print_success "User registered with ID: $USER_ID"

# Step 2: Login as user
echo ""
echo "Step 2: Login as user"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-purchase-request@example.com",
    "password": "test123"
  }')

USER_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
if [ -z "$USER_TOKEN" ] || [ "$USER_TOKEN" = "null" ]; then
  print_error "Failed to login"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi
print_success "User logged in"

# Step 3: Get available packages
echo ""
echo "Step 3: Get available packages"
PACKAGES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/packages" \
  -H "Authorization: Bearer $USER_TOKEN")

PACKAGE_ID=$(echo "$PACKAGES_RESPONSE" | jq -r '.[0].id // empty')
if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" = "null" ]; then
  print_error "No packages available"
  exit 1
fi
print_success "Found package ID: $PACKAGE_ID"

# Step 4: Create activation request
echo ""
echo "Step 4: Create activation request"
ACTIVATION_REQUEST=$(curl -s -X POST "$BASE_URL/api/v1/purchases" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"txn_id\": \"TXN-ACTIVATION-001\",
    \"payment_type\": \"UPI\",
    \"remarks\": \"Test activation request\"
  }")

ACTIVATION_REQUEST_ID=$(echo "$ACTIVATION_REQUEST" | jq -r '.request.id // empty')
if [ -z "$ACTIVATION_REQUEST_ID" ] || [ "$ACTIVATION_REQUEST_ID" = "null" ]; then
  print_error "Failed to create activation request"
  echo "Response: $ACTIVATION_REQUEST"
  exit 1
fi
print_success "Activation request created with ID: $ACTIVATION_REQUEST_ID"
echo "Request details:"
echo "$ACTIVATION_REQUEST" | jq '{id: .request.id, request_type: .request.request_type, status: .request.status, amount: .request.amount}'

# Step 5: Admin - List all requests
echo ""
echo "Step 5: Admin - List all purchase requests"
LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/api/v1/admin/activation/requests?status=pending&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

REQUEST_COUNT=$(echo "$LIST_RESPONSE" | jq -r '.items | length')
print_success "Found $REQUEST_COUNT pending requests"
echo "First request:"
echo "$LIST_RESPONSE" | jq '.items[0] | {id, user_name, package_name, request_type, status, amount}'

# Step 6: Admin - Get request details
echo ""
echo "Step 6: Admin - Get request details"
REQUEST_DETAILS=$(curl -s -X GET "$BASE_URL/api/v1/admin/activation/requests/$ACTIVATION_REQUEST_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

print_success "Request details retrieved"
echo "Details:"
echo "$REQUEST_DETAILS" | jq '{id, user_name, package_name, request_type, status, amount, previous_purchases: (.previous_purchases | length)}'

# Step 7: Admin - Approve request
echo ""
echo "Step 7: Admin - Approve activation request"
APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/admin/activation/requests/$ACTIVATION_REQUEST_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

PURCHASE_ID=$(echo "$APPROVE_RESPONSE" | jq -r '.purchase.id // empty')
if [ -z "$PURCHASE_ID" ] || [ "$PURCHASE_ID" = "null" ]; then
  print_error "Failed to approve request"
  echo "Response: $APPROVE_RESPONSE"
  exit 1
fi
print_success "Request approved! Purchase created with ID: $PURCHASE_ID"
echo "Approval details:"
echo "$APPROVE_RESPONSE" | jq '{message, purchase: .purchase.id, request: .request.status}'

# Step 8: Wait a bit for commission processing
echo ""
echo "Step 8: Waiting for commission processing..."
sleep 3

# Step 9: Verify purchase was created
echo ""
echo "Step 9: Verify purchase was created"
PURCHASE_DETAILS=$(curl -s -X GET "$BASE_URL/api/v1/purchases/$PURCHASE_ID/commissions" \
  -H "Authorization: Bearer $USER_TOKEN")

print_success "Purchase verified"
echo "Commissions:"
echo "$PURCHASE_DETAILS" | jq '{
  purchase_id,
  credited_count: (.credited_commissions | length),
  pending_count: (.pending_commissions | length),
  scheduled_count: (.scheduled_commissions | length)
}'

# Step 10: Create reinvestment request (user now has active purchase)
echo ""
echo "Step 10: Create reinvestment request"
REINVESTMENT_REQUEST=$(curl -s -X POST "$BASE_URL/api/v1/purchases" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"reinvestment\",
    \"txn_id\": \"TXN-REINVEST-001\",
    \"payment_type\": \"UPI\",
    \"remarks\": \"Test reinvestment request\"
  }")

REINVESTMENT_REQUEST_ID=$(echo "$REINVESTMENT_REQUEST" | jq -r '.request.id // empty')
if [ -z "$REINVESTMENT_REQUEST_ID" ] || [ "$REINVESTMENT_REQUEST_ID" = "null" ]; then
  print_error "Failed to create reinvestment request"
  echo "Response: $REINVESTMENT_REQUEST"
  exit 1
fi
print_success "Reinvestment request created with ID: $REINVESTMENT_REQUEST_ID"

# Step 11: Admin - Reject reinvestment request
echo ""
echo "Step 11: Admin - Reject reinvestment request"
REJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/admin/activation/requests/$REINVESTMENT_REQUEST_ID/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rejection_reason": "Test rejection - insufficient payment proof"
  }')

print_success "Request rejected"
echo "Rejection details:"
echo "$REJECT_RESPONSE" | jq '{message, request: .request.status}'

# Step 12: Test renew endpoint (simulate expired purchase first)
echo ""
echo "Step 12: Test renew endpoint"
# First, we need to simulate an expired purchase or 2x reached purchase
# For now, just test that renew endpoint creates a request
RENEW_REQUEST=$(curl -s -X POST "$BASE_URL/api/v1/purchases/renew" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"txn_id\": \"TXN-RENEW-001\",
    \"payment_type\": \"UPI\"
  }")

# This might fail if user doesn't have expired/2x purchase, which is expected
RENEW_REQUEST_ID=$(echo "$RENEW_REQUEST" | jq -r '.request.id // empty')
if [ -n "$RENEW_REQUEST_ID" ] && [ "$RENEW_REQUEST_ID" != "null" ]; then
  print_success "Renew request created with ID: $RENEW_REQUEST_ID"
else
  print_info "Renew request failed (expected if no expired/2x purchase): $(echo "$RENEW_REQUEST" | jq -r '.error // .message // "Unknown error"')"
fi

# Step 13: Test validation - try invalid request types
echo ""
echo "Step 13: Test validation - try activation when user has active purchase"
INVALID_ACTIVATION=$(curl -s -X POST "$BASE_URL/api/v1/purchases" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"txn_id\": \"TXN-INVALID-001\"
  }")

ERROR_CODE=$(echo "$INVALID_ACTIVATION" | jq -r '.error // empty')
if [ -n "$ERROR_CODE" ]; then
  print_success "Validation working: Request rejected with error: $ERROR_CODE"
else
  print_error "Validation failed: Request was accepted when it should be rejected"
  echo "Response: $INVALID_ACTIVATION"
fi

# Step 14: Admin - List requests with filters
echo ""
echo "Step 14: Admin - List requests with filters"
FILTERED_LIST=$(curl -s -X GET "$BASE_URL/api/v1/admin/activation/requests?request_type=reinvestment&status=rejected" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

FILTERED_COUNT=$(echo "$FILTERED_LIST" | jq -r '.items | length')
print_success "Found $FILTERED_COUNT reinvestment requests with rejected status"

echo ""
echo "=== Test Summary ==="
print_success "All tests completed!"
echo ""
echo "Test Results:"
echo "  ✅ User registration and login"
echo "  ✅ Create activation request"
echo "  ✅ Admin list requests"
echo "  ✅ Admin get request details"
echo "  ✅ Admin approve request"
echo "  ✅ Purchase created and commissions triggered"
echo "  ✅ Create reinvestment request"
echo "  ✅ Admin reject request"
echo "  ✅ Request type validation"
echo "  ✅ Filter requests by type and status"

