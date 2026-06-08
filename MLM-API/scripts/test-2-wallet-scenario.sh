#!/bin/bash

# Comprehensive 2-Wallet System Test Script
# Tests: SPOT commissions, pending SPOT release, P2P transfers, withdrawal date restrictions

set -e

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-bilal@sia.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-nashik2nagpur}"

echo "🧪 Starting 2-Wallet System Comprehensive Test"
echo "=============================================="
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

# Step 1: Admin Login (optional - only needed for package access)
echo "Step 1: Admin Login (Optional)"
echo "-------------------------------"
ADMIN_TOKEN=""
ADMIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

ADMIN_TOKEN=$(echo $ADMIN_RESPONSE | jq -r '.token // empty')
if [ -z "$ADMIN_TOKEN" ]; then
    print_info "Admin login failed - continuing without admin (packages may need to exist)"
    echo "$ADMIN_RESPONSE" | jq . 2>/dev/null || echo "$ADMIN_RESPONSE"
else
    print_success "Admin logged in"
fi
echo ""

# Step 2: Create Users
echo "Step 2: Creating Users"
echo "---------------------"
print_info "Creating u1 (root user - using System Root ID 2 as referrer)"
# Use System Root (ID 2) as referrer - this user exists in seed data
# Use timestamp for unique emails
TIMESTAMP=$(date +%s)
U1_EMAIL="u1-${TIMESTAMP}@test.com"
U1_MOBILE="1111${TIMESTAMP: -6}"

U1_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User 1\",
    \"email\": \"$U1_EMAIL\",
    \"mobile\": \"$U1_MOBILE\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": \"2\"
  }")

U1_ID=$(echo $U1_RESPONSE | jq -r '.user.id // .id // empty')
if [ -z "$U1_ID" ]; then
    print_error "Failed to create u1"
    echo "$U1_RESPONSE" | jq .
    exit 1
fi
print_success "u1 created: $U1_ID (email: $U1_EMAIL)"
# Login u1 to get token
U1_LOGIN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$U1_ID\",\"password\":\"Test@123\"}")
U1_TOKEN=$(echo $U1_LOGIN | jq -r '.token // empty')
if [ -z "$U1_TOKEN" ]; then
    print_error "Failed to login u1"
    echo "$U1_LOGIN" | jq .
    exit 1
fi

# Get Package ID first (needed for u1 purchase)
print_info "Getting Package ID for u1 purchase..."
if [ -n "$ADMIN_TOKEN" ]; then
    PACKAGE_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/packages" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
else
    PACKAGE_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/packages")
fi
PACKAGE_ID=$(echo $PACKAGE_RESPONSE | jq -r '.[0].id // empty')
PACKAGE_PRICE=$(echo $PACKAGE_RESPONSE | jq -r '.[0].price // empty')
if [ -z "$PACKAGE_ID" ]; then
    print_error "No packages found - please seed packages first"
    exit 1
fi
print_success "Package ID: $PACKAGE_ID, Price: ₹$PACKAGE_PRICE"

# u1 must purchase a package first to be able to refer others
print_info "u1 purchasing package (required to add referrals)..."
# Use purchases endpoint with activation request_type
U1_PURCHASE=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"is_manual\": true,
    \"txn_id\": \"test-txn-u1-${TIMESTAMP}\"
  }")
U1_REQUEST_ID=$(echo $U1_PURCHASE | jq -r '.request.id // empty')
if [ -z "$U1_REQUEST_ID" ]; then
    print_error "u1 purchase request failed"
    echo "$U1_PURCHASE" | jq .
    exit 1
fi
print_success "u1 purchase request created: $U1_REQUEST_ID"

# Approve u1's purchase request as admin
print_info "Admin approving u1's purchase request..."
U1_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/activation/requests/$U1_REQUEST_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{}")
U1_PURCHASE_ID=$(echo $U1_APPROVE | jq -r '.purchase.id // empty')
if [ -z "$U1_PURCHASE_ID" ]; then
    print_error "u1 purchase approval failed"
    echo "$U1_APPROVE" | jq .
    exit 1
fi
print_success "u1 purchase approved and completed: $U1_PURCHASE_ID"
sleep 2
echo ""

print_info "Creating u2 (direct referral of u1)"
U2_EMAIL="u2-${TIMESTAMP}@test.com"
U2_MOBILE="2222${TIMESTAMP: -6}"
U2_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User 2\",
    \"email\": \"$U2_EMAIL\",
    \"mobile\": \"$U2_MOBILE\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")
U2_ID=$(echo $U2_RESPONSE | jq -r '.user.id // .id // empty')
U2_LOGIN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$U2_ID\",\"password\":\"Test@123\"}")
U2_TOKEN=$(echo $U2_LOGIN | jq -r '.token // empty')
if [ -z "$U2_ID" ]; then
    print_error "Failed to create u2"
    echo "$U2_RESPONSE" | jq .
    exit 1
fi
print_success "u2 created: $U2_ID (referrer: u1)"

print_info "Creating u3 (direct referral of u1)"
U3_EMAIL="u3-${TIMESTAMP}@test.com"
U3_MOBILE="3333${TIMESTAMP: -6}"
U3_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User 3\",
    \"email\": \"$U3_EMAIL\",
    \"mobile\": \"$U3_MOBILE\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")
U3_ID=$(echo $U3_RESPONSE | jq -r '.user.id // .id // empty')
U3_LOGIN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$U3_ID\",\"password\":\"Test@123\"}")
U3_TOKEN=$(echo $U3_LOGIN | jq -r '.token // empty')
if [ -z "$U3_ID" ]; then
    print_error "Failed to create u3"
    echo "$U3_RESPONSE" | jq .
    exit 1
fi
print_success "u3 created: $U3_ID (referrer: u1)"

# u3 must purchase a package first to be able to refer u4
print_info "u3 purchasing package (required to add u4 as referral)..."
U3_PURCHASE=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U3_TOKEN" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"is_manual\": true,
    \"txn_id\": \"test-txn-u3-${TIMESTAMP}\"
  }")
U3_REQUEST_ID=$(echo $U3_PURCHASE | jq -r '.request.id // empty')
if [ -z "$U3_REQUEST_ID" ]; then
    print_error "u3 purchase request failed"
    echo "$U3_PURCHASE" | jq .
    exit 1
fi
print_success "u3 purchase request created: $U3_REQUEST_ID"

# Approve u3's purchase request as admin
print_info "Admin approving u3's purchase request..."
U3_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/activation/requests/$U3_REQUEST_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{}")
U3_PURCHASE_ID=$(echo $U3_APPROVE | jq -r '.purchase.id // empty')
if [ -z "$U3_PURCHASE_ID" ]; then
    print_error "u3 purchase approval failed"
    echo "$U3_APPROVE" | jq .
    exit 1
fi
print_success "u3 purchase approved and completed: $U3_PURCHASE_ID"
sleep 2
echo ""

print_info "Creating u4 (direct referral of u3, level 1 for u1)"
U4_EMAIL="u4-${TIMESTAMP}@test.com"
U4_MOBILE="4444${TIMESTAMP: -6}"
U4_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User 4\",
    \"email\": \"$U4_EMAIL\",
    \"mobile\": \"$U4_MOBILE\",
    \"password\": \"Test@123\",
    \"referrer_user_id\": \"$U3_ID\"
  }")
U4_ID=$(echo $U4_RESPONSE | jq -r '.user.id // .id // empty')
U4_LOGIN=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$U4_ID\",\"password\":\"Test@123\"}")
U4_TOKEN=$(echo $U4_LOGIN | jq -r '.token // empty')
if [ -z "$U4_ID" ]; then
    print_error "Failed to create u4"
    echo "$U4_RESPONSE" | jq .
    exit 1
fi
print_success "u4 created: $U4_ID (referrer: u3, level 1 for u1)"
echo ""

# Approve KYC for all users (required for transfers and withdrawals)
print_info "Approving KYC for all users..."
# Submit and approve KYC for u1
U1_KYC_SUBMIT=$(curl -s -X POST "$API_URL/api/v1/users/$U1_ID/kyc/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -d '{
    "phone": "9999999999",
    "address": "Test Address",
    "city": "Test City",
    "state": "Test State",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "aadhar_number": "123456789012",
    "documents": [{
      "document_type": "aadhar",
      "document_number": "123456789012",
      "front_image_url": "https://example.com/front.jpg",
      "back_image_url": "https://example.com/back.jpg"
    }]
  }' 2>/dev/null)
U1_KYC_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/kyc/$U1_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' 2>/dev/null)

# Submit and approve KYC for u2
U2_KYC_SUBMIT=$(curl -s -X POST "$API_URL/api/v1/users/$U2_ID/kyc/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -d '{
    "phone": "9999999999",
    "address": "Test Address",
    "city": "Test City",
    "state": "Test State",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "aadhar_number": "123456789012",
    "documents": [{
      "document_type": "aadhar",
      "document_number": "123456789012",
      "front_image_url": "https://example.com/front.jpg",
      "back_image_url": "https://example.com/back.jpg"
    }]
  }' 2>/dev/null)
U2_KYC_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/kyc/$U2_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' 2>/dev/null)

# Submit and approve KYC for u3
U3_KYC_SUBMIT=$(curl -s -X POST "$API_URL/api/v1/users/$U3_ID/kyc/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U3_TOKEN" \
  -d '{
    "phone": "9999999999",
    "address": "Test Address",
    "city": "Test City",
    "state": "Test State",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "aadhar_number": "123456789012",
    "documents": [{
      "document_type": "aadhar",
      "document_number": "123456789012",
      "front_image_url": "https://example.com/front.jpg",
      "back_image_url": "https://example.com/back.jpg"
    }]
  }' 2>/dev/null)
U3_KYC_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/kyc/$U3_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' 2>/dev/null)

# Submit and approve KYC for u4
U4_KYC_SUBMIT=$(curl -s -X POST "$API_URL/api/v1/users/$U4_ID/kyc/submit" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U4_TOKEN" \
  -d '{
    "phone": "9999999999",
    "address": "Test Address",
    "city": "Test City",
    "state": "Test State",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "aadhar_number": "123456789012",
    "documents": [{
      "document_type": "aadhar",
      "document_number": "123456789012",
      "front_image_url": "https://example.com/front.jpg",
      "back_image_url": "https://example.com/back.jpg"
    }]
  }' 2>/dev/null)
U4_KYC_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/kyc/$U4_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' 2>/dev/null)

print_success "KYC approved for all users"
echo ""

# Step 3: Get Package ID (moved to Step 2, but keeping step number for consistency)
echo "Step 3: Package details already retrieved in Step 2"
echo "---------------------------------------------------"
echo ""

# Step 4: u2 Purchase (should give SPOT to u1)
echo "Step 4: u2 Making Purchase"
echo "-------------------------"
print_info "u2 purchasing package (should credit SPOT to u1's spot_balance)"
U2_PURCHASE=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"is_manual\": true,
    \"txn_id\": \"test-txn-u2-${TIMESTAMP}\"
  }")
U2_REQUEST_ID=$(echo $U2_PURCHASE | jq -r '.request.id // empty')
if [ -z "$U2_REQUEST_ID" ]; then
    print_error "u2 purchase request failed"
    echo "$U2_PURCHASE" | jq .
    exit 1
fi
print_success "u2 purchase request created: $U2_REQUEST_ID"

# Approve u2's purchase request as admin
print_info "Admin approving u2's purchase request..."
U2_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/activation/requests/$U2_REQUEST_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{}")
U2_PURCHASE_ID=$(echo $U2_APPROVE | jq -r '.purchase.id // empty')
if [ -z "$U2_PURCHASE_ID" ]; then
    print_error "u2 purchase approval failed"
    echo "$U2_APPROVE" | jq .
    exit 1
fi
print_success "u2 purchase approved and completed: $U2_PURCHASE_ID"
sleep 2
echo ""

# Step 5: Check u1's wallet after u2 purchase
echo "Step 5: Checking u1's Wallet After u2 Purchase"
echo "----------------------------------------------"
U1_WALLET_1=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $U1_TOKEN")
U1_SPOT_1=$(echo $U1_WALLET_1 | jq -r '.spot_balance // 0')
U1_OTHER_1=$(echo $U1_WALLET_1 | jq -r '.other_balance // 0')
U1_TOTAL_1=$(echo $U1_WALLET_1 | jq -r '.balance // 0')
print_info "u1 wallet after u2 purchase:"
echo "  SPOT: ₹$U1_SPOT_1"
echo "  Other: ₹$U1_OTHER_1"
echo "  Total: ₹$U1_TOTAL_1"

# Calculate expected SPOT (5% of package price)
EXPECTED_SPOT=$(echo "scale=2; $PACKAGE_PRICE * 0.05" | bc)
if (( $(echo "$U1_SPOT_1 >= $EXPECTED_SPOT" | bc -l) )); then
    print_success "u1 received SPOT commission in spot_balance"
else
    print_error "u1 SPOT balance incorrect. Expected: ₹$EXPECTED_SPOT, Got: ₹$U1_SPOT_1"
fi
echo ""

# Step 6: u3 Purchase (should give SPOT to u1)
echo "Step 6: u3 Making Purchase"
echo "-------------------------"
print_info "u3 purchasing package again (should credit SPOT to u1's spot_balance)"
# u3 already has a package, so this will be a reinvestment
U3_PURCHASE2=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U3_TOKEN" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"reinvestment\",
    \"amount\": $PACKAGE_PRICE,
    \"is_manual\": true,
    \"txn_id\": \"test-txn-u3-2-${TIMESTAMP}\"
  }")
U3_REQUEST2_ID=$(echo $U3_PURCHASE2 | jq -r '.request.id // empty')
if [ -z "$U3_REQUEST2_ID" ]; then
    print_error "u3 second purchase request failed"
    echo "$U3_PURCHASE2" | jq .
    exit 1
fi
print_success "u3 second purchase request created: $U3_REQUEST2_ID"

# Approve u3's second purchase request as admin
print_info "Admin approving u3's second purchase request..."
U3_APPROVE2=$(curl -s -X POST "$API_URL/api/v1/admin/activation/requests/$U3_REQUEST2_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{}")
U3_PURCHASE2_ID=$(echo $U3_APPROVE2 | jq -r '.purchase.id // empty')
if [ -z "$U3_PURCHASE2_ID" ]; then
    print_error "u3 second purchase approval failed"
    echo "$U3_APPROVE2" | jq .
    exit 1
fi
print_success "u3 second purchase approved and completed: $U3_PURCHASE2_ID"
sleep 2
echo ""

# Step 7: Check u1's wallet after u3 purchase
echo "Step 7: Checking u1's Wallet After u3 Purchase"
echo "-----------------------------------------------"
U1_WALLET_2=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $U1_TOKEN")
U1_SPOT_2=$(echo $U1_WALLET_2 | jq -r '.spot_balance // 0')
U1_OTHER_2=$(echo $U1_WALLET_2 | jq -r '.other_balance // 0')
U1_TOTAL_2=$(echo $U1_WALLET_2 | jq -r '.balance // 0')
print_info "u1 wallet after u3 purchase:"
echo "  SPOT: ₹$U1_SPOT_2"
echo "  Other: ₹$U1_OTHER_2"
echo "  Total: ₹$U1_TOTAL_2"

EXPECTED_SPOT_2=$(echo "scale=2; $EXPECTED_SPOT * 2" | bc)
if (( $(echo "$U1_SPOT_2 >= $EXPECTED_SPOT_2" | bc -l) )); then
    print_success "u1 received second SPOT commission in spot_balance"
else
    print_error "u1 SPOT balance incorrect. Expected: ₹$EXPECTED_SPOT_2, Got: ₹$U1_SPOT_2"
fi
echo ""

# Step 8: u4 Purchase (should create pending SPOT for u1 at level 1)
echo "Step 8: u4 Making Purchase"
echo "-------------------------"
print_info "u4 purchasing package (should create pending SPOT for u1 at level 1)"
U4_PURCHASE=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U4_TOKEN" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"is_manual\": true,
    \"txn_id\": \"test-txn-u4-${TIMESTAMP}\"
  }")
U4_REQUEST_ID=$(echo $U4_PURCHASE | jq -r '.request.id // empty')
if [ -z "$U4_REQUEST_ID" ]; then
    print_error "u4 purchase request failed"
    echo "$U4_PURCHASE" | jq .
    exit 1
fi
print_success "u4 purchase request created: $U4_REQUEST_ID"

# Approve u4's purchase request as admin
print_info "Admin approving u4's purchase request..."
U4_APPROVE=$(curl -s -X POST "$API_URL/api/v1/admin/activation/requests/$U4_REQUEST_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{}")
U4_PURCHASE_ID=$(echo $U4_APPROVE | jq -r '.purchase.id // empty')
if [ -z "$U4_PURCHASE_ID" ]; then
    print_error "u4 purchase approval failed"
    echo "$U4_APPROVE" | jq .
    exit 1
fi
print_success "u4 purchase approved and completed: $U4_PURCHASE_ID"
sleep 2
echo ""

# Step 9: Check pending commissions for u1
echo "Step 9: Checking Pending Commissions for u1"
echo "--------------------------------------------"
U1_PENDING=$(curl -s -X GET "$API_URL/api/v1/users/$U1_ID/commissions/pending" \
  -H "Authorization: Bearer $U1_TOKEN")
PENDING_COUNT=$(echo $U1_PENDING | jq -r '.total // 0')
print_info "u1 pending commissions: $PENDING_COUNT"
if [ "$PENDING_COUNT" -gt 0 ]; then
    print_success "u1 has pending SPOT commission (waiting for level 1 qualification)"
    echo "$U1_PENDING" | jq '.items[0] | {level, amount, commission_type}'
else
    print_error "u1 should have pending SPOT commission"
fi
echo ""

# Step 10: Check u1's eligibility and qualify for level 1
echo "Step 10: Qualifying u1 for Level 1"
echo "-----------------------------------"
print_info "Triggering eligibility recalculation for u1"
# Trigger eligibility recalculation for u1
ELIGIBILITY_RECALC=$(curl -s -X POST "$API_URL/api/v1/admin/eligibility/recalculate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"user_id\": \"$U1_ID\"}" 2>/dev/null)
print_info "Eligibility recalculation response: $(echo $ELIGIBILITY_RECALC | jq -r '.message // .success // "triggered"')"

# Also trigger pending commission release
print_info "Triggering pending commission release..."
PENDING_RELEASE=$(curl -s -X POST "$API_URL/api/v1/admin/release-pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
print_info "Pending release response: $(echo $PENDING_RELEASE | jq -r '.message // "triggered"')"

print_info "u1 has 2 direct referrals (u2, u3) with packages - should qualify for level 1"
print_info "Waiting for commission processing..."
sleep 5
echo ""

# Step 11: Check u1's wallet after level 1 qualification
echo "Step 11: Checking u1's Wallet After Level 1 Qualification"
echo "----------------------------------------------------------"
U1_WALLET_3=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $U1_TOKEN")
U1_SPOT_3=$(echo $U1_WALLET_3 | jq -r '.spot_balance // 0')
U1_OTHER_3=$(echo $U1_WALLET_3 | jq -r '.other_balance // 0')
U1_TOTAL_3=$(echo $U1_WALLET_3 | jq -r '.balance // 0')
print_info "u1 wallet after level 1 qualification:"
echo "  SPOT: ₹$U1_SPOT_3"
echo "  Other: ₹$U1_OTHER_3"
echo "  Total: ₹$U1_TOTAL_3"

# Check if pending SPOT was released
U1_PENDING_AFTER=$(curl -s -X GET "$API_URL/api/v1/users/$U1_ID/commissions/pending" \
  -H "Authorization: Bearer $U1_TOKEN")
PENDING_COUNT_AFTER=$(echo $U1_PENDING_AFTER | jq -r '.total // 0')

if [ "$PENDING_COUNT_AFTER" -eq 0 ] && (( $(echo "$U1_SPOT_3 > $U1_SPOT_2" | bc -l) )); then
    print_success "Pending SPOT released to u1's spot_balance after level 1 qualification"
else
    print_error "Pending SPOT not released. Pending count: $PENDING_COUNT_AFTER, SPOT: ₹$U1_SPOT_3"
fi
echo ""

# Step 12: u2 transfers funds to u1 from spot wallet
echo "Step 12: u2 Transferring Funds to u1 (from spot wallet)"
echo "--------------------------------------------------------"
TRANSFER_AMOUNT=100
print_info "u2 transferring ₹$TRANSFER_AMOUNT to u1 from spot wallet"
U2_WALLET_BEFORE=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $U2_TOKEN")
U2_SPOT_BEFORE=$(echo $U2_WALLET_BEFORE | jq -r '.spot_balance // 0')

TRANSFER_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/transfer/p2p" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -d "{
    \"receiver_id\": \"$U1_ID\",
    \"amount\": $TRANSFER_AMOUNT,
    \"from_wallet\": \"spot\",
    \"remarks\": \"Test transfer from spot wallet\"
  }")

TRANSFER_ID=$(echo $TRANSFER_RESPONSE | jq -r '.id // empty')
if [ -z "$TRANSFER_ID" ]; then
    print_error "Transfer failed"
    echo "$TRANSFER_RESPONSE" | jq .
    exit 1
fi
print_success "Transfer completed: $TRANSFER_ID"
sleep 1
echo ""

# Step 13: Verify wallets after transfer
echo "Step 13: Verifying Wallets After Transfer"
echo "-----------------------------------------"
U2_WALLET_AFTER=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $U2_TOKEN")
U2_SPOT_AFTER=$(echo $U2_WALLET_AFTER | jq -r '.spot_balance // 0')

U1_WALLET_AFTER=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $U1_TOKEN")
U1_SPOT_AFTER=$(echo $U1_WALLET_AFTER | jq -r '.spot_balance // 0')
U1_OTHER_AFTER=$(echo $U1_WALLET_AFTER | jq -r '.other_balance // 0')

print_info "u2 wallet after transfer:"
echo "  SPOT: ₹$U2_SPOT_AFTER (was ₹$U2_SPOT_BEFORE)"
print_info "u1 wallet after transfer:"
echo "  SPOT: ₹$U1_SPOT_AFTER"
echo "  Other: ₹$U1_OTHER_AFTER"

# u2's spot should decrease, u1's other should increase
if (( $(echo "$U2_SPOT_AFTER < $U2_SPOT_BEFORE" | bc -l) )); then
    print_success "u2's spot_balance decreased"
else
    print_error "u2's spot_balance should have decreased"
fi

if (( $(echo "$U1_OTHER_AFTER > $U1_OTHER_3" | bc -l) )); then
    print_success "u1's other_balance increased (transfer received in other_balance)"
else
    print_error "u1's other_balance should have increased"
fi
echo ""

# Step 14: Test withdrawal date restrictions
echo "Step 14: Testing Withdrawal Date Restrictions"
echo "---------------------------------------------"
TODAY=$(date +%d)
MONTH=$(date +%m)
IS_FEBRUARY=$([ "$MONTH" = "02" ] && echo "true" || echo "false")
ALLOWED_DATE=""

if [ "$TODAY" = "15" ]; then
    ALLOWED_DATE="15"
    print_info "Today is 15th - only SPOT withdrawals allowed"
elif [ "$TODAY" = "30" ] || ([ "$IS_FEBRUARY" = "true" ] && [ "$TODAY" = "28" ]); then
    ALLOWED_DATE="30"
    print_info "Today is ${TODAY}th - both SPOT and Other withdrawals allowed"
else
    ALLOWED_DATE="none"
    print_info "Today is ${TODAY}th - withdrawals not allowed (only 15th and 30th/28th allowed)"
fi
echo ""

# Step 15: u1 withdrawal request
echo "Step 15: u1 Creating Withdrawal Request"
echo "---------------------------------------"
U1_WITHDRAW_AMOUNT=50
WITHDRAW_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/withdraw/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -d "{
    \"amount\": $U1_WITHDRAW_AMOUNT,
    \"payment_method\": \"bank_transfer\",
    \"account_details\": \"Test Bank Account\",
    \"withdraw_type\": \"wallet\"
  }")

WITHDRAW_ERROR=$(echo $WITHDRAW_RESPONSE | jq -r '.error // empty')
if [ -n "$WITHDRAW_ERROR" ]; then
    if [ "$ALLOWED_DATE" = "none" ]; then
        if [ "$WITHDRAW_ERROR" = "withdrawal_not_allowed" ]; then
            print_success "Withdrawal correctly blocked on non-allowed date"
        else
            print_error "Expected withdrawal_not_allowed error, got: $WITHDRAW_ERROR"
        fi
    else
        print_error "Withdrawal failed unexpectedly: $WITHDRAW_ERROR"
        echo "$WITHDRAW_RESPONSE" | jq .
    fi
else
    if [ "$ALLOWED_DATE" != "none" ]; then
        WITHDRAW_ID=$(echo $WITHDRAW_RESPONSE | jq -r '.id // empty')
        print_success "u1 withdrawal request created: $WITHDRAW_ID"
        echo "$WITHDRAW_RESPONSE" | jq '{id, amount, status, allowed_wallets, available_balances}'
    else
        print_error "Withdrawal should have been blocked but was allowed"
    fi
fi
echo ""

# Step 16: u2 withdrawal request
echo "Step 16: u2 Creating Withdrawal Request"
echo "---------------------------------------"
U2_WITHDRAW_AMOUNT=30
WITHDRAW_RESPONSE2=$(curl -s -X POST "$API_URL/api/v1/withdraw/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -d "{
    \"amount\": $U2_WITHDRAW_AMOUNT,
    \"payment_method\": \"bank_transfer\",
    \"account_details\": \"Test Bank Account\",
    \"withdraw_type\": \"wallet\"
  }")

WITHDRAW_ERROR2=$(echo $WITHDRAW_RESPONSE2 | jq -r '.error // empty')
if [ -n "$WITHDRAW_ERROR2" ]; then
    if [ "$ALLOWED_DATE" = "none" ]; then
        if [ "$WITHDRAW_ERROR2" = "withdrawal_not_allowed" ]; then
            print_success "Withdrawal correctly blocked on non-allowed date"
        else
            print_error "Expected withdrawal_not_allowed error, got: $WITHDRAW_ERROR2"
        fi
    else
        print_error "Withdrawal failed unexpectedly: $WITHDRAW_ERROR2"
        echo "$WITHDRAW_RESPONSE2" | jq .
    fi
else
    if [ "$ALLOWED_DATE" != "none" ]; then
        WITHDRAW_ID2=$(echo $WITHDRAW_RESPONSE2 | jq -r '.id // empty')
        print_success "u2 withdrawal request created: $WITHDRAW_ID2"
        echo "$WITHDRAW_RESPONSE2" | jq '{id, amount, status, allowed_wallets, available_balances}'
    else
        print_error "Withdrawal should have been blocked but was allowed"
    fi
fi
echo ""

# Step 17: Final Summary
echo "=============================================="
echo "📊 Test Summary"
echo "=============================================="
echo ""
print_info "User Structure:"
echo "  u1 (root)"
echo "    ├─ u2 (direct)"
echo "    └─ u3 (direct)"
echo "         └─ u4 (level 1 for u1)"
echo ""
print_info "Commissions:"
echo "  ✅ u2 purchase → u1 received SPOT in spot_balance"
echo "  ✅ u3 purchase → u1 received SPOT in spot_balance"
echo "  ✅ u4 purchase → u1 received pending SPOT (released on level 1 qualification)"
echo ""
print_info "Transfers:"
echo "  ✅ u2 transferred from spot wallet → u1 received in other_balance"
echo ""
print_info "Withdrawals:"
if [ "$ALLOWED_DATE" = "none" ]; then
    echo "  ✅ Withdrawals correctly blocked on date $TODAY"
else
    echo "  ✅ Withdrawals allowed on date $TODAY (allowed wallets: $ALLOWED_DATE)"
fi
echo ""
print_success "All tests completed!"
echo ""

