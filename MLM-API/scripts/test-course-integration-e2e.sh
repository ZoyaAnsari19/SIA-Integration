#!/bin/bash

# Course Integration E2E Test
# Tests: User registration → Course purchase → Package activation → Commission triggering

set -e

BASE_URL="http://localhost:3000/api/v1"
ADMIN_EMAIL="admin@secureinfiniteassociation.com"
ADMIN_PASSWORD="admin123"

echo "======================================"
echo "Course Integration E2E Test"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Admin Login
echo "Step 1: Admin Login"
echo "----------------------------------------"
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

ADMIN_TOKEN=$(echo $ADMIN_LOGIN_RESPONSE | jq -r '.token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Admin login failed${NC}"
  echo "Response: $ADMIN_LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Admin logged in successfully${NC}"
echo "Admin Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# Step 2: Get Packages List
echo "Step 2: Get Packages List"
echo "----------------------------------------"
PACKAGES_RESPONSE=$(curl -s -X GET "$BASE_URL/packages")
echo "Available Packages:"
echo $PACKAGES_RESPONSE | jq '.[] | {id, name, price}' | head -20

PACKAGE_ID=$(echo $PACKAGES_RESPONSE | jq -r '.[0].id')
PACKAGE_NAME=$(echo $PACKAGES_RESPONSE | jq -r '.[0].name')
PACKAGE_PRICE=$(echo $PACKAGES_RESPONSE | jq -r '.[0].price')

echo -e "${GREEN}✅ Using Package: $PACKAGE_NAME (ID: $PACKAGE_ID, Price: ₹$PACKAGE_PRICE)${NC}"
echo ""

# Step 3: Create Test Course
echo "Step 3: Create Test Course with Package Mapping"
echo "----------------------------------------"
COURSE_SLUG="stock-market-basics-$(date +%s)"
COURSE_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/courses" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Stock Market Basics - Test Course\",
    \"slug\": \"$COURSE_SLUG\",
    \"short_description\": \"Learn stock market fundamentals\",
    \"long_description\": \"Complete course on stock market trading and investment strategies\",
    \"price\": $PACKAGE_PRICE,
    \"original_price\": $(echo "$PACKAGE_PRICE * 1.5" | bc),
    \"package_id\": $PACKAGE_ID,
    \"language\": \"HINDI\",
    \"level\": \"BEGINNER\",
    \"category\": \"Investment\",
    \"is_published\": true
  }")

COURSE_ID=$(echo $COURSE_RESPONSE | jq -r '.course.id')
COURSE_TITLE=$(echo $COURSE_RESPONSE | jq -r '.course.title')

if [ "$COURSE_ID" == "null" ] || [ -z "$COURSE_ID" ]; then
  echo -e "${RED}❌ Course creation failed${NC}"
  echo "Response: $COURSE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Course created: $COURSE_TITLE${NC}"
echo "Course ID: $COURSE_ID"
echo "Package Mapping: Package ID $PACKAGE_ID"
echo ""

# Step 4: Create Base User (Mohit)
echo "Step 4: Create Base User (Mohit)"
echo "----------------------------------------"

# First create a root user if not exists (ID=1)
ROOT_CHECK=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Root User\",
    \"email\": \"root@test.com\",
    \"mobile\": \"1111111111\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"1\"
  }" 2>/dev/null || echo '{"error":"exists"}')

# Now create Mohit
MOHIT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Mohit\",
    \"email\": \"mohit@test.com\",
    \"mobile\": \"9876543210\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"1\"
  }")

MOHIT_ID=$(echo $MOHIT_RESPONSE | jq -r '.id')
MOHIT_DISPLAY_ID=$(echo $MOHIT_RESPONSE | jq -r '.display_id')

if [ "$MOHIT_ID" == "null" ]; then
  # User might already exist, try to get via login
  MOHIT_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"mohit@test.com\",
      \"password\": \"password123\"
    }")
  
  MOHIT_ID=$(echo $MOHIT_LOGIN | jq -r '.user.id')
  MOHIT_DISPLAY_ID=$(echo $MOHIT_LOGIN | jq -r '.user.display_id // "SIA02000"')
fi

echo -e "${GREEN}✅ Base User Created: Mohit${NC}"
echo "User ID: $MOHIT_ID"
echo "Display ID: $MOHIT_DISPLAY_ID"
echo ""

# Step 5: Register U1 (referred by Mohit) and buy course
echo "Step 5: Register U1 (Rohit - referred by Mohit)"
echo "----------------------------------------"
U1_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Rohit\",
    \"email\": \"rohit@test.com\",
    \"mobile\": \"9876543211\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$MOHIT_ID\"
  }")

U1_ID=$(echo $U1_RESPONSE | jq -r '.id')
U1_DISPLAY_ID=$(echo $U1_RESPONSE | jq -r '.display_id')

if [ "$U1_ID" == "null" ]; then
  # Login if already exists
  U1_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"rohit@test.com\",
      \"password\": \"password123\"
    }")
  U1_TOKEN=$(echo $U1_LOGIN | jq -r '.token')
  U1_ID=$(echo $U1_LOGIN | jq -r '.user.id')
  U1_DISPLAY_ID=$(echo $U1_LOGIN | jq -r '.user.display_id')
else
  # Get token for new user
  U1_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"rohit@test.com\",
      \"password\": \"password123\"
    }")
  U1_TOKEN=$(echo $U1_LOGIN | jq -r '.token')
fi

echo -e "${GREEN}✅ U1 Registered: Rohit${NC}"
echo "User ID: $U1_ID"
echo "Display ID: $U1_DISPLAY_ID"
echo "Referrer: Mohit ($MOHIT_ID)"

# U1 buys course
echo "U1 purchasing course..."
U1_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseIds\": [\"$COURSE_ID\"]
  }")

U1_PURCHASE_ID=$(echo $U1_PURCHASE | jq -r '.purchases[0].id')
echo -e "${GREEN}✅ U1 purchased course (Purchase ID: $U1_PURCHASE_ID)${NC}"
echo ""

# Step 6: Register U2 (referred by U1) and buy course
echo "Step 6: Register U2 (referred by U1)"
echo "----------------------------------------"
U2_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User2\",
    \"email\": \"user2@test.com\",
    \"mobile\": \"9876543212\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U1_ID\"
  }")

U2_ID=$(echo $U2_RESPONSE | jq -r '.id')
U2_DISPLAY_ID=$(echo $U2_RESPONSE | jq -r '.display_id')

if [ "$U2_ID" == "null" ]; then
  U2_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user2@test.com\",
      \"password\": \"password123\"
    }")
  U2_TOKEN=$(echo $U2_LOGIN | jq -r '.token')
  U2_ID=$(echo $U2_LOGIN | jq -r '.user.id')
  U2_DISPLAY_ID=$(echo $U2_LOGIN | jq -r '.user.display_id')
else
  U2_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user2@test.com\",
      \"password\": \"password123\"
    }")
  U2_TOKEN=$(echo $U2_LOGIN | jq -r '.token')
fi

echo -e "${GREEN}✅ U2 Registered: User2${NC}"
echo "User ID: $U2_ID"
echo "Display ID: $U2_DISPLAY_ID"
echo "Referrer: Rohit ($U1_ID)"

# U2 buys course
echo "U2 purchasing course..."
U2_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseIds\": [\"$COURSE_ID\"]
  }")

U2_PURCHASE_ID=$(echo $U2_PURCHASE | jq -r '.purchases[0].id')
echo -e "${GREEN}✅ U2 purchased course (Purchase ID: $U2_PURCHASE_ID)${NC}"
echo ""

# Step 7: Register U3 (referred by U2) and buy course
echo "Step 7: Register U3 (referred by U2)"
echo "----------------------------------------"
U3_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"User3\",
    \"email\": \"user3@test.com\",
    \"mobile\": \"9876543213\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"$U2_ID\"
  }")

U3_ID=$(echo $U3_RESPONSE | jq -r '.id')
U3_DISPLAY_ID=$(echo $U3_RESPONSE | jq -r '.display_id')

if [ "$U3_ID" == "null" ]; then
  U3_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user3@test.com\",
      \"password\": \"password123\"
    }")
  U3_TOKEN=$(echo $U3_LOGIN | jq -r '.token')
  U3_ID=$(echo $U3_LOGIN | jq -r '.user.id')
  U3_DISPLAY_ID=$(echo $U3_LOGIN | jq -r '.user.display_id')
else
  U3_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"user3@test.com\",
      \"password\": \"password123\"
    }")
  U3_TOKEN=$(echo $U3_LOGIN | jq -r '.token')
fi

echo -e "${GREEN}✅ U3 Registered: User3${NC}"
echo "User ID: $U3_ID"
echo "Display ID: $U3_DISPLAY_ID"
echo "Referrer: User2 ($U2_ID)"

# U3 buys course
echo "U3 purchasing course..."
U3_PURCHASE=$(curl -s -X POST "$BASE_URL/payments/test-purchase" \
  -H "Authorization: Bearer $U3_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"courseIds\": [\"$COURSE_ID\"]
  }")

U3_PURCHASE_ID=$(echo $U3_PURCHASE | jq -r '.purchases[0].id')
echo -e "${GREEN}✅ U3 purchased course (Purchase ID: $U3_PURCHASE_ID)${NC}"
echo ""

# Step 8: Database Verification
echo "======================================"
echo "DATABASE VERIFICATION"
echo "======================================"
echo ""

# Store user IDs for SQL queries
cat > /tmp/test_user_ids.txt <<EOF
MOHIT_ID=$MOHIT_ID
U1_ID=$U1_ID
U2_ID=$U2_ID
U3_ID=$U3_ID
COURSE_ID=$COURSE_ID
PACKAGE_ID=$PACKAGE_ID
EOF

echo "Step 8.1: Verify Purchases Table"
echo "----------------------------------------"
echo "Querying purchases table for COURSE_PURCHASE types..."
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  user_id,
  package_id,
  purchase_type,
  course_id IS NOT NULL as has_course,
  amount,
  status,
  purchased_at
FROM purchases 
WHERE course_id = '$COURSE_ID'
ORDER BY purchased_at;
" || echo "Database query failed"

echo ""
echo "Step 8.2: Verify Package Activation"
echo "----------------------------------------"
echo "Checking if packages are active for users..."
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  user_id,
  package_id,
  purchase_type,
  status,
  active_until > NOW() as is_active,
  active_until
FROM purchases 
WHERE user_id IN ($U1_ID, $U2_ID, $U3_ID)
  AND purchase_type = 'COURSE_PURCHASE'
ORDER BY user_id;
" || echo "Database query failed"

echo ""
echo "Step 8.3: Verify Spot Commissions"
echo "----------------------------------------"
echo "Checking ledger entries for spot commissions..."
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.receiver_user_id,
  u.name as receiver_name,
  le.source_user_id,
  le.commission_type,
  le.amount,
  le.credited_at,
  le.purchase_id
FROM ledger_entries le
LEFT JOIN users u ON u.id = le.receiver_user_id
WHERE le.purchase_id IN ($U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
  AND le.commission_type = 'SPOT'
ORDER BY le.purchase_id, le.credited_at;
" || echo "Database query failed"

echo ""
echo "Step 8.4: Verify All Ledger Entries"
echo "----------------------------------------"
echo "All ledger entries for these purchases:"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  le.id,
  le.receiver_user_id,
  u.name as receiver_name,
  le.commission_type,
  le.amount,
  le.purchase_id,
  le.credited_at
FROM ledger_entries le
LEFT JOIN users u ON u.id = le.receiver_user_id
WHERE le.purchase_id IN ($U1_PURCHASE_ID, $U2_PURCHASE_ID, $U3_PURCHASE_ID)
ORDER BY le.purchase_id, le.commission_type;
" || echo "Database query failed"

echo ""
echo "Step 8.5: Verify User Balances"
echo "----------------------------------------"
echo "User wallet balances:"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  ub.user_id,
  u.name,
  ub.balance,
  ub.updated_at
FROM user_balances ub
LEFT JOIN users u ON u.id = ub.user_id
WHERE ub.user_id IN ($MOHIT_ID, $U1_ID, $U2_ID, $U3_ID)
ORDER BY ub.user_id;
" || echo "Database query failed"

echo ""
echo "Step 8.6: User Hierarchy"
echo "----------------------------------------"
echo "User tree structure:"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  u.id,
  u.name,
  u.display_id,
  u.referrer_user_id,
  r.name as referrer_name
FROM users u
LEFT JOIN users r ON r.id = u.referrer_user_id
WHERE u.id IN ($MOHIT_ID, $U1_ID, $U2_ID, $U3_ID)
ORDER BY u.id;
" || echo "Database query failed"

echo ""
echo "======================================"
echo "TEST SUMMARY"
echo "======================================"
echo ""
echo -e "${GREEN}✅ Course Created:${NC} $COURSE_TITLE (ID: $COURSE_ID)"
echo -e "${GREEN}✅ Package Mapped:${NC} $PACKAGE_NAME (ID: $PACKAGE_ID)"
echo ""
echo -e "${YELLOW}User Hierarchy:${NC}"
echo "  Mohit (ID: $MOHIT_ID, Display: $MOHIT_DISPLAY_ID)"
echo "    └─ U1/Rohit (ID: $U1_ID, Display: $U1_DISPLAY_ID) → Purchased Course"
echo "        └─ U2 (ID: $U2_ID, Display: $U2_DISPLAY_ID) → Purchased Course"
echo "            └─ U3 (ID: $U3_ID, Display: $U3_DISPLAY_ID) → Purchased Course"
echo ""
echo -e "${YELLOW}Course Purchases:${NC}"
echo "  U1 Purchase ID: $U1_PURCHASE_ID"
echo "  U2 Purchase ID: $U2_PURCHASE_ID"
echo "  U3 Purchase ID: $U3_PURCHASE_ID"
echo ""
echo -e "${GREEN}✅ Test completed! Check database verification output above.${NC}"
echo ""

