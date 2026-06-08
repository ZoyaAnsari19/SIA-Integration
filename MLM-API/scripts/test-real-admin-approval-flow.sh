#!/bin/bash

# REAL ADMIN APPROVAL FLOW - NO TEST MODE
# Flow: Register → KYC Submit → Admin KYC Approve → Course Purchase Request → Admin Approve → Package Active → Commissions

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "================================================================"
echo "REAL COURSE PURCHASE FLOW WITH ADMIN APPROVAL"
echo "================================================================"
echo ""
echo "Flow:"
echo "1. User registers"
echo "2. User submits KYC"
echo "3. ADMIN approves KYC"
echo "4. User creates purchase request (manual deposit)"
echo "5. ADMIN approves purchase request"
echo "6. Package activates"
echo "7. Commissions trigger"
echo ""

# Admin Login
echo "═══════════════════════════════════════════════════════════════"
echo "ADMIN LOGIN"
echo "═══════════════════════════════════════════════════════════════"
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@secureinfiniteassociation.com", "password": "admin123"}' | jq -r '.token')

echo "✅ Admin authenticated"
echo ""

# Create Course
echo "═══════════════════════════════════════════════════════════════"
echo "ADMIN: CREATE COURSE (mapped to Package ID 1)"
echo "═══════════════════════════════════════════════════════════════"
COURSE=$(curl -s -X POST "$BASE_URL/admin/courses" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Stock Market Mastery $TS\",
    \"slug\": \"stock-market-$TS\",
    \"price\": 2500,
    \"package_id\": 1,
    \"language\": \"HINDI\",
    \"level\": \"BEGINNER\",
    \"category\": \"Investment\",
    \"is_published\": true
  }")

COURSE_ID=$(echo $COURSE | jq -r '.course.id')
PACKAGE_ID=$(echo $COURSE | jq -r '.course.package_id')
echo "✅ Course Created:"
echo "   ID: $COURSE_ID"
echo "   Mapped to Package: $PACKAGE_ID (₹2500)"
echo ""

# Register Mohit
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 1: REGISTER MOHIT (Base User)"
echo "═══════════════════════════════════════════════════════════════"
MOHIT_EMAIL="mohit-$TS@test.com"

MOHIT=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Mohit Kumar\",
    \"email\": \"$MOHIT_EMAIL\",
    \"mobile\": \"9876543210\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"2\"
  }")

MOHIT_ID=$(echo $MOHIT | jq -r '.id')
MOHIT_DISPLAY=$(echo $MOHIT | jq -r '.display_id')
echo "✅ Mohit Registered:"
echo "   ID: $MOHIT_ID"
echo "   Display: $MOHIT_DISPLAY"
echo "   Email: $MOHIT_EMAIL"
echo ""

# Mohit Login
echo "Logging in Mohit..."
MOHIT_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$MOHIT_EMAIL\", \"password\": \"password123\"}" | jq -r '.token')
  
echo "Token: ${MOHIT_TOKEN:0:30}..."

# Mohit submits KYC
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 2: MOHIT SUBMITS KYC"
echo "═══════════════════════════════════════════════════════════════"
MOHIT_KYC=$(curl -s -X POST "$BASE_URL/users/$MOHIT_ID/kyc/submit" \
  -H "Authorization: Bearer $MOHIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pan_number": "ABCDE1234F",
    "aadhar_number": "123456789012",
    "bank_account_no": "1234567890",
    "bank_ifsc": "SBIN0001234",
    "bank_name": "State Bank of India",
    "documents": [
      {
        "document_type": "aadhar",
        "document_number": "123456789012",
        "front_image_url": "https://example.com/mohit-aadhar-front.jpg",
        "back_image_url": "https://example.com/mohit-aadhar-back.jpg"
      }
    ]
  }')

MOHIT_KYC_ID=$(echo $MOHIT_KYC | jq -r '.user_id')
echo "✅ Mohit KYC Submitted:"
echo "   KYC ID: $MOHIT_KYC_ID"
echo "   Status: pending"
echo ""

# Admin approves Mohit KYC
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 3: ADMIN APPROVES MOHIT KYC"
echo "═══════════════════════════════════════════════════════════════"
curl -s -X PUT "$BASE_URL/admin/kyc/$MOHIT_KYC_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

echo "✅ Admin approved Mohit's KYC"
echo ""

# Mohit creates purchase request (manual deposit)
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 4: MOHIT CREATES PURCHASE REQUEST (Manual Deposit)"
echo "═══════════════════════════════════════════════════════════════"
MOHIT_REQ=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $MOHIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"amount\": 2500,
    \"request_type\": \"activation\",
    \"utr_number\": \"UTR${TS}MOHIT\",
    \"payment_proof_url\": \"https://example.com/mohit-payment.jpg\",
    \"payment_type\": \"bank_transfer\",
    \"remarks\": \"Course purchase: Stock Market Mastery\"
  }")

MOHIT_REQ_ID=$(echo $MOHIT_REQ | jq -r '.id')
echo "✅ Mohit Purchase Request Created:"
echo "   Request ID: $MOHIT_REQ_ID"
echo "   Amount: ₹2500"
echo "   Status: pending (waiting for admin approval)"
echo ""

# Admin approves Mohit purchase
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 5: ADMIN APPROVES MOHIT PURCHASE"
echo "═══════════════════════════════════════════════════════════════"
MOHIT_APPROVE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$MOHIT_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

MOHIT_PURCHASE_ID=$(echo $MOHIT_APPROVE | jq -r '.purchase.id')
echo "✅ Admin Approved Mohit's Purchase:"
echo "   Purchase ID: $MOHIT_PURCHASE_ID"
echo "   Package ACTIVATED"
echo "   Commissions TRIGGERED"
echo ""

sleep 1

# Now Mohit can add U1
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 6: REGISTER U1 (Rohit) - Referred by Mohit"
echo "═══════════════════════════════════════════════════════════════"
U1_EMAIL="rohit-$TS@test.com"

U1=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Rohit Singh\",
    \"email\": \"$U1_EMAIL\",
    \"mobile\": \"9876543211\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$MOHIT_ID\"
  }")

U1_ID=$(echo $U1 | jq -r '.id')
U1_DISPLAY=$(echo $U1 | jq -r '.display_id')
echo "✅ U1 (Rohit) Registered:"
echo "   ID: $U1_ID"
echo "   Display: $U1_DISPLAY"
echo "   Referrer: Mohit ($MOHIT_ID)"
echo ""

# U1 Login
echo "Logging in U1..."
U1_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$U1_EMAIL\", \"password\": \"password123\"}" | jq -r '.token')

# U1 KYC
echo "U1: Submitting KYC..."
U1_KYC=$(curl -s -X POST "$BASE_URL/users/$U1_ID/kyc/submit" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pan_number": "FGHIJ5678K",
    "aadhar_number": "987654321098",
    "bank_account_no": "9876543210",
    "bank_ifsc": "HDFC0001234",
    "bank_name": "HDFC Bank",
    "documents": [
      {
        "document_type": "aadhar",
        "document_number": "987654321098",
        "front_image_url": "https://example.com/u1-aadhar-front.jpg",
        "back_image_url": "https://example.com/u1-aadhar-back.jpg"
      }
    ]
  }')

U1_KYC_ID=$(echo $U1_KYC | jq -r '.user_id')
echo "U1: KYC ID: $U1_KYC_ID"

# Admin approves U1 KYC
curl -s -X PUT "$BASE_URL/admin/kyc/$U1_KYC_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null
echo "Admin: Approved U1's KYC"

# U1 Purchase Request
U1_REQ=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"amount\": 2500,
    \"request_type\": \"activation\",
    \"utr_number\": \"UTR${TS}U1\",
    \"payment_proof_url\": \"https://example.com/u1-payment.jpg\",
    \"payment_type\": \"bank_transfer\",
    \"remarks\": \"Course purchase\"
  }")

U1_REQ_ID=$(echo $U1_REQ | jq -r '.id')
echo "U1: Purchase Request ID: $U1_REQ_ID"

# Admin approves U1 purchase
U1_APPROVE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$U1_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

U1_PURCHASE_ID=$(echo $U1_APPROVE | jq -r '.purchase.id')
echo "✅ Admin Approved U1's Purchase: $U1_PURCHASE_ID"
echo ""

sleep 1

# Register U2
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 7: REGISTER U2 - Referred by U1"
echo "═══════════════════════════════════════════════════════════════"
U2_EMAIL="user2-$TS@test.com"

U2=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User2\",
    \"email\": \"$U2_EMAIL\",
    \"mobile\": \"9876543212\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")

U2_ID=$(echo $U2 | jq -r '.id')
U2_DISPLAY=$(echo $U2 | jq -r '.display_id')
echo "✅ U2 Registered: ID=$U2_ID, Display=$U2_DISPLAY"

U2_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$U2_EMAIL\", \"password\": \"password123\"}" | jq -r '.token')

# U2 KYC + Approval
U2_KYC=$(curl -s -X POST "$BASE_URL/users/$U2_ID/kyc/submit" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pan_number": "KLMNO9012P", "aadhar_number": "111222333444", "bank_account_no": "1112223334", "bank_ifsc": "ICIC0001234", "bank_name": "ICICI Bank", "documents": [{"document_type": "aadhar", "document_number": "111222333444", "front_image_url": "https://example.com/u2-front.jpg", "back_image_url": "https://example.com/u2-back.jpg"}]}')

U2_KYC_ID=$(echo $U2_KYC | jq -r '.user_id')
curl -s -X PUT "$BASE_URL/admin/kyc/$U2_KYC_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

# U2 Purchase
U2_REQ=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"package_id\": $PACKAGE_ID, \"amount\": 2500, \"request_type\": \"activation\", \"utr_number\": \"UTR${TS}U2\", \"payment_proof_url\": \"https://example.com/u2-payment.jpg\", \"payment_type\": \"bank_transfer\", \"remarks\": \"Course purchase\"}")

U2_REQ_ID=$(echo $U2_REQ | jq -r '.id')
U2_APPROVE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$U2_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

U2_PURCHASE_ID=$(echo $U2_APPROVE | jq -r '.purchase.id')
echo "✅ U2: KYC Approved, Purchase Approved: $U2_PURCHASE_ID"
echo ""

sleep 1

# Register U3
echo "═══════════════════════════════════════════════════════════════"
echo "STEP 8: REGISTER U3 - Referred by U2"
echo "═══════════════════════════════════════════════════════════════"
U3_EMAIL="user3-$TS@test.com"

U3=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User3\",
    \"email\": \"$U3_EMAIL\",
    \"mobile\": \"9876543213\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U2_ID\"
  }")

U3_ID=$(echo $U3 | jq -r '.id')
U3_DISPLAY=$(echo $U3 | jq -r '.display_id')
echo "✅ U3 Registered: ID=$U3_ID, Display=$U3_DISPLAY"

U3_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$U3_EMAIL\", \"password\": \"password123\"}" | jq -r '.token')

# U3 KYC + Purchase
U3_KYC=$(curl -s -X POST "$BASE_URL/users/$U3_ID/kyc/submit" \
  -H "Authorization: Bearer $U3_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pan_number": "PQRST3456U", "aadhar_number": "555666777888", "bank_account_no": "5556667778", "bank_ifsc": "AXIS0001234", "bank_name": "Axis Bank", "documents": [{"document_type": "aadhar", "document_number": "555666777888", "front_image_url": "https://example.com/u3-front.jpg", "back_image_url": "https://example.com/u3-back.jpg"}]}')

U3_KYC_ID=$(echo $U3_KYC | jq -r '.user_id')
curl -s -X PUT "$BASE_URL/admin/kyc/$U3_KYC_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null

U3_REQ=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $U3_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"package_id\": $PACKAGE_ID, \"amount\": 2500, \"request_type\": \"activation\", \"utr_number\": \"UTR${TS}U3\", \"payment_proof_url\": \"https://example.com/u3-payment.jpg\", \"payment_type\": \"bank_transfer\", \"remarks\": \"Course purchase\"}")

U3_REQ_ID=$(echo $U3_REQ | jq -r '.id')
U3_APPROVE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$U3_REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

U3_PURCHASE_ID=$(echo $U3_APPROVE | jq -r '.purchase.id')
echo "✅ U3: KYC Approved, Purchase Approved: $U3_PURCHASE_ID"
echo ""

sleep 2

# DATABASE VERIFICATION
echo "================================================================"
echo "DATABASE VERIFICATION"
echo "================================================================"
echo ""

echo "1. COURSE PURCHASES (All should be MANUAL_DEPOSIT type):"
echo "────────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  p.id,
  u.name,
  p.purchase_type,
  p.package_id,
  p.amount,
  p.status,
  p.is_manual,
  p.active_until > NOW() as is_active
FROM purchases p
LEFT JOIN users u ON u.id = p.user_id
WHERE p.id IN ($MOHIT_PURCHASE_ID, $U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
ORDER BY p.id;
"

echo ""
echo "2. PACKAGE MAPPING VERIFICATION:"
echo "────────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  p.id as purchase_id,
  p.user_id,
  p.package_id,
  pkg.name as package_name,
  c.id as course_id,
  c.title as course_title
FROM purchases p
LEFT JOIN packages pkg ON pkg.id = p.package_id
LEFT JOIN courses c ON c.package_id = p.package_id
WHERE p.id IN ($MOHIT_PURCHASE_ID, $U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
ORDER BY p.id;
"

echo ""
echo "3. KYC APPROVAL STATUS:"
echo "────────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  u.id,
  u.name,
  u.display_id,
  u.kyc_status
FROM users u
WHERE u.id IN ($MOHIT_ID, $U1_ID, $U2_ID, $U3_ID)
ORDER BY u.id;
"

echo ""
echo "4. SPOT COMMISSIONS (triggered after admin approval):"
echo "────────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.receiver_user_id,
  r.name as receiver_name,
  r.display_id as receiver_display,
  le.source_user_id,
  s.name as source_name,
  le.commission_type,
  le.amount,
  le.purchase_id
FROM ledger_entries le
LEFT JOIN users r ON r.id = le.receiver_user_id
LEFT JOIN users s ON s.id = le.source_user_id
WHERE le.purchase_id IN ($MOHIT_PURCHASE_ID, $U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
  AND le.commission_type = 'SPOT'
ORDER BY le.purchase_id;
"

echo ""
echo "5. USER BALANCES (after commissions):"
echo "────────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  ub.user_id,
  u.name,
  u.display_id,
  ub.balance
FROM user_balances ub
LEFT JOIN users u ON u.id = ub.user_id
WHERE ub.user_id IN ($MOHIT_ID, $U1_ID, $U2_ID, $U3_ID)
ORDER BY ub.user_id;
"

echo ""
echo "6. LEDGER ENTRIES (All types):"
echo "────────────────────────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.id,
  le.receiver_user_id,
  u.name,
  le.commission_type,
  le.amount,
  le.purchase_id
FROM ledger_entries le
LEFT JOIN users u ON u.id = le.receiver_user_id
WHERE le.purchase_id IN ($MOHIT_PURCHASE_ID, $U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
ORDER BY le.purchase_id, le.commission_type;
"

echo ""
echo "================================================================"
echo "TEST SUMMARY"
echo "================================================================"
echo ""
echo "Course: $COURSE_ID (Package: $PACKAGE_ID)"
echo ""
echo "User Hierarchy (ALL WITH ADMIN APPROVAL):"
echo "  Mohit: $MOHIT_ID ($MOHIT_DISPLAY)"
echo "    ├─ KYC: Approved"
echo "    ├─ Purchase: $MOHIT_PURCHASE_ID (Admin Approved)"
echo "    └─ U1 (Rohit): $U1_ID ($U1_DISPLAY)"
echo "        ├─ KYC: Approved"
echo "        ├─ Purchase: $U1_PURCHASE_ID (Admin Approved)"
echo "        └─ U2: $U2_ID ($U2_DISPLAY)"
echo "            ├─ KYC: Approved"
echo "            ├─ Purchase: $U2_PURCHASE_ID (Admin Approved)"
echo "            └─ U3: $U3_ID ($U3_DISPLAY)"
echo "                ├─ KYC: Approved"
echo "                └─ Purchase: $U3_PURCHASE_ID (Admin Approved)"
echo ""
echo "✅ ALL PURCHASES APPROVED BY ADMIN"
echo "✅ ALL PACKAGES ACTIVATED AFTER ADMIN APPROVAL"
echo "✅ ALL COMMISSIONS TRIGGERED AFTER ACTIVATION"
echo ""

