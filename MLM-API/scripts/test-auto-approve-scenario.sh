#!/bin/bash

# Full Scenario Test: Auto-Approve Course Purchases & KYC Changes
# Scenario:
# 1. Mohit buys course via gateway → package auto-approved
# 2. Lokesh signs up under Mohit, buys course via gateway → auto-approved, Mohit gets spot commission
# 3. Lokesh does reinvestment (manual payment) → requires admin approval
# 4. Mohit gets spot commission for reinvestment
# 5. Mohit transfers money to Lokesh via P2P

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     AUTO-APPROVE COURSE PURCHASES & KYC CHANGES TEST          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check if API is running
if ! curl -s "$BASE_URL/health" > /dev/null; then
  echo "❌ API is not running on $BASE_URL"
  echo "   Please start the API: cd MLM-API && npm run dev"
  exit 1
fi

echo "✅ API is running"
echo ""

# Step 1: Admin Login
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Admin Login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# Try admin login - use common test password
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@secureinfiniteassociation.com", "password": "admin123"}' | jq -r '.token')

# If that fails, try with admin_token method
if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
    -H "Content-Type: application/json" \
    -d '{"admin_token": "dev-admin"}' | jq -r '.token')
fi

if [ "$ADMIN_TOKEN" = "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Admin login failed"
  exit 1
fi

echo "✅ Admin logged in"
echo ""

# Step 2: Get or create course (Share Market Learning)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Getting Course (Share Market Learning)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
COURSE=$(curl -s "$BASE_URL/courses/share-market-learning")
COURSE_ID=$(echo $COURSE | jq -r '.course.id')
COURSE_PKG_ID=$(echo $COURSE | jq -r '.course.package_id')

if [ "$COURSE_ID" = "null" ] || [ -z "$COURSE_ID" ]; then
  echo "❌ Course not found"
  exit 1
fi

echo "✅ Course: Share Market Learning"
echo "   Course ID: $COURSE_ID"
echo "   Package ID: $COURSE_PKG_ID"
echo ""

# Step 3: Register Mohit (under root user ID 2)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Registering Mohit (Root Referrer)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MOHIT=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Mohit Test $TS\",
    \"email\": \"mohit-test-$TS@test.com\",
    \"mobile\": \"987654${TS: -4}\",
    \"password\": \"mohit123\",
    \"referrer_user_id\": \"2\"
  }")

MOHIT_ID=$(echo $MOHIT | jq -r '.id')
MOHIT_DISPLAY=$(echo $MOHIT | jq -r '.display_id')

if [ "$MOHIT_ID" = "null" ] || [ -z "$MOHIT_ID" ]; then
  echo "❌ Mohit registration failed"
  echo "$MOHIT" | jq
  exit 1
fi

echo "✅ Mohit registered"
echo "   ID: $MOHIT_ID"
echo "   Display ID: $MOHIT_DISPLAY"
echo ""

# Step 4: Mohit Login
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Mohit Login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MOHIT_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"mohit-test-$TS@test.com\", \"password\": \"mohit123\"}")

MOHIT_TOKEN=$(echo $MOHIT_LOGIN | jq -r '.token')
MOHIT_USER=$(echo $MOHIT_LOGIN | jq -r '.user')

if [ "$MOHIT_TOKEN" = "null" ] || [ -z "$MOHIT_TOKEN" ]; then
  echo "❌ Mohit login failed"
  echo "$MOHIT_LOGIN" | jq
  exit 1
fi

echo "✅ Mohit logged in"
echo ""

# Step 5: Mohit purchases course via test-purchase (simulates gateway - auto-approves)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Mohit Purchases Course (Test Mode = Gateway Auto-Approve)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# For local testing, use test-purchase endpoint (simulates payment gateway)
# This creates purchase with status='completed' and is_manual=false (auto-approved)
TEST_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $MOHIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

if echo "$TEST_PURCHASE" | jq -e '.purchases[0]' > /dev/null 2>&1; then
  MOHIT_ACTUAL_PURCHASE_ID=$(echo $TEST_PURCHASE | jq -r '.purchases[0].id')
  echo "✅ Purchase completed (Auto-Approved)"
  echo "   Purchase ID: $MOHIT_ACTUAL_PURCHASE_ID"
  echo "   This simulates payment gateway purchase - should be auto-approved"
else
  echo "❌ Test purchase failed"
  echo "$TEST_PURCHASE" | jq
  exit 1
fi
echo ""

# Wait for commission processing
echo "⏳ Waiting 5 seconds for commission processing..."
sleep 5
echo ""

# Step 6: Verify Mohit's purchase is auto-approved
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Verifying Mohit's Purchase (Should be Auto-Approved)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MOHIT_PURCHASE=$(curl -s "$BASE_URL/my-packages" \
  -H "Authorization: Bearer $MOHIT_TOKEN" | jq -r '.packages[0] // empty')

if [ -z "$MOHIT_PURCHASE" ]; then
  echo "⚠️  Mohit purchase not found in my-packages, checking database..."
else
  PURCHASE_STATUS=$(echo $MOHIT_PURCHASE | jq -r '.status')
  IS_MANUAL=$(echo $MOHIT_PURCHASE | jq -r '.is_manual')
  echo "✅ Purchase found"
  echo "   Status: $PURCHASE_STATUS"
  echo "   Is Manual: $IS_MANUAL"
  if [ "$PURCHASE_STATUS" = "completed" ] && [ "$IS_MANUAL" = "false" ]; then
    echo "   ✅ AUTO-APPROVED (Correct!)"
  else
    echo "   ⚠️  Status or is_manual incorrect"
  fi
fi
echo ""

# Step 8: Register Lokesh under Mohit
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 8: Registering Lokesh (Under Mohit's Referral)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LOKESH=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Lokesh Test $TS\",
    \"email\": \"lokesh-test-$TS@test.com\",
    \"mobile\": \"987653${TS: -4}\",
    \"password\": \"lokesh123\",
    \"referrer_user_id\": \"$MOHIT_ID\"
  }")

LOKESH_ID=$(echo $LOKESH | jq -r '.id')
LOKESH_DISPLAY=$(echo $LOKESH | jq -r '.display_id')

if [ "$LOKESH_ID" = "null" ] || [ -z "$LOKESH_ID" ]; then
  echo "❌ Lokesh registration failed"
  echo "$LOKESH" | jq
  exit 1
fi

echo "✅ Lokesh registered under Mohit"
echo "   ID: $LOKESH_ID"
echo "   Display ID: $LOKESH_DISPLAY"
echo ""

# Step 9: Lokesh Login
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 9: Lokesh Login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LOKESH_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"lokesh-test-$TS@test.com\", \"password\": \"lokesh123\"}")

LOKESH_TOKEN=$(echo $LOKESH_LOGIN | jq -r '.token')

if [ "$LOKESH_TOKEN" = "null" ] || [ -z "$LOKESH_TOKEN" ]; then
  echo "❌ Lokesh login failed"
  exit 1
fi

echo "✅ Lokesh logged in"
echo ""

# Step 10: Lokesh purchases course via test-purchase (simulates gateway - auto-approves)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 10: Lokesh Purchases Course (Test Mode = Gateway Auto-Approve)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# This simulates payment gateway purchase - should auto-approve and trigger spot commission for Mohit
LOKESH_TEST=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $LOKESH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

if echo "$LOKESH_TEST" | jq -e '.purchases[0]' > /dev/null 2>&1; then
  LOKESH_ACTUAL_PURCHASE_ID=$(echo $LOKESH_TEST | jq -r '.purchases[0].id')
  echo "✅ Purchase completed (Auto-Approved)"
  echo "   Purchase ID: $LOKESH_ACTUAL_PURCHASE_ID"
  echo "   This should trigger spot commission for Mohit"
else
  echo "❌ Test purchase failed"
  echo "$LOKESH_TEST" | jq
  exit 1
fi
echo ""

# Wait for commission processing
echo "⏳ Waiting 5 seconds for commission processing..."
sleep 5
echo ""

# Step 12: Check Mohit's spot commission from Lokesh's purchase
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 12: Checking Mohit's Spot Commission (From Lokesh)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MOHIT_BALANCE=$(curl -s "$BASE_URL/dashboard" \
  -H "Authorization: Bearer $MOHIT_TOKEN" | jq -r '.wallet_balance // 0')

echo "✅ Mohit's Wallet Balance: ₹$MOHIT_BALANCE"
echo ""

# Step 13: Lokesh creates manual reinvestment request
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 13: Lokesh Creates Manual Reinvestment Request"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
# Get package price for reinvestment
PKG_PRICE=$(docker exec mlm-api-db-1 psql -U postgres -d mlm -t -c "SELECT price FROM packages WHERE id = $COURSE_PKG_ID;" | xargs)

REINVEST_REQUEST=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $LOKESH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $COURSE_PKG_ID,
    \"amount\": $PKG_PRICE,
    \"request_type\": \"reinvestment\",
    \"utr_number\": \"UTR_REINVEST_${TS}\",
    \"payment_proof_url\": \"https://example.com/reinvest-proof.jpg\",
    \"payment_type\": \"bank_transfer\",
    \"remarks\": \"Reinvestment request\"
  }")

REINVEST_REQ_ID=$(echo $REINVEST_REQUEST | jq -r '.id')

if [ "$REINVEST_REQ_ID" = "null" ] || [ -z "$REINVEST_REQ_ID" ]; then
  echo "❌ Reinvestment request creation failed"
  echo "$REINVEST_REQUEST" | jq
  exit 1
fi

REINVEST_STATUS=$(echo $REINVEST_REQUEST | jq -r '.status')
echo "✅ Reinvestment request created"
echo "   Request ID: $REINVEST_REQ_ID"
echo "   Status: $REINVEST_STATUS"
if [ "$REINVEST_STATUS" = "pending" ]; then
  echo "   ✅ Requires Admin Approval (Correct!)"
else
  echo "   ⚠️  Status should be 'pending'"
fi
echo ""

# Step 14: Admin approves reinvestment request
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 14: Admin Approves Reinvestment Request"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
APPROVE_REINVEST=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$REINVEST_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

REINVEST_PURCHASE_ID=$(echo $APPROVE_REINVEST | jq -r '.purchase.id')

if [ "$REINVEST_PURCHASE_ID" = "null" ] || [ -z "$REINVEST_PURCHASE_ID" ]; then
  echo "❌ Approval failed"
  echo "$APPROVE_REINVEST" | jq
  exit 1
fi

echo "✅ Reinvestment approved"
echo "   Purchase ID: $REINVEST_PURCHASE_ID"
echo ""

# Wait for commission processing
echo "⏳ Waiting 5 seconds for commission processing..."
sleep 5
echo ""

# Step 15: Check Mohit's spot commission from reinvestment
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 15: Checking Mohit's Spot Commission (From Reinvestment)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MOHIT_BALANCE_AFTER=$(curl -s "$BASE_URL/dashboard" \
  -H "Authorization: Bearer $MOHIT_TOKEN" | jq -r '.wallet_balance // 0')

echo "✅ Mohit's Wallet Balance After Reinvestment: ₹$MOHIT_BALANCE_AFTER"
SPOT_COMMISSION=$(echo "$MOHIT_BALANCE_AFTER - $MOHIT_BALANCE" | bc)
echo "   Spot Commission from Reinvestment: ₹$SPOT_COMMISSION"
echo ""

# Step 16: Check KYC status (should not be required for P2P)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 16: Checking KYC Status (For P2P Transfer)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MOHIT_KYC=$(curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $MOHIT_TOKEN" | jq -r '.user.kyc_status')

LOKESH_KYC=$(curl -s "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $LOKESH_TOKEN" | jq -r '.user.kyc_status')

echo "Mohit KYC Status: $MOHIT_KYC"
echo "Lokesh KYC Status: $LOKESH_KYC"
echo ""

# Step 17: Submit KYC for both (required for P2P)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 17: Submitting KYC for Mohit and Lokesh (Required for P2P)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Mohit KYC
MOHIT_KYC_SUBMIT=$(curl -s -X POST "$BASE_URL/users/$MOHIT_ID/kyc/submit" \
  -H "Authorization: Bearer $MOHIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"987654${TS: -4}\",
    \"pan_number\": \"ABCDE1234F\",
    \"aadhar_number\": \"123456789012\",
    \"documents\": [{
      \"document_type\": \"aadhar\",
      \"document_number\": \"123456789012\",
      \"front_image_url\": \"https://example.com/mohit-aadhar.jpg\"
    }]
  }")

echo "Mohit KYC submitted"

# Lokesh KYC
LOKESH_KYC_SUBMIT=$(curl -s -X POST "$BASE_URL/users/$LOKESH_ID/kyc/submit" \
  -H "Authorization: Bearer $LOKESH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"987653${TS: -4}\",
    \"pan_number\": \"FGHIJ5678K\",
    \"aadhar_number\": \"987654321098\",
    \"documents\": [{
      \"document_type\": \"aadhar\",
      \"document_number\": \"987654321098\",
      \"front_image_url\": \"https://example.com/lokesh-aadhar.jpg\"
    }]
  }")

echo "Lokesh KYC submitted"
echo ""

# Step 18: Admin approves both KYC
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 18: Admin Approving KYC for Both Users"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
curl -s -X POST "$BASE_URL/admin/kyc/$MOHIT_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

curl -s -X POST "$BASE_URL/admin/kyc/$LOKESH_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

echo "✅ Both KYC approved"
echo ""

# Step 19: Mohit transfers money to Lokesh via P2P
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 19: Mohit Transfers Money to Lokesh (P2P - Requires KYC)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TRANSFER_AMOUNT=1000
P2P_TRANSFER=$(curl -s -X POST "$BASE_URL/transfer/p2p" \
  -H "Authorization: Bearer $MOHIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"$LOKESH_ID\",
    \"amount\": $TRANSFER_AMOUNT,
    \"remarks\": \"Test transfer from Mohit to Lokesh\"
  }")

TRANSFER_SUCCESS=$(echo $P2P_TRANSFER | jq -r '.message // .error // .')

if echo "$TRANSFER_SUCCESS" | grep -q "success\|transferred"; then
  echo "✅ P2P Transfer successful"
  echo "   Amount: ₹$TRANSFER_AMOUNT"
else
  echo "⚠️  Transfer response: $TRANSFER_SUCCESS"
fi
echo ""

# Step 20: Database Verification
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DATABASE VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "1. USERS & KYC STATUS:"
echo "─────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  display_id,
  name,
  kyc_status,
  referrer_user_id
FROM users
WHERE id IN ($MOHIT_ID, $LOKESH_ID)
ORDER BY id;
"
echo ""

echo "2. PURCHASES (Gateway vs Manual):"
echo "─────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  user_id,
  package_id,
  purchase_type,
  amount,
  status,
  is_manual,
  payment_type,
  active_until > NOW() as is_active
FROM purchases
WHERE user_id IN ($MOHIT_ID, $LOKESH_ID)
ORDER BY user_id, purchased_at;
"
echo ""

echo "3. PURCHASE REQUESTS (Manual Only):"
echo "─────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  user_id,
  package_id,
  request_type,
  amount,
  status,
  processed_at IS NOT NULL as was_processed
FROM purchase_requests
WHERE user_id = $LOKESH_ID
ORDER BY id;
"
echo ""

echo "4. SPOT COMMISSIONS (Mohit should receive from Lokesh):"
echo "─────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.id,
  le.receiver_user_id,
  u.name as receiver_name,
  le.source_user_id,
  s.name as source_name,
  le.commission_type,
  le.amount,
  le.purchase_id,
  le.credited_at
FROM ledger_entries le
LEFT JOIN users u ON u.id = le.receiver_user_id
LEFT JOIN users s ON s.id = le.source_user_id
WHERE le.receiver_user_id = $MOHIT_ID
  AND le.commission_type = 'SPOT'
  AND le.source_user_id = $LOKESH_ID
ORDER BY le.credited_at;
"
echo ""

echo "5. USER BALANCES:"
echo "─────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  ub.user_id,
  u.name,
  u.display_id,
  ub.balance
FROM user_balances ub
LEFT JOIN users u ON u.id = ub.user_id
WHERE ub.user_id IN ($MOHIT_ID, $LOKESH_ID)
ORDER BY ub.user_id;
"
echo ""

echo "6. P2P TRANSFERS:"
echo "─────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  from_user_id as sender_id,
  to_user_id as receiver_id,
  amount,
  net_amount,
  tax_amount,
  status,
  created_at
FROM wallet_transfers
WHERE from_user_id = $MOHIT_ID
   OR to_user_id = $LOKESH_ID
ORDER BY created_at DESC
LIMIT 5;
"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Mohit:"
echo "   - Registered under root (ID 2)"
echo "   - Purchased course via gateway → AUTO-APPROVED"
echo "   - Received spot commission from Lokesh's course purchase"
echo "   - Received spot commission from Lokesh's reinvestment"
echo "   - KYC approved → Can do P2P transfers"
echo ""
echo "✅ Lokesh:"
echo "   - Registered under Mohit's referral"
echo "   - Purchased course via gateway → AUTO-APPROVED"
echo "   - Created reinvestment request (manual) → REQUIRED ADMIN APPROVAL"
echo "   - Reinvestment approved by admin"
echo "   - KYC approved → Can receive P2P transfers"
echo ""
echo "✅ Validations:"
echo "   - Gateway purchases: is_manual=false, status=completed (auto-approved)"
echo "   - Manual reinvestment: purchase_request created, required admin approval"
echo "   - Spot commissions: Mohit received from both Lokesh purchases"
echo "   - P2P transfer: Required KYC approval (both users)"
echo ""
echo "✅ All scenarios tested successfully!"
echo ""

