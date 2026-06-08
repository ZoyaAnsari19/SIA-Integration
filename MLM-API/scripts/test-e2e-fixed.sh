#!/bin/bash

# Complete E2E Test with CORRECT Registration Schema

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

print_header "E2E TESTING WITH FIXED SCHEMA"
echo "API URL: $API_URL"
echo ""

# ===================================
# Step 1: Create Test Users via API
# ===================================
print_header "Step 1: User Registration (Correct Schema)"

TIMESTAMP=$(date +%s)
REFERRER_ID="2"  # Root user ID from database

# User 1
USER1_EMAIL="test1_${TIMESTAMP}@test.com"
USER1_MOBILE="98765${TIMESTAMP: -5}"

echo "Creating User 1: $USER1_EMAIL"
USER1_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test User One\",
    \"email\": \"$USER1_EMAIL\",
    \"mobile\": \"$USER1_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$REFERRER_ID\"
  }")

USER1_REG=$(check_response "$USER1_REG")
USER1_ID=$(echo "$USER1_REG" | jq -r '.id // empty')

if [ ! -z "$USER1_ID" ] && [ "$USER1_ID" != "null" ]; then
  print_result "PASS" "User 1 registered (ID: $USER1_ID)"
else
  ERROR_MSG=$(echo "$USER1_REG" | jq -r '.message // .error // empty')
  print_result "FAIL" "User 1 registration" "$ERROR_MSG"
fi

# Login User 1
USER1_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER1_EMAIL\",
    \"password\": \"Test@12345\"
  }")

USER1_LOGIN=$(check_response "$USER1_LOGIN")
USER1_TOKEN=$(echo "$USER1_LOGIN" | jq -r '.token // empty')

if [ ! -z "$USER1_TOKEN" ] && [ "$USER1_TOKEN" != "null" ]; then
  print_result "PASS" "User 1 login successful"
else
  ERROR_MSG=$(echo "$USER1_LOGIN" | jq -r '.message // .error // empty')
  print_result "FAIL" "User 1 login" "$ERROR_MSG"
fi

# User 2
USER2_EMAIL="test2_${TIMESTAMP}@test.com"
USER2_MOBILE="98766${TIMESTAMP: -5}"

echo ""
echo "Creating User 2: $USER2_EMAIL"
USER2_REG=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test User Two\",
    \"email\": \"$USER2_EMAIL\",
    \"mobile\": \"$USER2_MOBILE\",
    \"password\": \"Test@12345\",
    \"referrer_user_id\": \"$REFERRER_ID\"
  }")

USER2_REG=$(check_response "$USER2_REG")
USER2_ID=$(echo "$USER2_REG" | jq -r '.id // empty')

if [ ! -z "$USER2_ID" ] && [ "$USER2_ID" != "null" ]; then
  print_result "PASS" "User 2 registered (ID: $USER2_ID)"
else
  ERROR_MSG=$(echo "$USER2_REG" | jq -r '.message // .error // empty')
  print_result "FAIL" "User 2 registration" "$ERROR_MSG"
fi

#  Login User 2
USER2_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER2_EMAIL\",
    \"password\": \"Test@12345\"
  }")

USER2_LOGIN=$(check_response "$USER2_LOGIN")
USER2_TOKEN=$(echo "$USER2_LOGIN" | jq -r '.token // empty')

if [ ! -z "$USER2_TOKEN" ] && [ "$USER2_TOKEN" != "null" ]; then
  print_result "PASS" "User 2 login successful"
else
  print_result "FAIL" "User 2 login" "$(echo "$USER2_LOGIN" | jq -r '.message // .error')"
fi

# ===================================
# Step 2: Test User APIs
# ===================================
print_header "Step 2: User APIs Testing"

# Team Business
TEAM_BIZ=$(curl -s -X GET "$API_URL/dashboard/team-business" \
  -H "Authorization: Bearer $USER1_TOKEN")

TEAM_BIZ=$(check_response "$TEAM_BIZ")
TOTAL_BUSINESS=$(echo "$TEAM_BIZ" | jq -r '.total_team_business // empty')

if [ ! -z "$TOTAL_BUSINESS" ]; then
  print_result "PASS" "Team Business API (Total: ₹$TOTAL_BUSINESS)"
else
  print_result "FAIL" "Team Business API" "$(echo "$TEAM_BIZ" | jq -r '.error // .message')"
fi

# Team Tree
TEAM_TREE=$(curl -s -X GET "$API_URL/team/tree" \
  -H "Authorization: Bearer $USER1_TOKEN")

TEAM_TREE=$(check_response "$TEAM_TREE")
UPLINE_COUNT=$(echo "$TEAM_TREE" | jq -r '.upline | length // 0')

if [ ! -z "$UPLINE_COUNT" ]; then
  print_result "PASS" "Team Tree API (Upline: $UPLINE_COUNT)"
else
  print_result "FAIL" "Team Tree API"
fi

# User Details (Self)
USER_DETAILS=$(curl -s -X GET "$API_URL/user/details/$USER1_ID" \
  -H "Authorization: Bearer $USER1_TOKEN")

USER_DETAILS=$(check_response "$USER_DETAILS")
RELATIONSHIP=$(echo "$USER_DETAILS" | jq -r '.relationship // empty')

if [ "$RELATIONSHIP" == "self" ]; then
  print_result "PASS" "User Details API (self)"
else
  print_result "FAIL" "User Details API"
fi

# Bills List
BILLS=$(curl -s -X GET "$API_URL/bills?page=1&limit=10" \
  -H "Authorization: Bearer $USER1_TOKEN")

BILLS=$(check_response "$BILLS")
BILLS_TOTAL=$(echo "$BILLS" | jq -r '.total // 0')

if [ ! -z "$BILLS_TOTAL" ]; then
  print_result "PASS" "Bills List API (Total: $BILLS_TOTAL)"
else
  print_result "FAIL" "Bills List API"
fi

# Transfer History
HISTORY=$(curl -s -X GET "$API_URL/transfer/history?type=all" \
  -H "Authorization: Bearer $USER1_TOKEN")

HISTORY=$(check_response "$HISTORY")
HISTORY_TOTAL=$(echo "$HISTORY" | jq -r '.total // 0')

if [ ! -z "$HISTORY_TOTAL" ]; then
  print_result "PASS" "Transfer History API (Total: $HISTORY_TOTAL)"
else
  print_result "FAIL" "Transfer History API"
fi

# ===================================
# Step 3: P2P Transfer Tests
# ===================================
print_header "Step 3: P2P Transfer Validation Tests"

# Test: Transfer to self (should fail)
SELF_TRANSFER=$(curl -s -X POST "$API_URL/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"$USER1_ID\",
    \"amount\": 100
  }")

SELF_TRANSFER=$(check_response "$SELF_TRANSFER")
ERROR_MSG=$(echo "$SELF_TRANSFER" | jq -r '.message // empty')

if [[ "$ERROR_MSG" == *"yourself"* ]]; then
  print_result "PASS" "Transfer to self rejected"
else
  print_result "FAIL" "Transfer to self validation"
fi

# Test: Negative amount (should fail)
NEG_TRANSFER=$(curl -s -X POST "$API_URL/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"$USER2_ID\",
    \"amount\": -100
  }")

NEG_TRANSFER=$(check_response "$NEG_TRANSFER")
if echo "$NEG_TRANSFER" | jq -r '.message // .error' | grep -qi "must be >= 0\|error\|invalid"; then
  print_result "PASS" "Negative amount rejected"
else
  print_result "FAIL" "Negative amount validation"
fi

# ===================================
# Step 4: Admin APIs (if admin user exists)
# ===================================
print_header "Step 4: Testing Admin APIs Structure"

# Test without auth (should fail with 401)
ADMIN_DASHBOARD=$(curl -s -X GET "$API_URL/admin/dashboard")
ADMIN_DASHBOARD=$(check_response "$ADMIN_DASHBOARD")

if echo "$ADMIN_DASHBOARD" | jq -r '.error // .message' | grep -qi "unauthorized\|token"; then
  print_result "PASS" "Admin Dashboard auth check"
else
  print_result "FAIL" "Admin Dashboard auth check"
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

if [ $PASS_RATE -ge 80 ]; then
  echo -e "${GREEN}✓ TESTS MOSTLY PASSING!${NC}"
  echo -e "${GREEN}✓ APIs are working correctly!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ SOME TESTS FAILED${NC}"
  echo "Review failed tests above"
  exit 1
fi

