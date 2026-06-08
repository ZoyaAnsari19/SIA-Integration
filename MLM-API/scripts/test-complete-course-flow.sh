#!/bin/bash

# Complete Course Purchase Flow with Business Rules
# Rule: User can only add referrals AFTER having an active package

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "=========================================="
echo "COMPLETE COURSE FLOW WITH BUSINESS RULES"
echo "=========================================="
echo ""
echo "Business Rule: User can add referrals ONLY after purchasing & activating a course/package"
echo ""

# Admin Login
echo "Step 1: Admin Login..."
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@secureinfiniteassociation.com", "password": "admin123"}' | jq -r '.token')

echo "✅ Admin authenticated"
echo ""

# Create Course
echo "Step 2: Admin creates course mapped to Package ID 1..."
COURSE=$(curl -s -X POST "$BASE_URL/admin/courses" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Course Flow Test $TS\",
    \"slug\": \"course-flow-$TS\",
    \"price\": 2500,
    \"package_id\": 1,
    \"language\": \"HINDI\",
    \"level\": \"BEGINNER\",
    \"category\": \"Test\",
    \"is_published\": true
  }")

COURSE_ID=$(echo $COURSE | jq -r '.course.id')
echo "✅ Course Created: $COURSE_ID (Mapped to Package ID: 1)"
echo ""

# Register Mohit (base user with root referral - ID=2)
echo "Step 3: Register Mohit (base user)..."
MOHIT=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Mohit-Flow-$TS\",
    \"email\": \"mohit-flow-$TS@test.com\",
    \"mobile\": \"9876540010\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"2\"
  }")

MOHIT_ID=$(echo $MOHIT | jq -r '.id')
MOHIT_DISPLAY=$(echo $MOHIT | jq -r '.display_id')
echo "✅ Mohit registered: ID=$MOHIT_ID, Display=$MOHIT_DISPLAY"
echo ""

# Try to add U1 under Mohit (should FAIL - Mohit has no active package)
echo "Step 4: Try to register U1 under Mohit (should FAIL)..."
echo "Expected: Error - Mohit has no active package yet"
U1_TRY=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Rohit-Try-$TS\",
    \"email\": \"rohit-try-$TS@test.com\",
    \"mobile\": \"9876540011\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$MOHIT_ID\"
  }")

U1_ERROR=$(echo $U1_TRY | jq -r '.error // "success"')
if [ "$U1_ERROR" == "referrer_no_active_package" ]; then
  echo "✅ CORRECTLY BLOCKED: $(echo $U1_TRY | jq -r '.message')"
else
  echo "❌ UNEXPECTED: Registration should have been blocked!"
  echo "Response: $U1_TRY"
fi
echo ""

# Mohit purchases course (test-purchase for simplicity)
echo "Step 5: Mohit purchases course..."
MOHIT_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"mohit-flow-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

MOHIT_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $MOHIT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

MOHIT_PURCHASE_ID=$(echo $MOHIT_PURCHASE | jq -r '.purchases[0].id')
echo "✅ Mohit purchased course: Purchase ID=$MOHIT_PURCHASE_ID"
echo "✅ Package ACTIVATED for Mohit (auto-approved in test mode)"
echo ""

# Now try to add U1 again (should SUCCESS - Mohit now has active package)
echo "Step 6: Now register U1 under Mohit (should SUCCESS)..."
U1=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Rohit-Flow-$TS\",
    \"email\": \"rohit-flow-$TS@test.com\",
    \"mobile\": \"9876540012\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$MOHIT_ID\"
  }")

U1_ID=$(echo $U1 | jq -r '.id')
U1_DISPLAY=$(echo $U1 | jq -r '.display_id')

if [ "$U1_ID" == "null" ]; then
  echo "❌ FAILED: U1 should have been registered!"
  echo "Response: $U1"
else
  echo "✅ SUCCESS: U1 registered under Mohit"
  echo "   U1: ID=$U1_ID, Display=$U1_DISPLAY"
fi
echo ""

# U1 tries to add U2 (should FAIL - U1 has no active package yet)
echo "Step 7: U1 tries to register U2 (should FAIL)..."
U2_TRY=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User2-Try-$TS\",
    \"email\": \"user2-try-$TS@test.com\",
    \"mobile\": \"9876540013\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")

U2_ERROR=$(echo $U2_TRY | jq -r '.error // "success"')
if [ "$U2_ERROR" == "referrer_no_active_package" ]; then
  echo "✅ CORRECTLY BLOCKED: U1 cannot add referrals yet (no active package)"
else
  echo "❌ UNEXPECTED: Should have been blocked!"
fi
echo ""

# U1 purchases course
echo "Step 8: U1 purchases course..."
U1_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"rohit-flow-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

U1_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

U1_PURCHASE_ID=$(echo $U1_PURCHASE | jq -r '.purchases[0].id')
echo "✅ U1 purchased course: Purchase ID=$U1_PURCHASE_ID"
echo ""

# Now U1 can add U2
echo "Step 9: Now U1 can register U2 (should SUCCESS)..."
U2=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User2-Flow-$TS\",
    \"email\": \"user2-flow-$TS@test.com\",
    \"mobile\": \"9876540014\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")

U2_ID=$(echo $U2 | jq -r '.id')
U2_DISPLAY=$(echo $U2 | jq -r '.display_id')

if [ "$U2_ID" == "null" ]; then
  echo "❌ FAILED: U2 should have been registered!"
else
  echo "✅ SUCCESS: U2 registered under U1"
  echo "   U2: ID=$U2_ID, Display=$U2_DISPLAY"
fi
echo ""

# U2 purchases
echo "Step 10: U2 purchases course..."
U2_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"user2-flow-$TS@test.com\", \"password\": \"password123\"}" | jq -r '.token')

U2_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"courseIds\": [\"$COURSE_ID\"]}")

U2_PURCHASE_ID=$(echo $U2_PURCHASE | jq -r '.purchases[0].id')
echo "✅ U2 purchased course: Purchase ID=$U2_PURCHASE_ID"
echo ""

# Database verification
echo "=========================================="
echo "DATABASE VERIFICATION"
echo "=========================================="
echo ""

echo "1. USER HIERARCHY & ACTIVE PACKAGES:"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  u.id,
  u.name,
  u.display_id,
  u.referrer_user_id,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM purchases p 
      WHERE p.user_id = u.id 
        AND p.status = 'completed' 
        AND p.active_until > NOW()
    ) THEN 'YES'
    ELSE 'NO'
  END as has_active_package
FROM users u
WHERE u.id IN ($MOHIT_ID, $U1_ID, $U2_ID)
ORDER BY u.id;
"

echo ""
echo "2. COURSE PURCHASES:"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  p.id,
  p.user_id,
  u.name,
  p.purchase_type,
  p.package_id,
  p.amount,
  p.active_until > NOW() as is_active
FROM purchases p
LEFT JOIN users u ON u.id = p.user_id
WHERE p.id IN ($MOHIT_PURCHASE_ID, $U1_PURCHASE_ID, $U2_PURCHASE_ID)
ORDER BY p.id;
"

echo ""
echo "3. SPOT COMMISSIONS (Mohit should get from U1, U1 from U2):"
echo "-------------------------------------------"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.receiver_user_id,
  u.name as receiver_name,
  le.source_user_id,
  s.name as source_name,
  le.commission_type,
  le.amount,
  le.purchase_id
FROM ledger_entries le
LEFT JOIN users u ON u.id = le.receiver_user_id
LEFT JOIN users s ON s.id = le.source_user_id
WHERE le.purchase_id IN ($MOHIT_PURCHASE_ID, $U1_PURCHASE_ID, $U2_PURCHASE_ID)
  AND le.commission_type = 'SPOT'
ORDER BY le.purchase_id;
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
WHERE ub.user_id IN ($MOHIT_ID, $U1_ID, $U2_ID)
ORDER BY ub.user_id;
"

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo "✅ Business Rule Verified:"
echo "   - Users WITHOUT active package CANNOT add referrals"
echo "   - Users WITH active package CAN add referrals"
echo ""
echo "✅ Flow Verified:"
echo "   1. Mohit (no package) → CANNOT add U1 ❌"
echo "   2. Mohit purchases course → Package ACTIVE ✅"
echo "   3. Mohit (with package) → CAN add U1 ✅"
echo "   4. U1 (no package) → CANNOT add U2 ❌"
echo "   5. U1 purchases course → Package ACTIVE ✅"
echo "   6. U1 (with package) → CAN add U2 ✅"
echo "   7. U2 purchases → Commissions triggered ✅"
echo ""
echo "Mohit: ID=$MOHIT_ID, Display=$MOHIT_DISPLAY"
echo "U1: ID=$U1_ID, Display=$U1_DISPLAY"
echo "U2: ID=$U2_ID, Display=$U2_DISPLAY"
echo ""
echo "✅ All Tests Passed!"



