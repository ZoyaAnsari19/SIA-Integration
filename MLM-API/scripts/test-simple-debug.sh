#!/bin/bash

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "================================================================"
echo "SIMPLE DEBUG TEST - One Complete User Flow"
echo "================================================================"

# Admin Login
echo "Step 1: Admin Login"
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@secureinfiniteassociation.com", "password": "admin123"}' | jq -r '.token')
echo "Admin Token: ${ADMIN_TOKEN:0:30}..."

# Register User
echo ""
echo "Step 2: Register User"
USER_EMAIL="test-$TS@test.com"
REG_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test User\",
    \"email\": \"$USER_EMAIL\",
    \"mobile\": \"5555555555\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"2\"
  }")

echo "Registration Response:"
echo $REG_RESPONSE | jq '.'

USER_ID=$(echo $REG_RESPONSE | jq -r '.id')
USER_DISPLAY=$(echo $REG_RESPONSE | jq -r '.display_id')

echo ""
echo "Extracted - User ID: $USER_ID, Display: $USER_DISPLAY"

# User Login
echo ""
echo "Step 3: User Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_EMAIL\", \"password\": \"password123\"}")

echo "Login Response:"
echo $LOGIN_RESPONSE | jq '.'

USER_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
echo "User Token: ${USER_TOKEN:0:30}..."

# Submit KYC
echo ""
echo "Step 4: Submit KYC"
KYC_RESPONSE=$(curl -s -X POST "$BASE_URL/users/$USER_ID/kyc/submit" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pan_number": "ZZZZZ9999Z",
    "aadhar_number": "111222333444",
    "bank_account_no": "1234567890",
    "bank_ifsc": "SBIN0001234",
    "bank_name": "SBI",
    "documents": [{"document_type": "aadhar", "document_number": "111222333444", "front_image_url": "https://example.com/f.jpg", "back_image_url": "https://example.com/b.jpg"}]
  }')

echo "KYC Response:"
echo $KYC_RESPONSE | jq '.'

# Admin Approve KYC
echo ""
echo "Step 5: Admin Approve KYC (via DB update)"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "UPDATE users SET kyc_status = 'approved' WHERE id = $USER_ID;" 2>&1 > /dev/null
echo "✅ KYC Approved"

# Manual Deposit Request
echo ""
echo "Step 6: Create Manual Deposit Request"
DEP_RESPONSE=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "package_id": 1,
    "amount": 2500,
    "request_type": "activation",
    "utr_number": "UTR'$TS'",
    "payment_proof_url": "https://example.com/proof.jpg",
    "payment_type": "bank_transfer",
    "remarks": "Test purchase"
  }')

echo "Deposit Request Response:"
echo $DEP_RESPONSE | jq '.'

REQ_ID=$(echo $DEP_RESPONSE | jq -r '.id')
echo "Request ID: $REQ_ID"

# Admin Approve Purchase
if [ "$REQ_ID" != "null" ] && [ -n "$REQ_ID" ]; then
  echo ""
  echo "Step 7: Admin Approve Purchase Request"
  APPROVE_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$REQ_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{}')
  
  echo "Approval Response:"
  echo $APPROVE_RESPONSE | jq '.'
  
  PURCHASE_ID=$(echo $APPROVE_RESPONSE | jq -r '.purchase.id')
  echo "Purchase ID: $PURCHASE_ID"
  
  # Verify in DB
  echo ""
  echo "Step 8: Database Verification"
  docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
  SELECT id, user_id, package_id, amount, status, is_manual, purchase_type 
  FROM purchases 
  WHERE id = $PURCHASE_ID;
  " 2>&1
  
  echo ""
  echo "Check Commissions:"
  docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
  SELECT receiver_user_id, commission_type, amount 
  FROM ledger_entries 
  WHERE purchase_id = $PURCHASE_ID;
  " 2>&1
else
  echo "❌ Manual deposit request failed"
fi

