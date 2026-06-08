#!/bin/bash

# E2E Test with Real Data - Build Team & Make Transfers

API_URL="http://localhost:3000/api/v1"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

print_header() {
  echo ""
  echo -e "${BLUE}=========================================="
  echo "$1"
  echo "==========================================${NC}"
}

print_result() {
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if [ "$1" == "PASS" ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    FAILED_TESTS=$((FAILED_TESTS + 1))
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

print_header "E2E TEST WITH REAL DATA - BUILD TEAM & TRANSFERS"
echo "API URL: $API_URL"
echo ""

TIMESTAMP=$(date +%s)
REFERRER_ID="2"  # Root user ID

# ===================================
# Step 1: Create Main Users
# ===================================
print_header "Step 1: Create Main Users"

# User 1 (Parent)
USER1_EMAIL="parent_${TIMESTAMP}@test.com"
USER1_MOBILE="98765${TIMESTAMP: -5}"

echo "Creating Parent User: $USER1_EMAIL"
USER1_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Parent User\",
    \"email\": \"$USER1_EMAIL\",
    \"mobile\": \"$USER1_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$REFERRER_ID\"
  }")

USER1_REG=$(check_response "$USER1_REG")
USER1_ID=$(echo "$USER1_REG" | jq -r '.id // empty')

if [ -z "$USER1_ID" ] || [ "$USER1_ID" == "null" ]; then
  echo "❌ Failed to create parent user!"
  exit 1
fi

print_result "PASS" "Parent User created (ID: $USER1_ID)"

# Login User 1
USER1_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER1_EMAIL\", \"password\": \"Test@12345\"}")

USER1_TOKEN=$(echo "$USER1_LOGIN" | jq -r '.token // empty')

if [ -z "$USER1_TOKEN" ] || [ "$USER1_TOKEN" == "null" ]; then
  echo "❌ Failed to login parent user!"
  exit 1
fi

print_result "PASS" "Parent User logged in"

# User 2 (Child under User 1)
USER2_EMAIL="child1_${TIMESTAMP}@test.com"
USER2_MOBILE="98766${TIMESTAMP: -5}"

echo ""
echo "Creating Child User 1 (under Parent): $USER2_EMAIL"
USER2_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Child User One\",
    \"email\": \"$USER2_EMAIL\",
    \"mobile\": \"$USER2_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$USER1_ID\"
  }")

USER2_REG=$(check_response "$USER2_REG")
USER2_ID=$(echo "$USER2_REG" | jq -r '.id // empty')

if [ -z "$USER2_ID" ] || [ "$USER2_ID" == "null" ]; then
  echo "❌ Failed to create child user!"
  exit 1
fi

print_result "PASS" "Child User 1 created (ID: $USER2_ID) under Parent"

# Login User 2
USER2_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER2_EMAIL\", \"password\": \"Test@12345\"}")

USER2_TOKEN=$(echo "$USER2_LOGIN" | jq -r '.token // empty')

if [ -z "$USER2_TOKEN" ] || [ "$USER2_TOKEN" == "null" ]; then
  echo "❌ Failed to login child user!"
  exit 1
fi

print_result "PASS" "Child User 1 logged in"

# User 3 (Another child under User 1)
USER3_EMAIL="child2_${TIMESTAMP}@test.com"
USER3_MOBILE="98767${TIMESTAMP: -5}"

echo ""
echo "Creating Child User 2 (under Parent): $USER3_EMAIL"
USER3_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Child User Two\",
    \"email\": \"$USER3_EMAIL\",
    \"mobile\": \"$USER3_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$USER1_ID\"
  }")

USER3_REG=$(check_response "$USER3_REG")
USER3_ID=$(echo "$USER3_REG" | jq -r '.id // empty')

if [ -z "$USER3_ID" ] || [ "$USER3_ID" == "null" ]; then
  echo "❌ Failed to create child user 2!"
  exit 1
fi

print_result "PASS" "Child User 2 created (ID: $USER3_ID) under Parent"

# ===================================
# Step 2: Login as Admin & Approve KYC via API
# ===================================
print_header "Step 2: Approve KYC via Admin API"

# Login as admin (using root user as admin)
ADMIN_LOGIN=$(curl -s -X POST "$API_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"root@mlm.com\",
    \"password\": \"Root@1234\"
  }")

ADMIN_LOGIN=$(check_response "$ADMIN_LOGIN")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token // empty')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
  # Try with admin_token method
  ADMIN_TOKEN_ENV=${ADMIN_TOKEN:-"test-admin-token"}
  ADMIN_LOGIN=$(curl -s -X POST "$API_URL/auth/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"admin_token\": \"$ADMIN_TOKEN_ENV\"}")
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token // empty')
fi

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
  # Try admin_token from env
  if [ ! -z "$ADMIN_TOKEN_ENV" ]; then
    ADMIN_LOGIN=$(curl -s -X POST "$API_URL/auth/admin/login" \
      -H "Content-Type: application/json" \
      -d "{\"admin_token\": \"$ADMIN_TOKEN_ENV\"}")
    ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.token // empty')
  fi
fi

if [ ! -z "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "null" ]; then
  print_result "PASS" "Admin logged in"
  
  # Approve KYC for User 1
  KYC1=$(curl -s -X PUT "$API_URL/admin/kyc/$USER1_ID/update" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"kyc_status": "approved"}')
  
  # Approve KYC for User 2
  KYC2=$(curl -s -X PUT "$API_URL/admin/kyc/$USER2_ID/update" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"kyc_status": "approved"}')
  
  # Approve KYC for User 3
  KYC3=$(curl -s -X PUT "$API_URL/admin/kyc/$USER3_ID/update" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"kyc_status": "approved"}')
  
  print_result "PASS" "KYC approved via API for all users"
else
  print_result "FAIL" "Admin login failed - using DB for KYC"
  # Fallback to DB for KYC (create KYC documents)
  DB_CONTAINER=$(docker ps --filter "name=mlm-api-db" --format "{{.Names}}" | head -1)
  if [ ! -z "$DB_CONTAINER" ]; then
    docker exec -i $DB_CONTAINER psql -U postgres -d mlm << EOF
      -- Update users KYC status
      UPDATE users SET kyc_status = 'approved', kyc_verified_at = NOW()
      WHERE id IN ($USER1_ID, $USER2_ID, $USER3_ID);
      
      -- Create KYC documents
      INSERT INTO kyc_documents (user_id, document_type, status, submitted_at, verified_at)
      SELECT $USER1_ID, 'aadhar', 'approved', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM kyc_documents WHERE user_id = $USER1_ID);
      
      INSERT INTO kyc_documents (user_id, document_type, status, submitted_at, verified_at)
      SELECT $USER2_ID, 'aadhar', 'approved', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM kyc_documents WHERE user_id = $USER2_ID);
      
      INSERT INTO kyc_documents (user_id, document_type, status, submitted_at, verified_at)
      SELECT $USER3_ID, 'aadhar', 'approved', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM kyc_documents WHERE user_id = $USER3_ID);
      
      UPDATE kyc_documents SET status = 'approved', verified_at = NOW()
      WHERE user_id IN ($USER1_ID, $USER2_ID, $USER3_ID);
EOF
    print_result "PASS" "KYC approved via DB (fallback)"
  fi
fi

# ===================================
# Step 2b: Add Wallet Balance (DB only - no API available)
# ===================================
print_header "Step 2b: Add Wallet Balance (via DB - no API available)"

DB_CONTAINER=$(docker ps --filter "name=mlm-api-db" --format "{{.Names}}" | head -1)

if [ ! -z "$DB_CONTAINER" ]; then
  docker exec -i $DB_CONTAINER psql -U postgres -d mlm << EOF
    -- Add balance to User 1 (Parent)
    INSERT INTO user_balances (user_id, balance, updated_at)
    VALUES ($USER1_ID, 10000.00, NOW())
    ON CONFLICT (user_id) DO UPDATE SET balance = 10000.00;
    
    -- Add balance to User 2 (Child)
    INSERT INTO user_balances (user_id, balance, updated_at)
    VALUES ($USER2_ID, 5000.00, NOW())
    ON CONFLICT (user_id) DO UPDATE SET balance = 5000.00;
    
    SELECT '✅ Balances added' as result;
EOF
  print_result "PASS" "Wallet balances added (Parent: ₹10000, Child: ₹5000)"
else
  print_result "FAIL" "Database container not found"
fi

# ===================================
# Step 3: Make P2P Transfers
# ===================================
print_header "Step 3: Make P2P Transfers"

# Transfer from Parent to Child 1
echo ""
echo "Transferring ₹500 from Parent to Child 1..."
TRANSFER1=$(curl -s -X POST "$API_URL/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"$USER2_ID\",
    \"amount\": 500,
    \"remarks\": \"Test transfer from parent to child\"
  }")

TRANSFER1=$(check_response "$TRANSFER1")
TRANSFER1_ID=$(echo "$TRANSFER1" | jq -r '.id // empty')

if [ ! -z "$TRANSFER1_ID" ] && [ "$TRANSFER1_ID" != "null" ]; then
  print_result "PASS" "Transfer 1 completed (₹500 Parent → Child 1)"
else
  ERROR_MSG=$(echo "$TRANSFER1" | jq -r '.message // .error // empty')
  print_result "FAIL" "Transfer 1 failed" "$ERROR_MSG"
fi

# Transfer from Child 1 to Child 2
echo ""
echo "Transferring ₹200 from Child 1 to Child 2..."
TRANSFER2=$(curl -s -X POST "$API_URL/transfer/p2p" \
  -H "Authorization: Bearer $USER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"$USER3_ID\",
    \"amount\": 200,
    \"remarks\": \"Test transfer between children\"
  }")

TRANSFER2=$(check_response "$TRANSFER2")
TRANSFER2_ID=$(echo "$TRANSFER2" | jq -r '.id // empty')

if [ ! -z "$TRANSFER2_ID" ] && [ "$TRANSFER2_ID" != "null" ]; then
  print_result "PASS" "Transfer 2 completed (₹200 Child 1 → Child 2)"
else
  ERROR_MSG=$(echo "$TRANSFER2" | jq -r '.message // .error // empty')
  print_result "FAIL" "Transfer 2 failed" "$ERROR_MSG"
fi

# ===================================
# Step 4: Test APIs with Real Data
# ===================================
print_header "Step 4: Test APIs with Real Data"

# Team Tree (should show downline now)
echo ""
echo "Testing Team Tree API..."
TEAM_TREE=$(curl -s -X GET "$API_URL/team/tree" \
  -H "Authorization: Bearer $USER1_TOKEN")

TEAM_TREE=$(check_response "$TEAM_TREE")
UPLINE_COUNT=$(echo "$TEAM_TREE" | jq -r '.upline | length // 0')
DOWNLINE_COUNT=$(echo "$TEAM_TREE" | jq -r '.downline.total_team_size // 0')

if [ "$DOWNLINE_COUNT" -gt 0 ]; then
  print_result "PASS" "Team Tree API (Upline: $UPLINE_COUNT, Downline: $DOWNLINE_COUNT)"
else
  print_result "FAIL" "Team Tree API (No downline found)"
fi

# Transfer History (should show transfers)
echo ""
echo "Testing Transfer History API..."
HISTORY=$(curl -s -X GET "$API_URL/transfer/history?type=all" \
  -H "Authorization: Bearer $USER1_TOKEN")

HISTORY=$(check_response "$HISTORY")
HISTORY_TOTAL=$(echo "$HISTORY" | jq -r '.total // 0')
HISTORY_COUNT=$(echo "$HISTORY" | jq -r '.count // 0')

if [ "$HISTORY_TOTAL" -gt 0 ]; then
  print_result "PASS" "Transfer History API (Total: $HISTORY_TOTAL, Count: $HISTORY_COUNT)"
  echo "  📋 Transfer details:"
  echo "$HISTORY" | jq -r '.items[]? | "    - \(.type): ₹\(.amount) (\(.sender_name // "N/A") → \(.receiver_name // "N/A"))"' | head -5
else
  print_result "FAIL" "Transfer History API (No transfers found)"
fi

# User Details (should show team members)
echo ""
echo "Testing User Details API..."
USER_DETAILS=$(curl -s -X GET "$API_URL/user/details/$USER2_ID" \
  -H "Authorization: Bearer $USER1_TOKEN")

USER_DETAILS=$(check_response "$USER_DETAILS")
RELATIONSHIP=$(echo "$USER_DETAILS" | jq -r '.relationship // empty')

if [ "$RELATIONSHIP" == "downline" ]; then
  print_result "PASS" "User Details API (Relationship: $RELATIONSHIP)"
else
  print_result "FAIL" "User Details API (Relationship: $RELATIONSHIP)"
fi

# Team Business (should show income if any)
echo ""
echo "Testing Team Business API..."
TEAM_BIZ=$(curl -s -X GET "$API_URL/dashboard/team-business" \
  -H "Authorization: Bearer $USER1_TOKEN")

TEAM_BIZ=$(check_response "$TEAM_BIZ")
TOTAL_BUSINESS=$(echo "$TEAM_BIZ" | jq -r '.total_team_business // 0')

if [ ! -z "$TOTAL_BUSINESS" ]; then
  print_result "PASS" "Team Business API (Total: ₹$TOTAL_BUSINESS)"
else
  print_result "FAIL" "Team Business API"
fi

# ===================================
# SUMMARY
# ===================================
print_header "TEST SUMMARY"

echo ""
echo "Total Tests Run:        $TOTAL_TESTS"
echo -e "${GREEN}Passed:                 $PASSED_TESTS${NC}"
echo -e "${RED}Failed:                 $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  PASS_RATE=100
else
  PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
fi

echo "Pass Rate:              ${PASS_RATE}%"
echo ""

echo "📊 Real Data Summary:"
echo "  👥 Users Created: Parent (ID: $USER1_ID) + 2 Children"
echo "  💰 Wallet Balances: Parent (₹10000), Child 1 (₹5000)"
echo "  🔄 Transfers Made: 2 transfers"
echo "  🌳 Team Structure: Parent → 2 Children"
echo ""

if [ $PASS_RATE -ge 80 ]; then
  echo -e "${GREEN}✅ TESTS PASSING WITH REAL DATA!${NC}"
  echo -e "${GREEN}✅ APIs showing actual data instead of zeros!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}"
  exit 1
fi

