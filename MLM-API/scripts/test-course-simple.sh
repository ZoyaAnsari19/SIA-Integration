#!/bin/bash

# Simple Course Purchase E2E Test

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "=========================================="
echo "Course Integration E2E Test - Simple"
echo "=========================================="
echo ""

# Get admin token
echo "Step 1: Admin Login..."
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@secureinfiniteassociation.com", "password": "admin123"}' | jq -r '.token')

echo "✅ Admin Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Create course
echo "Step 2: Creating Course..."
COURSE=$(curl -s -X POST "$BASE_URL/admin/courses" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Test Course $TS\",
    \"slug\": \"test-course-$TS\",
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

# Create Mohit
echo "Step 3: Creating Mohit..."
MOHIT=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Mohit-$TS\",
    \"email\": \"mohit-$TS@test.com\",
    \"mobile\": \"9876543210\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"2\"
  }")

MOHIT_ID=$(echo $MOHIT | jq -r '.id')
MOHIT_DISPLAY=$(echo $MOHIT | jq -r '.display_id')
echo "✅ Mohit ID: $MOHIT_ID, Display: $MOHIT_DISPLAY"
echo ""

# Create U1 (Rohit)
echo "Step 4: Creating U1 (Rohit) referred by Mohit..."
U1=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Rohit-$TS\",
    \"email\": \"rohit-$TS@test.com\",
    \"mobile\": \"9876543211\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$MOHIT_ID\"
  }")

U1_ID=$(echo $U1 | jq -r '.id')
U1_DISPLAY=$(echo $U1 | jq -r '.display_id')
echo "✅ U1 ID: $U1_ID, Display: $U1_DISPLAY"

# U1 Login
U1_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"rohit-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

echo "✅ U1 Token obtained"

# U1 buys course
echo "U1 purchasing course..."
U1_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

U1_PURCHASE_ID=$(echo $U1_PURCHASE | jq -r '.purchases[0].id')
echo "✅ U1 Purchase ID: $U1_PURCHASE_ID"
echo ""

# Create U2
echo "Step 5: Creating U2 referred by U1..."
U2=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User2-$TS\",
    \"email\": \"user2-$TS@test.com\",
    \"mobile\": \"9876543212\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")

U2_ID=$(echo $U2 | jq -r '.id')
U2_DISPLAY=$(echo $U2 | jq -r '.display_id')
echo "✅ U2 ID: $U2_ID, Display: $U2_DISPLAY"

# U2 Login and purchase
U2_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"user2-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

U2_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

U2_PURCHASE_ID=$(echo $U2_PURCHASE | jq -r '.purchases[0].id')
echo "✅ U2 Purchase ID: $U2_PURCHASE_ID"
echo ""

# Create U3
echo "Step 6: Creating U3 referred by U2..."
U3=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User3-$TS\",
    \"email\": \"user3-$TS@test.com\",
    \"mobile\": \"9876543213\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U2_ID\"
  }")

U3_ID=$(echo $U3 | jq -r '.id')
U3_DISPLAY=$(echo $U3 | jq -r '.display_id')
echo "✅ U3 ID: $U3_ID, Display: $U3_DISPLAY"

# U3 Login and purchase
U3_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"user3-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

U3_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U3_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

U3_PURCHASE_ID=$(echo $U3_PURCHASE | jq -r '.purchases[0].id')
echo "✅ U3 Purchase ID: $U3_PURCHASE_ID"
echo ""

echo "=========================================="
echo "DATABASE VERIFICATION"
echo "=========================================="
echo ""

echo "1. PURCHASES TABLE (COURSE_PURCHASE type):"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  user_id,
  package_id,
  purchase_type,
  course_id,
  amount,
  status,
  purchased_at
FROM purchases 
WHERE id IN ($U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
ORDER BY purchased_at;
"

echo ""
echo "2. PACKAGE ACTIVATION STATUS:"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  user_id,
  package_id,
  purchase_type,
  status,
  active_until > NOW() as is_active,
  active_until
FROM purchases 
WHERE id IN ($U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
ORDER BY user_id;
"

echo ""
echo "3. SPOT COMMISSIONS (Ledger Entries):"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.id,
  le.receiver_user_id,
  u.name as receiver_name,
  le.source_user_id,
  le.commission_type,
  le.amount,
  le.purchase_id,
  le.credited_at
FROM ledger_entries le
LEFT JOIN users u ON u.id = le.receiver_user_id
WHERE le.purchase_id IN ($U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
ORDER BY le.purchase_id, le.commission_type;
"

echo ""
echo "4. USER BALANCES:"
echo "-------------------------------------------"
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
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo "Course: $COURSE_ID"
echo "Mohit: ID=$MOHIT_ID, Display=$MOHIT_DISPLAY"
echo "U1/Rohit: ID=$U1_ID, Display=$U1_DISPLAY, Purchase=$U1_PURCHASE_ID"
echo "U2: ID=$U2_ID, Display=$U2_DISPLAY, Purchase=$U2_PURCHASE_ID"
echo "U3: ID=$U3_ID, Display=$U3_DISPLAY, Purchase=$U3_PURCHASE_ID"
echo ""
echo "✅ Test Complete!"



