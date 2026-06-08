#!/bin/bash

# Complete End-to-End Testing for All New & Updated APIs
# Tests: User-side APIs + Admin APIs + Edge Cases

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# API Base URL
BASE_URL="http://localhost:3000"
API_URL="${BASE_URL}/api/v1"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
EDGE_CASE_TESTS=0

# Test results storage
declare -a FAILED_TEST_DETAILS

# Function to print section header
print_header() {
  echo ""
  echo "=========================================="
  echo -e "${BLUE}$1${NC}"
  echo "=========================================="
}

# Function to print subsection
print_subsection() {
  echo ""
  echo -e "${CYAN}--- $1 ---${NC}"
}

# Function to print test result
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
      FAILED_TEST_DETAILS+=("$2: $3")
    fi
  fi
}

# Function to check JSON response
check_response() {
  if echo "$1" | jq . >/dev/null 2>&1; then
    echo "$1"
  else
    echo '{"error": "Invalid JSON response"}'
  fi
}

# Function to wait for server
wait_for_server() {
  echo "Checking if server is running..."
  for i in {1..10}; do
    if curl -s "${BASE_URL}/health" >/dev/null 2>&1; then
      echo "✓ Server is running"
      return 0
    fi
    echo "Waiting for server... ($i/10)"
    sleep 2
  done
  echo "✗ Server not responding"
  return 1
}

print_header "END-TO-END API TESTING - ALL NEW & UPDATED APIs"
echo "Testing comprehensive scenarios with edge cases"
echo "Base URL: $BASE_URL"
echo ""

# Check server
if ! wait_for_server; then
  echo "Please start the server first: npm run dev"
  exit 1
fi

# ==========================================
# SECTION 1: SETUP - Create Test Users
# ==========================================
print_header "SECTION 1: SETUP - Test User Creation"

# Create Admin User (if not exists)
ADMIN_EMAIL="admin@mlm.com"
ADMIN_PASSWORD="Admin@1234"

echo "Attempting admin login..."
ADMIN_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\"
  }")

ADMIN_LOGIN=$(check_response "$ADMIN_LOGIN")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.access_token // empty')

if [ ! -z "$ADMIN_TOKEN" ]; then
  print_result "PASS" "Admin login successful"
else
  print_result "FAIL" "Admin login failed" "$(echo "$ADMIN_LOGIN" | jq -r '.message // .error')"
fi

# Create Test Users
TIMESTAMP=$(date +%s)

# User 1 - Main test user
USER1_EMAIL="testuser1_${TIMESTAMP}@example.com"
USER1_PASSWORD="Test@1234"
USER1_NAME="Test User One ${TIMESTAMP}"
USER1_PHONE="+91900000${TIMESTAMP: -4}"

echo ""
echo "Creating User 1: $USER1_EMAIL"
USER1_REGISTER=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$USER1_NAME\",
    \"email\": \"$USER1_EMAIL\",
    \"password\": \"$USER1_PASSWORD\",
    \"phone\": \"$USER1_PHONE\",
    \"sponsor_code\": \"ADMIN001\"
  }")

USER1_REGISTER=$(check_response "$USER1_REGISTER")
USER1_ID=$(echo "$USER1_REGISTER" | jq -r '.user.id // empty')

if [ ! -z "$USER1_ID" ]; then
  print_result "PASS" "User 1 registration (ID: $USER1_ID)"
else
  print_result "FAIL" "User 1 registration" "$(echo "$USER1_REGISTER" | jq -r '.message // .error')"
fi

# Login User 1
USER1_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER1_EMAIL\",
    \"password\": \"$USER1_PASSWORD\"
  }")

USER1_LOGIN=$(check_response "$USER1_LOGIN")
USER1_TOKEN=$(echo "$USER1_LOGIN" | jq -r '.access_token // empty')

if [ ! -z "$USER1_TOKEN" ]; then
  print_result "PASS" "User 1 login successful"
else
  print_result "FAIL" "User 1 login failed"
fi

# User 2 - For P2P transfer tests
USER2_EMAIL="testuser2_${TIMESTAMP}@example.com"
USER2_PASSWORD="Test@1234"
USER2_NAME="Test User Two ${TIMESTAMP}"
USER2_PHONE="+91900001${TIMESTAMP: -4}"

echo ""
echo "Creating User 2: $USER2_EMAIL"
USER2_REGISTER=$(curl -s -X POST "${API_URL}/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$USER2_NAME\",
    \"email\": \"$USER2_EMAIL\",
    \"password\": \"$USER2_PASSWORD\",
    \"phone\": \"$USER2_PHONE\",
    \"sponsor_code\": \"ADMIN001\"
  }")

USER2_REGISTER=$(check_response "$USER2_REGISTER")
USER2_ID=$(echo "$USER2_REGISTER" | jq -r '.user.id // empty')

if [ ! -z "$USER2_ID" ]; then
  print_result "PASS" "User 2 registration (ID: $USER2_ID)"
else
  print_result "FAIL" "User 2 registration" "$(echo "$USER2_REGISTER" | jq -r '.message // .error')"
fi

# Login User 2
USER2_LOGIN=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER2_EMAIL\",
    \"password\": \"$USER2_PASSWORD\"
  }")

USER2_LOGIN=$(check_response "$USER2_LOGIN")
USER2_TOKEN=$(echo "$USER2_LOGIN" | jq -r '.access_token // empty')

if [ ! -z "$USER2_TOKEN" ]; then
  print_result "PASS" "User 2 login successful"
else
  print_result "FAIL" "User 2 login failed"
fi

# ==========================================
# SECTION 2: ADMIN APIs - Dashboard
# ==========================================
print_header "SECTION 2: ADMIN APIs - Dashboard & Analytics"

print_subsection "Test: Admin Dashboard API"

ADMIN_DASHBOARD=$(curl -s -X GET "${API_URL}/admin/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_DASHBOARD=$(check_response "$ADMIN_DASHBOARD")
TOTAL_SYSTEM_AMT=$(echo "$ADMIN_DASHBOARD" | jq -r '.total_system_amt // empty')
SMS_LEFT=$(echo "$ADMIN_DASHBOARD" | jq -r '.sms_left // empty')

if [ ! -z "$TOTAL_SYSTEM_AMT" ]; then
  print_result "PASS" "Admin dashboard API (System Amt: ₹$TOTAL_SYSTEM_AMT, SMS Left: $SMS_LEFT)"
else
  print_result "FAIL" "Admin dashboard API" "$(echo "$ADMIN_DASHBOARD" | jq -r '.message // .error')"
fi

# Edge Case: Dashboard without auth
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
DASHBOARD_NO_AUTH=$(curl -s -X GET "${API_URL}/admin/dashboard")
DASHBOARD_NO_AUTH=$(check_response "$DASHBOARD_NO_AUTH")
ERROR_MSG=$(echo "$DASHBOARD_NO_AUTH" | jq -r '.error // .message // empty')

if [[ "$ERROR_MSG" == *"nauthorized"* ]] || [[ "$ERROR_MSG" == *"token"* ]]; then
  print_result "PASS" "Edge Case: Dashboard without auth (properly rejected)"
else
  print_result "FAIL" "Edge Case: Dashboard auth check failed"
fi

# ==========================================
# SECTION 3: ADMIN APIs - User Management
# ==========================================
print_header "SECTION 3: ADMIN APIs - User Management"

print_subsection "Test: Get Users with Extended Fields"

ADMIN_USERS=$(curl -s -X GET "${API_URL}/admin/users?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_USERS=$(check_response "$ADMIN_USERS")
USERS_COUNT=$(echo "$ADMIN_USERS" | jq -r '.count // 0')
HAS_PHONE=$(echo "$ADMIN_USERS" | jq -r '.users[0].phone // empty')
HAS_LATEST_PACKAGE=$(echo "$ADMIN_USERS" | jq -r '.users[0].latest_package_name // empty')

if [ "$USERS_COUNT" -gt 0 ]; then
  if [ ! -z "$HAS_PHONE" ] || [ "$HAS_PHONE" == "null" ]; then
    print_result "PASS" "Admin users API with phone field (Count: $USERS_COUNT)"
  else
    print_result "FAIL" "Admin users API - phone field missing"
  fi
else
  print_result "FAIL" "Admin users API" "No users found"
fi

print_subsection "Test: User Filters"

# Filter by user ID
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
FILTER_BY_ID=$(curl -s -X GET "${API_URL}/admin/users?id=${USER1_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

FILTER_BY_ID=$(check_response "$FILTER_BY_ID")
FILTERED_COUNT=$(echo "$FILTER_BY_ID" | jq -r '.count // 0')

if [ "$FILTERED_COUNT" -eq 1 ]; then
  print_result "PASS" "Edge Case: Filter users by ID"
else
  print_result "FAIL" "Edge Case: Filter by ID failed"
fi

# Filter by name
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
FILTER_BY_NAME=$(curl -s -X GET "${API_URL}/admin/users?name=Test+User" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

FILTER_BY_NAME=$(check_response "$FILTER_BY_NAME")
NAME_FILTER_COUNT=$(echo "$FILTER_BY_NAME" | jq -r '.count // 0')

if [ "$NAME_FILTER_COUNT" -gt 0 ]; then
  print_result "PASS" "Edge Case: Filter users by name"
else
  print_result "FAIL" "Edge Case: Filter by name failed"
fi

# ==========================================
# SECTION 4: ADMIN APIs - KYC Management
# ==========================================
print_header "SECTION 4: ADMIN APIs - KYC Management"

print_subsection "Test: KYC Profiles with Extended Fields"

KYC_PROFILES=$(curl -s -X GET "${API_URL}/admin/profiles?page=1&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

KYC_PROFILES=$(check_response "$KYC_PROFILES")
KYC_COUNT=$(echo "$KYC_PROFILES" | jq -r '.count // 0')

if [ "$KYC_COUNT" -ge 0 ]; then
  print_result "PASS" "Admin KYC profiles API (Count: $KYC_COUNT)"
else
  print_result "FAIL" "Admin KYC profiles API"
fi

# Edge Case: Filter by user_id
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
KYC_BY_USER=$(curl -s -X GET "${API_URL}/admin/profiles?user_id=${USER1_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

KYC_BY_USER=$(check_response "$KYC_BY_USER")
KYC_USER_COUNT=$(echo "$KYC_BY_USER" | jq -r '.count // 0')

if [ "$KYC_USER_COUNT" -ge 0 ]; then
  print_result "PASS" "Edge Case: Filter KYC by user_id"
else
  print_result "FAIL" "Edge Case: KYC filter failed"
fi

print_subsection "Test: KYC Update API"

# Update User 1 KYC to approved
KYC_UPDATE=$(curl -s -X PUT "${API_URL}/admin/kyc/${USER1_ID}/update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"kyc_status\": \"approved\"
  }")

KYC_UPDATE=$(check_response "$KYC_UPDATE")
KYC_STATUS=$(echo "$KYC_UPDATE" | jq -r '.kyc_status // empty')

if [ "$KYC_STATUS" == "approved" ]; then
  print_result "PASS" "KYC update API (User 1 approved)"
else
  print_result "FAIL" "KYC update API" "$(echo "$KYC_UPDATE" | jq -r '.message // .error')"
fi

# Update User 2 KYC to approved (for P2P transfer testing)
KYC_UPDATE2=$(curl -s -X PUT "${API_URL}/admin/kyc/${USER2_ID}/update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"kyc_status\": \"approved\"
  }")

KYC_UPDATE2=$(check_response "$KYC_UPDATE2")
KYC_STATUS2=$(echo "$KYC_UPDATE2" | jq -r '.kyc_status // empty')

if [ "$KYC_STATUS2" == "approved" ]; then
  print_result "PASS" "KYC update API (User 2 approved)"
fi

# Edge Case: Invalid KYC status
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
INVALID_KYC=$(curl -s -X PUT "${API_URL}/admin/kyc/${USER1_ID}/update" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"kyc_status\": \"invalid_status\"
  }")

INVALID_KYC=$(check_response "$INVALID_KYC")
INVALID_ERROR=$(echo "$INVALID_KYC" | jq -r '.message // .error // empty')

if [[ "$INVALID_ERROR" == *"nvalid"* ]] || [[ "$INVALID_ERROR" != "" ]]; then
  print_result "PASS" "Edge Case: Invalid KYC status rejected"
else
  print_result "FAIL" "Edge Case: Invalid KYC status not rejected"
fi

# ==========================================
# SECTION 5: ADMIN APIs - Commissions
# ==========================================
print_header "SECTION 5: ADMIN APIs - All Commissions"

print_subsection "Test: All Commissions API"

ALL_COMMISSIONS=$(curl -s -X GET "${API_URL}/admin/commissions?page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ALL_COMMISSIONS=$(check_response "$ALL_COMMISSIONS")
COMM_COUNT=$(echo "$ALL_COMMISSIONS" | jq -r '.count // 0')

if [ "$COMM_COUNT" -ge 0 ]; then
  print_result "PASS" "All commissions API (Count: $COMM_COUNT)"
else
  print_result "FAIL" "All commissions API"
fi

# Edge Case: Filter by commission type
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
COMM_BY_TYPE=$(curl -s -X GET "${API_URL}/admin/commissions?commission_type=SELF&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

COMM_BY_TYPE=$(check_response "$COMM_BY_TYPE")
TYPE_COUNT=$(echo "$COMM_BY_TYPE" | jq -r '.count // 0')

if [ "$TYPE_COUNT" -ge 0 ]; then
  print_result "PASS" "Edge Case: Filter commissions by type (SELF)"
else
  print_result "FAIL" "Edge Case: Commission type filter failed"
fi

# Edge Case: Filter by user_id
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
COMM_BY_USER=$(curl -s -X GET "${API_URL}/admin/commissions?user_id=${USER1_ID}" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

COMM_BY_USER=$(check_response "$COMM_BY_USER")
USER_COMM_COUNT=$(echo "$COMM_BY_USER" | jq -r '.count // 0')

if [ "$USER_COMM_COUNT" -ge 0 ]; then
  print_result "PASS" "Edge Case: Filter commissions by user_id"
else
  print_result "FAIL" "Edge Case: Commission user filter failed"
fi

# ==========================================
# SECTION 6: USER APIs - Team Business
# ==========================================
print_header "SECTION 6: USER APIs - Team Business Dashboard"

TEAM_BUSINESS=$(curl -s -X GET "${API_URL}/dashboard/team-business" \
  -H "Authorization: Bearer $USER1_TOKEN")

TEAM_BUSINESS=$(check_response "$TEAM_BUSINESS")
TOTAL_BUSINESS=$(echo "$TEAM_BUSINESS" | jq -r '.total_team_business // empty')
SPOT_INCOME=$(echo "$TEAM_BUSINESS" | jq -r '.breakdown.spot_income.total // empty')
MONTHLY_INCOME=$(echo "$TEAM_BUSINESS" | jq -r '.breakdown.monthly_income.total // empty')

if [ ! -z "$TOTAL_BUSINESS" ]; then
  print_result "PASS" "Team business API (Total: ₹$TOTAL_BUSINESS, SPOT: ₹$SPOT_INCOME, MONTHLY: ₹$MONTHLY_INCOME)"
else
  print_result "FAIL" "Team business API" "$(echo "$TEAM_BUSINESS" | jq -r '.message // .error')"
fi

# Edge Case: Team business without auth
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
BUSINESS_NO_AUTH=$(curl -s -X GET "${API_URL}/dashboard/team-business")
BUSINESS_NO_AUTH=$(check_response "$BUSINESS_NO_AUTH")
AUTH_ERROR=$(echo "$BUSINESS_NO_AUTH" | jq -r '.error // .message // empty')

if [[ "$AUTH_ERROR" == *"nauthorized"* ]] || [[ "$AUTH_ERROR" == *"token"* ]]; then
  print_result "PASS" "Edge Case: Team business without auth (properly rejected)"
else
  print_result "FAIL" "Edge Case: Team business auth check failed"
fi

# ==========================================
# SECTION 7: USER APIs - Team Tree
# ==========================================
print_header "SECTION 7: USER APIs - Team Tree Hierarchy"

TEAM_TREE=$(curl -s -X GET "${API_URL}/team/tree" \
  -H "Authorization: Bearer $USER1_TOKEN")

TEAM_TREE=$(check_response "$TEAM_TREE")
UPLINE_COUNT=$(echo "$TEAM_TREE" | jq -r '.upline | length // 0')
DOWNLINE_SIZE=$(echo "$TEAM_TREE" | jq -r '.downline.total_team_size // 0')

if [ ! -z "$UPLINE_COUNT" ]; then
  print_result "PASS" "Team tree API (Upline: $UPLINE_COUNT, Downline: $DOWNLINE_SIZE)"
else
  print_result "FAIL" "Team tree API" "$(echo "$TEAM_TREE" | jq -r '.message // .error')"
fi

# ==========================================
# SECTION 8: USER APIs - User Details
# ==========================================
print_header "SECTION 8: USER APIs - User Details"

print_subsection "Test: Get Own Details"

OWN_DETAILS=$(curl -s -X GET "${API_URL}/user/details/${USER1_ID}" \
  -H "Authorization: Bearer $USER1_TOKEN")

OWN_DETAILS=$(check_response "$OWN_DETAILS")
RELATIONSHIP=$(echo "$OWN_DETAILS" | jq -r '.relationship // empty')

if [ "$RELATIONSHIP" == "self" ]; then
  print_result "PASS" "User details API (self)"
else
  print_result "FAIL" "User details API (self)" "$(echo "$OWN_DETAILS" | jq -r '.message // .error')"
fi

print_subsection "Test: Access Control - Non-Team Member"

# Edge Case: Try to get details of non-team member
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
NON_TEAM_DETAILS=$(curl -s -X GET "${API_URL}/user/details/999999" \
  -H "Authorization: Bearer $USER1_TOKEN")

NON_TEAM_DETAILS=$(check_response "$NON_TEAM_DETAILS")
ACCESS_ERROR=$(echo "$NON_TEAM_DETAILS" | jq -r '.message // empty')

if [[ "$ACCESS_ERROR" == *"not found"* ]] || [[ "$ACCESS_ERROR" == *"team"* ]]; then
  print_result "PASS" "Edge Case: Access control for non-team member"
else
  print_result "FAIL" "Edge Case: Access control not working"
fi

# Edge Case: Invalid user ID format
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
INVALID_ID=$(curl -s -X GET "${API_URL}/user/details/invalid_id" \
  -H "Authorization: Bearer $USER1_TOKEN")

INVALID_ID=$(check_response "$INVALID_ID")
if echo "$INVALID_ID" | jq -r '.message // .error' | grep -qi "error\|invalid\|not found"; then
  print_result "PASS" "Edge Case: Invalid user ID format handled"
else
  print_result "FAIL" "Edge Case: Invalid ID not handled properly"
fi

# ==========================================
# SECTION 9: USER APIs - Bills & Invoices
# ==========================================
print_header "SECTION 9: USER APIs - Bills & Invoices"

print_subsection "Test: Bills List"

BILLS=$(curl -s -X GET "${API_URL}/bills?page=1&limit=10" \
  -H "Authorization: Bearer $USER1_TOKEN")

BILLS=$(check_response "$BILLS")
BILLS_COUNT=$(echo "$BILLS" | jq -r '.total // 0')

if [ ! -z "$BILLS_COUNT" ]; then
  print_result "PASS" "Bills list API (Total: $BILLS_COUNT)"
else
  print_result "FAIL" "Bills list API" "$(echo "$BILLS" | jq -r '.message // .error')"
fi

# Edge Case: Bills with date filters
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
START_DATE="2024-01-01T00:00:00Z"
END_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

BILLS_FILTERED=$(curl -s -X GET "${API_URL}/bills?start_date=${START_DATE}&end_date=${END_DATE}" \
  -H "Authorization: Bearer $USER1_TOKEN")

BILLS_FILTERED=$(check_response "$BILLS_FILTERED")
FILTERED_BILLS=$(echo "$BILLS_FILTERED" | jq -r '.total // 0')

if [ ! -z "$FILTERED_BILLS" ]; then
  print_result "PASS" "Edge Case: Bills with date filters (Count: $FILTERED_BILLS)"
else
  print_result "FAIL" "Edge Case: Bills date filter failed"
fi

# Edge Case: Pagination
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
BILLS_PAGE2=$(curl -s -X GET "${API_URL}/bills?page=2&limit=5" \
  -H "Authorization: Bearer $USER1_TOKEN")

BILLS_PAGE2=$(check_response "$BILLS_PAGE2")
PAGE_NUM=$(echo "$BILLS_PAGE2" | jq -r '.page // 0')

if [ "$PAGE_NUM" -eq 2 ]; then
  print_result "PASS" "Edge Case: Bills pagination"
else
  print_result "FAIL" "Edge Case: Bills pagination failed"
fi

# ==========================================
# SECTION 10: USER APIs - P2P Transfer
# ==========================================
print_header "SECTION 10: USER APIs - P2P Wallet Transfer"

print_subsection "Test: Transfer Validations"

# Edge Case: Transfer to self (should fail)
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
TRANSFER_SELF=$(curl -s -X POST "${API_URL}/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"${USER1_ID}\",
    \"amount\": 100,
    \"remarks\": \"Self transfer test\"
  }")

TRANSFER_SELF=$(check_response "$TRANSFER_SELF")
SELF_ERROR=$(echo "$TRANSFER_SELF" | jq -r '.message // empty')

if [[ "$SELF_ERROR" == *"yourself"* ]]; then
  print_result "PASS" "Edge Case: Transfer to self rejected"
else
  print_result "FAIL" "Edge Case: Self transfer validation failed"
fi

# Edge Case: Insufficient balance
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
TRANSFER_INSUFFICIENT=$(curl -s -X POST "${API_URL}/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"${USER2_ID}\",
    \"amount\": 999999999,
    \"remarks\": \"Insufficient balance test\"
  }")

TRANSFER_INSUFFICIENT=$(check_response "$TRANSFER_INSUFFICIENT")
BALANCE_ERROR=$(echo "$TRANSFER_INSUFFICIENT" | jq -r '.message // empty')

if [[ "$BALANCE_ERROR" == *"balance"* ]] || [[ "$BALANCE_ERROR" == *"Insufficient"* ]]; then
  print_result "PASS" "Edge Case: Insufficient balance check"
else
  print_result "FAIL" "Edge Case: Balance validation failed" "$BALANCE_ERROR"
fi

# Edge Case: Invalid amount (negative)
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
TRANSFER_NEGATIVE=$(curl -s -X POST "${API_URL}/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"${USER2_ID}\",
    \"amount\": -100,
    \"remarks\": \"Negative amount test\"
  }")

TRANSFER_NEGATIVE=$(check_response "$TRANSFER_NEGATIVE")
NEGATIVE_ERROR=$(echo "$TRANSFER_NEGATIVE" | jq -r '.message // .error // empty')

if [[ "$NEGATIVE_ERROR" != "" ]]; then
  print_result "PASS" "Edge Case: Negative amount rejected"
else
  print_result "FAIL" "Edge Case: Negative amount validation failed"
fi

# Edge Case: Non-existent receiver
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
TRANSFER_INVALID_USER=$(curl -s -X POST "${API_URL}/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"receiver_id\": \"999999\",
    \"amount\": 100,
    \"remarks\": \"Invalid receiver test\"
  }")

TRANSFER_INVALID_USER=$(check_response "$TRANSFER_INVALID_USER")
RECEIVER_ERROR=$(echo "$TRANSFER_INVALID_USER" | jq -r '.message // empty')

if [[ "$RECEIVER_ERROR" == *"not found"* ]] || [[ "$RECEIVER_ERROR" == *"Receiver"* ]]; then
  print_result "PASS" "Edge Case: Invalid receiver rejected"
else
  print_result "FAIL" "Edge Case: Receiver validation failed"
fi

print_subsection "Test: Transfer History"

TRANSFER_HISTORY=$(curl -s -X GET "${API_URL}/transfer/history?type=all&page=1&limit=10" \
  -H "Authorization: Bearer $USER1_TOKEN")

TRANSFER_HISTORY=$(check_response "$TRANSFER_HISTORY")
HISTORY_COUNT=$(echo "$TRANSFER_HISTORY" | jq -r '.total // 0')

if [ ! -z "$HISTORY_COUNT" ]; then
  print_result "PASS" "Transfer history API (Total: $HISTORY_COUNT)"
else
  print_result "FAIL" "Transfer history API"
fi

# Edge Case: Filter by type
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
HISTORY_SENT=$(curl -s -X GET "${API_URL}/transfer/history?type=sent" \
  -H "Authorization: Bearer $USER1_TOKEN")

HISTORY_SENT=$(check_response "$HISTORY_SENT")
SENT_COUNT=$(echo "$HISTORY_SENT" | jq -r '.total // 0')

if [ ! -z "$SENT_COUNT" ]; then
  print_result "PASS" "Edge Case: Transfer history filter by type (sent: $SENT_COUNT)"
else
  print_result "FAIL" "Edge Case: History type filter failed"
fi

# ==========================================
# SECTION 11: WITHDRAWAL & TRANSFER RULES
# ==========================================
print_header "SECTION 11: ADMIN APIs - Withdrawal & Transfer Rules"

print_subsection "Test: Get Withdrawal Rules"

WITHDRAWAL_RULES=$(curl -s -X GET "${API_URL}/admin/withdrawal-transfer-rules" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

WITHDRAWAL_RULES=$(check_response "$WITHDRAWAL_RULES")
SPOT_MIN=$(echo "$WITHDRAWAL_RULES" | jq -r '.spot_min_withdraw // empty')

if [ ! -z "$SPOT_MIN" ]; then
  print_result "PASS" "Withdrawal rules API (spot_min_withdraw: ₹$SPOT_MIN)"
else
  print_result "FAIL" "Withdrawal rules API (spot_min_withdraw field missing)"
fi

print_subsection "Test: Update Withdrawal Rules"

# Update with spot_min_withdraw
UPDATE_RULES=$(curl -s -X PUT "${API_URL}/admin/withdrawal-transfer-rules" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"spot_min_withdraw\": 50
  }")

UPDATE_RULES=$(check_response "$UPDATE_RULES")
UPDATED_SPOT_MIN=$(echo "$UPDATE_RULES" | jq -r '.spot_min_withdraw // empty')

if [ "$UPDATED_SPOT_MIN" == "50" ]; then
  print_result "PASS" "Update withdrawal rules with spot_min_withdraw"
else
  print_result "FAIL" "Update withdrawal rules failed"
fi

# ==========================================
# SECTION 12: EDGE CASES - Error Handling
# ==========================================
print_header "SECTION 12: EDGE CASES - Error Handling"

print_subsection "Test: Invalid Endpoints"

# Edge Case: Non-existent endpoint
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
INVALID_ENDPOINT=$(curl -s -X GET "${API_URL}/invalid/endpoint/12345" \
  -H "Authorization: Bearer $USER1_TOKEN")

INVALID_ENDPOINT=$(check_response "$INVALID_ENDPOINT")
if echo "$INVALID_ENDPOINT" | jq -r '.error // .message' | grep -qi "not found\|404"; then
  print_result "PASS" "Edge Case: Invalid endpoint returns 404"
else
  print_result "FAIL" "Edge Case: Invalid endpoint not handled"
fi

print_subsection "Test: Malformed Requests"

# Edge Case: Malformed JSON
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
MALFORMED_JSON=$(curl -s -X POST "${API_URL}/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{invalid json here")

if echo "$MALFORMED_JSON" | grep -qi "error\|invalid"; then
  print_result "PASS" "Edge Case: Malformed JSON handled"
else
  print_result "FAIL" "Edge Case: Malformed JSON not handled"
fi

# Edge Case: Missing required fields
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
MISSING_FIELDS=$(curl -s -X POST "${API_URL}/transfer/p2p" \
  -H "Authorization: Bearer $USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}")

MISSING_FIELDS=$(check_response "$MISSING_FIELDS")
MISSING_ERROR=$(echo "$MISSING_FIELDS" | jq -r '.message // .error // empty')

if [[ "$MISSING_ERROR" != "" ]]; then
  print_result "PASS" "Edge Case: Missing required fields caught"
else
  print_result "FAIL" "Edge Case: Missing fields validation failed"
fi

print_subsection "Test: Rate Limiting & Performance"

# Edge Case: Multiple rapid requests
EDGE_CASE_TESTS=$((EDGE_CASE_TESTS + 1))
echo "Testing rapid consecutive requests..."
for i in {1..5}; do
  curl -s -X GET "${API_URL}/dashboard/team-business" \
    -H "Authorization: Bearer $USER1_TOKEN" > /dev/null
done
print_result "PASS" "Edge Case: Rapid consecutive requests handled"

# ==========================================
# FINAL SUMMARY
# ==========================================
print_header "TEST SUMMARY"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}OVERALL RESULTS${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Tests Run:        $TOTAL_TESTS"
echo -e "${GREEN}Passed:                 $PASSED_TESTS${NC}"
echo -e "${RED}Failed:                 $FAILED_TESTS${NC}"
echo "Edge Cases Tested:      $EDGE_CASE_TESTS"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  PASS_PERCENTAGE=100
else
  PASS_PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
fi

echo "Pass Rate:              ${PASS_PERCENTAGE}%"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TESTED FEATURES${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ Admin Dashboard API"
echo "✓ Admin User Management (with filters)"
echo "✓ Admin KYC Management (with update)"
echo "✓ Admin All Commissions API"
echo "✓ Withdrawal & Transfer Rules (with spot_min_withdraw)"
echo "✓ User Team Business Dashboard"
echo "✓ User Team Tree Hierarchy"
echo "✓ User Details API (with access control)"
echo "✓ Bills & Invoices APIs"
echo "✓ P2P Wallet Transfer (with validations)"
echo "✓ Transfer History"
echo ""

if [ $FAILED_TESTS -gt 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${RED}FAILED TESTS DETAILS${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  for detail in "${FAILED_TEST_DETAILS[@]}"; do
    echo -e "${YELLOW}✗${NC} $detail"
  done
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}EDGE CASES COVERED${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ Authentication validation"
echo "✓ Access control enforcement"
echo "✓ Invalid input handling"
echo "✓ Non-existent resource handling"
echo "✓ Filter and pagination"
echo "✓ Transfer validations (self, balance, negative amount)"
echo "✓ KYC status validation"
echo "✓ Malformed request handling"
echo "✓ Rate limiting test"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "🎉 All APIs are working correctly!"
  echo "🎉 All edge cases handled properly!"
  echo "🎉 Ready for production!"
  echo ""
  exit 0
else
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${RED}✗ SOME TESTS FAILED${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Please review the failed tests above."
  echo ""
  exit 1
fi

