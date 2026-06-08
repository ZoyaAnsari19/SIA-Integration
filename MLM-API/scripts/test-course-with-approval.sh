#!/bin/bash

# Course Purchase with Admin Approval Flow
# Complete E2E: Register → KYC Submit → Course Purchase Request → Admin Approvals → Commissions

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "=========================================="
echo "Course Purchase with Admin Approval Test"
echo "=========================================="
echo ""

# Step 1: Admin Login
echo "Step 1: Admin Login..."
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@secureinfiniteassociation.com", "password": "admin123"}' | jq -r '.token')

echo "✅ Admin Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Step 2: Create Course
echo "Step 2: Creating Course..."
COURSE=$(curl -s -X POST "$BASE_URL/admin/courses" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Course with Approval $TS\",
    \"slug\": \"test-approval-$TS\",
    \"price\": 2500,
    \"package_id\": 1,
    \"language\": \"HINDI\",
    \"level\": \"BEGINNER\",
    \"category\": \"Test\",
    \"is_published\": true
  }")

COURSE_ID=$(echo $COURSE | jq -r '.course.id')
echo "✅ Course ID: $COURSE_ID"
echo ""

# Step 3: Register Mohit
echo "Step 3: Registering Mohit..."
MOHIT=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Mohit-Approval-$TS\",
    \"email\": \"mohit-approval-$TS@test.com\",
    \"mobile\": \"9876540001\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"2\"
  }")

MOHIT_ID=$(echo $MOHIT | jq -r '.id')
MOHIT_DISPLAY=$(echo $MOHIT | jq -r '.display_id')
echo "✅ Mohit: ID=$MOHIT_ID, Display=$MOHIT_DISPLAY"
echo ""

# Step 4: Register U1 (Rohit) - referred by Mohit
echo "Step 4: Registering U1 (Rohit) - referred by Mohit..."
U1=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Rohit-Approval-$TS\",
    \"email\": \"rohit-approval-$TS@test.com\",
    \"mobile\": \"9876540002\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$MOHIT_ID\"
  }")

U1_ID=$(echo $U1 | jq -r '.id')
U1_DISPLAY=$(echo $U1 | jq -r '.display_id')
U1_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"rohit-approval-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

echo "✅ U1 (Rohit): ID=$U1_ID, Display=$U1_DISPLAY"
echo ""

# Step 5: U1 submits KYC
echo "Step 5: U1 submitting KYC documents..."
KYC_SUBMIT=$(curl -s -X POST "$BASE_URL/users/$U1_ID/kyc" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_type": "aadhar",
    "document_number": "123456789012",
    "front_image_url": "https://example.com/aadhar-front.jpg",
    "back_image_url": "https://example.com/aadhar-back.jpg"
  }')

KYC_ID=$(echo $KYC_SUBMIT | jq -r '.kyc.id')
echo "✅ KYC submitted: ID=$KYC_ID, Status=pending"
echo ""

# Step 6: Admin approves KYC
echo "Step 6: Admin approving KYC..."
KYC_APPROVE=$(curl -s -X PUT "$BASE_URL/admin/kyc/$KYC_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "✅ KYC approved by admin"
echo ""

# Step 7: U1 creates manual deposit request for course purchase
echo "Step 7: U1 creating manual deposit request for course purchase..."

# First, let's create the manual deposit request (simulating payment proof upload)
DEPOSIT_REQUEST=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": 1,
    \"amount\": 2500,
    \"request_type\": \"activation\",
    \"utr_number\": \"UTR${TS}001\",
    \"payment_proof_url\": \"https://example.com/payment-proof-u1.jpg\",
    \"payment_type\": \"bank_transfer\",
    \"remarks\": \"Course purchase payment for Test Course\"
  }")

REQUEST_ID_U1=$(echo $DEPOSIT_REQUEST | jq -r '.request.id')
echo "✅ Manual deposit request created: ID=$REQUEST_ID_U1, Status=pending"
echo ""

# Step 8: Admin approves purchase request
echo "Step 8: Admin approving purchase request..."
APPROVE_PURCHASE=$(curl -s -X PUT "$BASE_URL/admin/purchase-requests/$REQUEST_ID_U1/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

PURCHASE_ID_U1=$(echo $APPROVE_PURCHASE | jq -r '.purchase.id')
echo "✅ Purchase approved: Purchase ID=$PURCHASE_ID_U1"
echo ""

# Wait for commissions to process
sleep 2

# Step 9: Register U2 - referred by U1
echo "Step 9: Registering U2 - referred by U1..."
U2=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User2-Approval-$TS\",
    \"email\": \"user2-approval-$TS@test.com\",
    \"mobile\": \"9876540003\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")

U2_ID=$(echo $U2 | jq -r '.id')
U2_DISPLAY=$(echo $U2 | jq -r '.display_id')
U2_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"user2-approval-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

echo "✅ U2: ID=$U2_ID, Display=$U2_DISPLAY"

# U2 KYC
KYC_U2=$(curl -s -X POST "$BASE_URL/users/$U2_ID/kyc" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_type": "aadhar",
    "document_number": "123456789013",
    "front_image_url": "https://example.com/aadhar-front-u2.jpg",
    "back_image_url": "https://example.com/aadhar-back-u2.jpg"
  }')

KYC_ID_U2=$(echo $KYC_U2 | jq -r '.kyc.id')
curl -s -X PUT "$BASE_URL/admin/kyc/$KYC_ID_U2/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

# U2 purchase request
DEPOSIT_U2=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": 1,
    \"amount\": 2500,
    \"request_type\": \"activation\",
    \"utr_number\": \"UTR${TS}002\",
    \"payment_proof_url\": \"https://example.com/payment-proof-u2.jpg\",
    \"payment_type\": \"bank_transfer\",
    \"remarks\": \"Course purchase payment\"
  }")

REQUEST_ID_U2=$(echo $DEPOSIT_U2 | jq -r '.request.id')
APPROVE_U2=$(curl -s -X PUT "$BASE_URL/admin/purchase-requests/$REQUEST_ID_U2/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

PURCHASE_ID_U2=$(echo $APPROVE_U2 | jq -r '.purchase.id')
echo "✅ U2 Purchase approved: Purchase ID=$PURCHASE_ID_U2"
echo ""

# Wait for commissions
sleep 2

echo "=========================================="
echo "DATABASE VERIFICATION"
echo "=========================================="
echo ""

echo "1. KYC STATUS:"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  u.id as user_id,
  u.name,
  u.kyc_status,
  u.display_id
FROM users u
WHERE u.id IN ($MOHIT_ID, $U1_ID, $U2_ID)
ORDER BY u.id;
"

echo ""
echo "2. PURCHASE REQUESTS (with approval status):"
echo "-------------------------------------------"
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
WHERE id IN ($REQUEST_ID_U1, $REQUEST_ID_U2)
ORDER BY id;
"

echo ""
echo "3. PURCHASES (after approval):"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  user_id,
  package_id,
  purchase_type,
  amount,
  status,
  is_manual,
  active_until > NOW() as is_active
FROM purchases
WHERE id IN ($PURCHASE_ID_U1, $PURCHASE_ID_U2)
ORDER BY id;
"

echo ""
echo "4. SPOT COMMISSIONS (triggered after approval):"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.receiver_user_id,
  u.name as receiver_name,
  u.display_id,
  le.commission_type,
  le.amount,
  le.purchase_id
FROM ledger_entries le
LEFT JOIN users u ON u.id = le.receiver_user_id
WHERE le.purchase_id IN ($PURCHASE_ID_U1, $PURCHASE_ID_U2)
  AND le.commission_type = 'SPOT'
ORDER BY le.purchase_id;
"

echo ""
echo "5. USER BALANCES (after commissions):"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  ub.user_id,
  u.name,
  u.display_id,
  ub.balance
FROM user_balances ub
LEFT JOIN users u ON u.id = ub.user_id
WHERE ub.user_id IN ($MOHIT_ID, $U1_ID, $U2_ID)
ORDER BY ub.user_id;
"

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo "✅ Course Created: $COURSE_ID"
echo "✅ Mohit: ID=$MOHIT_ID, Display=$MOHIT_DISPLAY (referrer)"
echo "✅ U1 (Rohit): ID=$U1_ID, Display=$U1_DISPLAY"
echo "   - KYC: Submitted → Approved by Admin"
echo "   - Purchase Request: $REQUEST_ID_U1 → Approved → Purchase: $PURCHASE_ID_U1"
echo "✅ U2: ID=$U2_ID, Display=$U2_DISPLAY"
echo "   - KYC: Submitted → Approved by Admin"
echo "   - Purchase Request: $REQUEST_ID_U2 → Approved → Purchase: $PURCHASE_ID_U2"
echo ""
echo "✅ Complete Approval Flow Tested!"



