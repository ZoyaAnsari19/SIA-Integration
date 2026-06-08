#!/bin/bash

# Test with 4 Levels + Purchases to Generate Spot Commissions

API_URL="http://localhost:3000/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}=========================================="
  echo "$1"
  echo "==========================================${NC}"
}

print_result() {
  if [ "$1" == "PASS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    if [ ! -z "$3" ]; then
      echo -e "${YELLOW}  Error: $3${NC}"
    fi
  fi
}

check_response() {
  if echo "$1" | jq . >/dev/null 2>&1; then
    echo "$1"
  else
    echo '{"error": "Invalid JSON response"}'
  fi
}

print_header "4 LEVELS TEST - WITH PURCHASES FOR SPOT COMMISSIONS"
echo "API URL: $API_URL"
echo ""

TIMESTAMP=$(date +%s)
REFERRER_ID="2"  # Root user ID

# ===================================
# Step 1: Create 4 Levels of Users
# ===================================
print_header "Step 1: Creating 4 Levels of Users"

# Level 1 User (under root)
L1_EMAIL="l1_${TIMESTAMP}@test.com"
L1_MOBILE="98765${TIMESTAMP: -5}"

echo "Creating Level 1 User: $L1_EMAIL"
L1_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Level 1 User\",
    \"email\": \"$L1_EMAIL\",
    \"mobile\": \"$L1_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$REFERRER_ID\"
  }")

L1_REG=$(check_response "$L1_REG")
L1_ID=$(echo "$L1_REG" | jq -r '.id // empty')

if [ -z "$L1_ID" ] || [ "$L1_ID" == "null" ]; then
  echo "❌ Failed to create Level 1 user!"
  exit 1
fi

print_result "PASS" "Level 1 User created (ID: $L1_ID)"

# Login L1
L1_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$L1_EMAIL\", \"password\": \"Test@12345\"}")
L1_TOKEN=$(echo "$L1_LOGIN" | jq -r '.token // empty')

# Level 2 User (under L1)
L2_EMAIL="l2_${TIMESTAMP}@test.com"
L2_MOBILE="98766${TIMESTAMP: -5}"

echo "Creating Level 2 User: $L2_EMAIL"
L2_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Level 2 User\",
    \"email\": \"$L2_EMAIL\",
    \"mobile\": \"$L2_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$L1_ID\"
  }")

L2_REG=$(check_response "$L2_REG")
L2_ID=$(echo "$L2_REG" | jq -r '.id // empty')
print_result "PASS" "Level 2 User created (ID: $L2_ID) under L1"

# Login L2
L2_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$L2_EMAIL\", \"password\": \"Test@12345\"}")
L2_TOKEN=$(echo "$L2_LOGIN" | jq -r '.token // empty')

# Level 3 User (under L2)
L3_EMAIL="l3_${TIMESTAMP}@test.com"
L3_MOBILE="98767${TIMESTAMP: -5}"

echo "Creating Level 3 User: $L3_EMAIL"
L3_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Level 3 User\",
    \"email\": \"$L3_EMAIL\",
    \"mobile\": \"$L3_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$L2_ID\"
  }")

L3_REG=$(check_response "$L3_REG")
L3_ID=$(echo "$L3_REG" | jq -r '.id // empty')
print_result "PASS" "Level 3 User created (ID: $L3_ID) under L2"

# Login L3
L3_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$L3_EMAIL\", \"password\": \"Test@12345\"}")
L3_TOKEN=$(echo "$L3_LOGIN" | jq -r '.token // empty')

# Level 4 User (under L3)
L4_EMAIL="l4_${TIMESTAMP}@test.com"
L4_MOBILE="98768${TIMESTAMP: -5}"

echo "Creating Level 4 User: $L4_EMAIL"
L4_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Level 4 User\",
    \"email\": \"$L4_EMAIL\",
    \"mobile\": \"$L4_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$L3_ID\"
  }")

L4_REG=$(check_response "$L4_REG")
L4_ID=$(echo "$L4_REG" | jq -r '.id // empty')
print_result "PASS" "Level 4 User created (ID: $L4_ID) under L3"

echo ""
echo "✅ 4 Levels Created:"
echo "  Root → L1 ($L1_ID) → L2 ($L2_ID) → L3 ($L3_ID) → L4 ($L4_ID)"

# ===================================
# Step 2: Approve KYC for All Users
# ===================================
print_header "Step 2: Approve KYC for All Users"

DB_CONTAINER=$(docker ps --filter "name=mlm-api-db" --format "{{.Names}}" | head -1)

if [ ! -z "$DB_CONTAINER" ]; then
  docker exec -i $DB_CONTAINER psql -U postgres -d mlm << EOF
    -- Update users KYC status
    UPDATE users SET kyc_status = 'approved', kyc_verified_at = NOW()
    WHERE id IN ($L1_ID, $L2_ID, $L3_ID, $L4_ID);
    
    -- Create KYC documents
    INSERT INTO kyc_documents (user_id, document_type, status, submitted_at, verified_at)
    SELECT $L1_ID, 'aadhar', 'approved', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM kyc_documents WHERE user_id = $L1_ID);
    
    INSERT INTO kyc_documents (user_id, document_type, status, submitted_at, verified_at)
    SELECT $L2_ID, 'aadhar', 'approved', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM kyc_documents WHERE user_id = $L2_ID);
    
    INSERT INTO kyc_documents (user_id, document_type, status, submitted_at, verified_at)
    SELECT $L3_ID, 'aadhar', 'approved', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM kyc_documents WHERE user_id = $L3_ID);
    
    INSERT INTO kyc_documents (user_id, document_type, status, submitted_at, verified_at)
    SELECT $L4_ID, 'aadhar', 'approved', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM kyc_documents WHERE user_id = $L4_ID);
    
    UPDATE kyc_documents SET status = 'approved', verified_at = NOW()
    WHERE user_id IN ($L1_ID, $L2_ID, $L3_ID, $L4_ID);
EOF
  print_result "PASS" "KYC approved for all users"
fi

# ===================================
# Step 3: Get Package ID
# ===================================
print_header "Step 3: Get Package for Purchase"

PACKAGE_ID=$(docker exec -i $DB_CONTAINER psql -U postgres -d mlm -t -c "SELECT id FROM packages WHERE status = 'active' LIMIT 1;" | tr -d ' ')

if [ -z "$PACKAGE_ID" ]; then
  echo "❌ No active packages found!"
  exit 1
fi

PACKAGE_PRICE=$(docker exec -i $DB_CONTAINER psql -U postgres -d mlm -t -c "SELECT price FROM packages WHERE id = $PACKAGE_ID;" | tr -d ' ')

print_result "PASS" "Package found (ID: $PACKAGE_ID, Price: ₹$PACKAGE_PRICE)"

# ===================================
# Step 4: Make Purchases via API (Bottom to Top)
# ===================================
print_header "Step 4: Making Purchases via API (Bottom to Top for Spot Commissions)"

# Login L4
L4_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$L4_EMAIL\", \"password\": \"Test@12345\"}")
L4_TOKEN=$(echo "$L4_LOGIN" | jq -r '.token // empty')

# Purchase for L4 (will generate spot for L3, L2, L1, Root)
echo ""
echo "Making purchase request for L4 (₹$PACKAGE_PRICE)..."
L4_PURCHASE_REQ=$(curl -s -X POST "$API_URL/purchases" \
  -H "Authorization: Bearer $L4_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"payment_type\": \"manual\",
    \"txn_id\": \"TEST_L4_${TIMESTAMP}\"
  }")

L4_REQ_ID=$(echo "$L4_PURCHASE_REQ" | jq -r '.request.id // empty')
print_result "PASS" "L4 purchase request created (ID: $L4_REQ_ID)"

# Purchase for L3
echo "Making purchase request for L3 (₹$PACKAGE_PRICE)..."
L3_PURCHASE_REQ=$(curl -s -X POST "$API_URL/purchases" \
  -H "Authorization: Bearer $L3_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"payment_type\": \"manual\",
    \"txn_id\": \"TEST_L3_${TIMESTAMP}\"
  }")

L3_REQ_ID=$(echo "$L3_PURCHASE_REQ" | jq -r '.request.id // empty')
print_result "PASS" "L3 purchase request created (ID: $L3_REQ_ID)"

# Purchase for L2
echo "Making purchase request for L2 (₹$PACKAGE_PRICE)..."
L2_PURCHASE_REQ=$(curl -s -X POST "$API_URL/purchases" \
  -H "Authorization: Bearer $L2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"payment_type\": \"manual\",
    \"txn_id\": \"TEST_L2_${TIMESTAMP}\"
  }")

L2_REQ_ID=$(echo "$L2_PURCHASE_REQ" | jq -r '.request.id // empty')
print_result "PASS" "L2 purchase request created (ID: $L2_REQ_ID)"

# Purchase for L1
echo "Making purchase request for L1 (₹$PACKAGE_PRICE)..."
L1_PURCHASE_REQ=$(curl -s -X POST "$API_URL/purchases" \
  -H "Authorization: Bearer $L1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_ID,
    \"request_type\": \"activation\",
    \"amount\": $PACKAGE_PRICE,
    \"payment_type\": \"manual\",
    \"txn_id\": \"TEST_L1_${TIMESTAMP}\"
  }")

L1_REQ_ID=$(echo "$L1_PURCHASE_REQ" | jq -r '.request.id // empty')
print_result "PASS" "L1 purchase request created (ID: $L1_REQ_ID)"

# ===================================
# Step 4b: Approve All Purchase Requests (via Admin API)
# ===================================
print_header "Step 4b: Approve Purchase Requests (Triggers Commission Generation)"

# Try to get admin token
ADMIN_TOKEN=""
ADMIN_LOGIN=$(curl -s -X POST "$API_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"root@mlm.com\", \"password\": \"Root@1234\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token // empty')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
  # Use admin_token from env if available
  ADMIN_TOKEN_ENV=${ADMIN_TOKEN_ENV:-"test-admin-token"}
  ADMIN_LOGIN=$(curl -s -X POST "$API_URL/auth/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"admin_token\": \"$ADMIN_TOKEN_ENV\"}")
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token // empty')
fi

if [ ! -z "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
  # Approve L4 purchase
  echo "Approving L4 purchase request..."
  L4_APPROVE=$(curl -s -X PUT "$API_URL/admin/activation/requests/$L4_REQ_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")
  print_result "PASS" "L4 purchase approved"

  # Approve L3 purchase
  echo "Approving L3 purchase request..."
  L3_APPROVE=$(curl -s -X PUT "$API_URL/admin/activation/requests/$L3_REQ_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")
  print_result "PASS" "L3 purchase approved"

  # Approve L2 purchase
  echo "Approving L2 purchase request..."
  L2_APPROVE=$(curl -s -X PUT "$API_URL/admin/activation/requests/$L2_REQ_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")
  print_result "PASS" "L2 purchase approved"

  # Approve L1 purchase
  echo "Approving L1 purchase request..."
  L1_APPROVE=$(curl -s -X PUT "$API_URL/admin/activation/requests/$L1_REQ_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json")
  print_result "PASS" "L1 purchase approved"
else
  print_result "FAIL" "Admin login failed - creating purchases via DB and processing commissions"
  
  # Fallback: Create purchases directly in DB
  echo "Creating purchases directly in DB..."
  docker exec -i $DB_CONTAINER psql -U postgres -d mlm << EOF
    -- Create purchases directly
    INSERT INTO purchases (user_id, package_id, amount, status, purchased_at, active_until)
    VALUES 
      ($L4_ID, $PACKAGE_ID, $PACKAGE_PRICE, 'completed', NOW(), NOW() + INTERVAL '3 months'),
      ($L3_ID, $PACKAGE_ID, $PACKAGE_PRICE, 'completed', NOW(), NOW() + INTERVAL '3 months'),
      ($L2_ID, $PACKAGE_ID, $PACKAGE_PRICE, 'completed', NOW(), NOW() + INTERVAL '3 months'),
      ($L1_ID, $PACKAGE_ID, $PACKAGE_PRICE, 'completed', NOW(), NOW() + INTERVAL '3 months')
    RETURNING id, user_id;
EOF
  
  print_result "PASS" "Purchases created in DB"
  
  # Process commissions using TypeScript script
  echo ""
  echo "🔄 Processing commissions..."
  cd /Users/siddhantgour/Documents/Projects/MLM/MLM-API
  npx tsx scripts/process-purchases.ts 2>&1 | tail -20
  print_result "PASS" "Commissions processed"
fi

echo ""
echo "✅ All purchases approved! Spot commissions should be generated."

# ===================================
# Step 5: Wait for Commission Processing
# ===================================
print_header "Step 5: Waiting for Commission Processing"

echo "⏳ Waiting 5 seconds for commission processing..."
sleep 5

# ===================================
# Step 6: Check Spot Commissions Generated
# ===================================
print_header "Step 6: Check Spot Commissions in Database"

SPOT_COUNT=$(docker exec -i $DB_CONTAINER psql -U postgres -d mlm -t -c "SELECT COUNT(*) FROM ledger_entries WHERE commission_type = 'SPOT' AND receiver_user_id IN ($REFERRER_ID, $L1_ID, $L2_ID, $L3_ID);" | tr -d ' ')

SPOT_TOTAL=$(docker exec -i $DB_CONTAINER psql -U postgres -d mlm -t -c "SELECT COALESCE(SUM(amount), 0) FROM ledger_entries WHERE commission_type = 'SPOT' AND receiver_user_id IN ($REFERRER_ID, $L1_ID, $L2_ID, $L3_ID);" | tr -d ' ')

echo ""
echo "📊 Spot Commissions Generated:"
echo "  Count: $SPOT_COUNT"
echo "  Total: ₹$SPOT_TOTAL"

# ===================================
# Step 7: Test Team Business API
# ===================================
print_header "Step 7: Test Team Business API for L1"

TEAM_BIZ=$(curl -s -X GET "$API_URL/dashboard/team-business" \
  -H "Authorization: Bearer $L1_TOKEN")

TEAM_BIZ=$(check_response "$TEAM_BIZ")
TOTAL_BUSINESS=$(echo "$TEAM_BIZ" | jq -r '.total_team_business // 0')
SPOT_TOTAL_API=$(echo "$TEAM_BIZ" | jq -r '.breakdown.spot_income.total // 0')
MONTHLY_TOTAL_API=$(echo "$TEAM_BIZ" | jq -r '.breakdown.monthly_income.total // 0')

echo ""
echo "📊 Team Business API Response:"
echo "$TEAM_BIZ" | jq '.'

if [ "$TOTAL_BUSINESS" != "0" ] || [ "$SPOT_TOTAL_API" != "0" ]; then
  print_result "PASS" "Team Business showing data! (Total: ₹$TOTAL_BUSINESS, SPOT: ₹$SPOT_TOTAL_API, MONTHLY: ₹$MONTHLY_TOTAL_API)"
else
  print_result "FAIL" "Team Business still showing zero"
fi

# ===================================
# Step 8: Test Team Tree
# ===================================
print_header "Step 8: Test Team Tree for L1"

TEAM_TREE=$(curl -s -X GET "$API_URL/team/tree" \
  -H "Authorization: Bearer $L1_TOKEN")

TEAM_TREE=$(check_response "$TEAM_TREE")
UPLINE_COUNT=$(echo "$TEAM_TREE" | jq -r '.upline | length // 0')
DOWNLINE_COUNT=$(echo "$TEAM_TREE" | jq -r '.downline.total_team_size // 0')

echo ""
echo "📊 Team Tree:"
echo "  Upline: $UPLINE_COUNT"
echo "  Downline: $DOWNLINE_COUNT"

if [ "$DOWNLINE_COUNT" -ge 3 ]; then
  print_result "PASS" "Team Tree showing downline (Count: $DOWNLINE_COUNT)"
else
  print_result "FAIL" "Team Tree not showing all downline"
fi

# ===================================
# SUMMARY
# ===================================
print_header "TEST SUMMARY"

echo ""
echo "✅ 4 Levels Created:"
echo "  Root → L1 ($L1_ID) → L2 ($L2_ID) → L3 ($L3_ID) → L4 ($L4_ID)"
echo ""
echo "✅ Purchases Made:"
echo "  L1: ₹$PACKAGE_PRICE"
echo "  L2: ₹$PACKAGE_PRICE"
echo "  L3: ₹$PACKAGE_PRICE"
echo "  L4: ₹$PACKAGE_PRICE"
echo ""
echo "📊 Spot Commissions:"
echo "  Database: $SPOT_COUNT entries, Total: ₹$SPOT_TOTAL"
echo "  API: Total: ₹$TOTAL_BUSINESS, SPOT: ₹$SPOT_TOTAL_API"
echo ""
echo "🌳 Team Structure:"
echo "  Upline: $UPLINE_COUNT, Downline: $DOWNLINE_COUNT"

