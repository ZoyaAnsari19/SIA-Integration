#!/bin/bash
# Comprehensive Renew API Test with Scenarios and Edge Cases

set -e

API_URL="${API_URL:-http://localhost:3000}"
DB_NAME="${DB_NAME:-mlm}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  COMPREHENSIVE RENEW API TEST                                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📡 API URL: $API_URL"
echo "🗄️  DB: $DB_NAME@$DB_HOST:$DB_PORT"
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Helper function to execute SQL
execute_sql() {
  # Try docker compose first, then direct psql
  docker compose exec -T db psql -U postgres -d mlm -t -A -c "$1" 2>/dev/null || \
  PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -c "$1" 2>/dev/null || echo ""
}

# Helper function to execute SQL with formatting
execute_sql_formatted() {
  docker compose exec -T db psql -U postgres -d mlm -c "$1" 2>/dev/null || \
  PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$1" 2>/dev/null || echo ""
}

# Helper function to print section header
print_section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

# Step 1: Register test user
print_section "Step 1: Register Test User"

TIMESTAMP=$(date +%s)
USER_EMAIL="renewtest${TIMESTAMP}@example.com"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/users/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"password123\",
    \"name\": \"Renew Test User\"
  }")

echo "Register response:"
echo "$REGISTER_RESPONSE" | jq . 2>/dev/null || echo "$REGISTER_RESPONSE"
echo ""

USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id // .id' 2>/dev/null || echo "")
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to register user${NC}"
  exit 1
fi

echo -e "${GREEN}✅ User registered with ID: $USER_ID, Email: $USER_EMAIL${NC}"
echo ""

# Step 2: Login
print_section "Step 2: Login"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"password123\"
  }")

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null || echo "")
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo ""

# Step 3: Get available packages
print_section "Step 3: Get Available Packages"

PACKAGES_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/packages" \
  -H "Authorization: Bearer $TOKEN")

echo "Packages:"
echo "$PACKAGES_RESPONSE" | jq '.[] | {id, name, price, global_ids}' 2>/dev/null || echo "$PACKAGES_RESPONSE"
echo ""

# Get packages sorted by global_ids (if available)
PACKAGE1_ID=$(echo "$PACKAGES_RESPONSE" | jq -r '.[0].id' 2>/dev/null || echo "")
PACKAGE2_ID=$(echo "$PACKAGES_RESPONSE" | jq -r '.[1].id' 2>/dev/null || echo "")

# Try to find packages with different global_ids
PACKAGE_SMALL_ID=$(echo "$PACKAGES_RESPONSE" | jq -r '[.[] | select(.global_ids != null)] | sort_by(.global_ids) | .[0].id' 2>/dev/null || echo "$PACKAGE1_ID")
PACKAGE_LARGE_ID=$(echo "$PACKAGES_RESPONSE" | jq -r '[.[] | select(.global_ids != null)] | sort_by(.global_ids) | .[-1].id' 2>/dev/null || echo "$PACKAGE2_ID")

if [ -z "$PACKAGE_SMALL_ID" ] || [ "$PACKAGE_SMALL_ID" = "null" ]; then
  PACKAGE_SMALL_ID=$PACKAGE1_ID
fi
if [ -z "$PACKAGE_LARGE_ID" ] || [ "$PACKAGE_LARGE_ID" = "null" ]; then
  PACKAGE_LARGE_ID=$PACKAGE_SMALL_ID
fi

PACKAGE_SMALL_GLOBAL=$(echo "$PACKAGES_RESPONSE" | jq -r "[.[] | select(.id == $PACKAGE_SMALL_ID)] | .[0].global_ids" 2>/dev/null || echo "300")
PACKAGE_LARGE_GLOBAL=$(echo "$PACKAGES_RESPONSE" | jq -r "[.[] | select(.id == $PACKAGE_LARGE_ID)] | .[0].global_ids" 2>/dev/null || echo "900")

echo -e "${GREEN}✅ Using packages:${NC}"
echo "   Small package: ID=$PACKAGE_SMALL_ID, global_ids=$PACKAGE_SMALL_GLOBAL"
echo "   Large package: ID=$PACKAGE_LARGE_ID, global_ids=$PACKAGE_LARGE_GLOBAL"
echo ""

# Step 4: Create first purchase
print_section "Step 4: Create First Purchase (Small Package)"

PURCHASE1_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_SMALL_ID,
    \"txn_id\": \"TXN001\",
    \"payment_type\": \"UPI\"
  }")

echo "First purchase response:"
echo "$PURCHASE1_RESPONSE" | jq . 2>/dev/null || echo "$PURCHASE1_RESPONSE"
echo ""

PURCHASE1_ID=$(echo "$PURCHASE1_RESPONSE" | jq -r '.purchase.id' 2>/dev/null || echo "")
if [ -z "$PURCHASE1_ID" ] || [ "$PURCHASE1_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create first purchase${NC}"
  exit 1
fi

echo -e "${GREEN}✅ First purchase created: ID=$PURCHASE1_ID${NC}"
echo ""

# Verify purchase in DB
print_section "Step 5: Verify Purchase in Database"

echo "Purchase in DB:"
execute_sql_formatted "SELECT id, user_id, package_id, is_renewal, previous_package_id, effective_global_ids FROM purchases WHERE id = $PURCHASE1_ID;"
echo ""

IS_RENEWAL=$(execute_sql "SELECT is_renewal FROM purchases WHERE id = $PURCHASE1_ID;" | tr -d ' ')
EFFECTIVE_GLOBAL=$(execute_sql "SELECT effective_global_ids FROM purchases WHERE id = $PURCHASE1_ID;" | tr -d ' ')

if [ "$IS_RENEWAL" = "f" ] || [ "$IS_RENEWAL" = "false" ]; then
  echo -e "${GREEN}✅ is_renewal = false (correct for first purchase)${NC}"
else
  echo -e "${YELLOW}⚠️  is_renewal = $IS_RENEWAL (expected false for first purchase)${NC}"
fi

if [ "$EFFECTIVE_GLOBAL" = "$PACKAGE_SMALL_GLOBAL" ] || [ -z "$EFFECTIVE_GLOBAL" ]; then
  echo -e "${GREEN}✅ effective_global_ids = $EFFECTIVE_GLOBAL (should be $PACKAGE_SMALL_GLOBAL for first purchase)${NC}"
else
  echo -e "${YELLOW}⚠️  effective_global_ids = $EFFECTIVE_GLOBAL (expected $PACKAGE_SMALL_GLOBAL)${NC}"
fi
echo ""

# Step 6: Try to renew (should fail - package not expired/2x)
print_section "Step 6: Edge Case - Try Renew Without Expired/2x Purchase"

RENEW_FAIL_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/purchases/renew" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_SMALL_ID,
    \"txn_id\": \"TXN002\"
  }")

echo "Renew response (should fail):"
echo "$RENEW_FAIL_RESPONSE" | jq . 2>/dev/null || echo "$RENEW_FAIL_RESPONSE"
echo ""

ERROR=$(echo "$RENEW_FAIL_RESPONSE" | jq -r '.error' 2>/dev/null || echo "")
if [ "$ERROR" = "no_renewal_eligible" ]; then
  echo -e "${GREEN}✅ Correctly rejected renewal (package not expired/2x)${NC}"
else
  echo -e "${YELLOW}⚠️  Unexpected response: $ERROR${NC}"
fi
echo ""

# Step 7: Simulate package expiry by updating active_until
print_section "Step 7: Simulate Package Expiry (Update active_until to past date)"

execute_sql_formatted "UPDATE purchases SET active_until = NOW() - INTERVAL '1 day' WHERE id = $PURCHASE1_ID;"

echo "Package expiry status:"
execute_sql_formatted "SELECT id, active_until, active_until < NOW() as is_expired FROM purchases WHERE id = $PURCHASE1_ID;"
echo ""

# Wait a moment for DB to update
sleep 1

echo -e "${GREEN}✅ Package expired (simulated)${NC}"
echo ""

# Step 8: Renew with same package
print_section "Step 8: Renew with Same Package (Should get effective_global_ids = 0)"

RENEW_SAME_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/purchases/renew" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE_SMALL_ID,
    \"txn_id\": \"TXN003\",
    \"payment_type\": \"UPI\"
  }")

echo "Renew same package response:"
echo "$RENEW_SAME_RESPONSE" | jq . 2>/dev/null || echo "$RENEW_SAME_RESPONSE"
echo ""

PURCHASE2_ID=$(echo "$RENEW_SAME_RESPONSE" | jq -r '.purchase.id' 2>/dev/null || echo "")
if [ -z "$PURCHASE2_ID" ] || [ "$PURCHASE2_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to renew with same package${NC}"
else
  echo -e "${GREEN}✅ Renewal purchase created: ID=$PURCHASE2_ID${NC}"
  
  # Verify in DB
  echo "Renewal purchase in DB:"
  execute_sql_formatted "SELECT id, package_id, is_renewal, previous_package_id, effective_global_ids FROM purchases WHERE id = $PURCHASE2_ID;"
  echo ""
  
  IS_RENEWAL2=$(execute_sql "SELECT is_renewal FROM purchases WHERE id = $PURCHASE2_ID;" | tr -d ' ')
  PREV_PKG2=$(execute_sql "SELECT previous_package_id FROM purchases WHERE id = $PURCHASE2_ID;" | tr -d ' ')
  EFF_GLOBAL2=$(execute_sql "SELECT effective_global_ids FROM purchases WHERE id = $PURCHASE2_ID;" | tr -d ' ')
  
  if [ "$IS_RENEWAL2" = "t" ] || [ "$IS_RENEWAL2" = "true" ]; then
    echo -e "${GREEN}✅ is_renewal = true (correct)${NC}"
  else
    echo -e "${RED}❌ is_renewal should be true${NC}"
  fi
  
  if [ "$PREV_PKG2" = "$PACKAGE_SMALL_ID" ]; then
    echo -e "${GREEN}✅ previous_package_id = $PREV_PKG2 (correct)${NC}"
  else
    echo -e "${RED}❌ previous_package_id should be $PACKAGE_SMALL_ID, got $PREV_PKG2${NC}"
  fi
  
  if [ "$EFF_GLOBAL2" = "0" ]; then
    echo -e "${GREEN}✅ effective_global_ids = 0 (correct for same package renew)${NC}"
  else
    echo -e "${RED}❌ effective_global_ids should be 0 for same package renew, got $EFF_GLOBAL2${NC}"
  fi
fi
echo ""

# Step 9: Expire the renewal purchase and renew with bigger package
if [ "$PACKAGE_SMALL_ID" != "$PACKAGE_LARGE_ID" ]; then
  print_section "Step 9: Expire Renewal Purchase and Renew with Bigger Package"

  execute_sql_formatted "UPDATE purchases SET active_until = NOW() - INTERVAL '1 day' WHERE id = $PURCHASE2_ID;"
  
  # Wait a moment
  sleep 1
  
  echo -e "${GREEN}✅ Renewal purchase expired${NC}"
  echo ""
  
  print_section "Step 10: Renew with Bigger Package (Should get effective_global_ids = new package's global_ids)"
  
  RENEW_BIGGER_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/purchases/renew" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"package_id\": $PACKAGE_LARGE_ID,
      \"txn_id\": \"TXN004\",
      \"payment_type\": \"UPI\"
    }")
  
  echo "Renew bigger package response:"
  echo "$RENEW_BIGGER_RESPONSE" | jq . 2>/dev/null || echo "$RENEW_BIGGER_RESPONSE"
  echo ""
  
  PURCHASE3_ID=$(echo "$RENEW_BIGGER_RESPONSE" | jq -r '.purchase.id' 2>/dev/null || echo "")
  if [ -z "$PURCHASE3_ID" ] || [ "$PURCHASE3_ID" = "null" ]; then
    echo -e "${RED}❌ Failed to renew with bigger package${NC}"
  else
    echo -e "${GREEN}✅ Bigger package renewal created: ID=$PURCHASE3_ID${NC}"
    
    # Verify in DB
    echo "Bigger package renewal in DB:"
    execute_sql_formatted "SELECT id, package_id, is_renewal, previous_package_id, effective_global_ids FROM purchases WHERE id = $PURCHASE3_ID;"
    echo ""
    
    IS_RENEWAL3=$(execute_sql "SELECT is_renewal FROM purchases WHERE id = $PURCHASE3_ID;" | tr -d ' ')
    PREV_PKG3=$(execute_sql "SELECT previous_package_id FROM purchases WHERE id = $PURCHASE3_ID;" | tr -d ' ')
    EFF_GLOBAL3=$(execute_sql "SELECT effective_global_ids FROM purchases WHERE id = $PURCHASE3_ID;" | tr -d ' ')
    
    if [ "$IS_RENEWAL3" = "t" ] || [ "$IS_RENEWAL3" = "true" ]; then
      echo -e "${GREEN}✅ is_renewal = true (correct)${NC}"
    else
      echo -e "${RED}❌ is_renewal should be true${NC}"
    fi
    
    if [ "$PREV_PKG3" = "$PACKAGE_SMALL_ID" ]; then
      echo -e "${GREEN}✅ previous_package_id = $PREV_PKG3 (correct - should be last expired purchase)${NC}"
    else
      echo -e "${YELLOW}⚠️  previous_package_id = $PREV_PKG3 (expected $PACKAGE_SMALL_ID)${NC}"
    fi
    
    if [ "$EFF_GLOBAL3" = "$PACKAGE_LARGE_GLOBAL" ]; then
      echo -e "${GREEN}✅ effective_global_ids = $EFF_GLOBAL3 (correct - full new cap for bigger package)${NC}"
    else
      echo -e "${RED}❌ effective_global_ids should be $PACKAGE_LARGE_GLOBAL for bigger package renew, got $EFF_GLOBAL3${NC}"
    fi
  fi
  echo ""
else
  echo -e "${YELLOW}⚠️  Skipping bigger package test (only one package available)${NC}"
  echo ""
fi

# Step 11: Verify GLOBAL_HELPING commission uses effective_global_ids
print_section "Step 11: Verify GLOBAL_HELPING Commission Uses effective_global_ids"

echo "Checking scheduled_commissions for GLOBAL_HELPING:"
execute_sql_formatted "SELECT id, receiver_user_id, purchase_id, commission_type, monthly_amount FROM scheduled_commissions WHERE receiver_user_id = $USER_ID AND commission_type = 'GLOBAL_HELPING' ORDER BY id;"
echo ""

echo "Checking purchases with their effective_global_ids:"
execute_sql_formatted "SELECT id, package_id, is_renewal, effective_global_ids FROM purchases WHERE user_id = $USER_ID ORDER BY id;"
echo ""

# Step 12: Summary
print_section "Test Summary"

echo -e "${MAGENTA}📊 Test Results:${NC}"
echo ""
echo "✅ User created: $USER_ID"
echo "✅ First purchase: $PURCHASE1_ID (package: $PACKAGE_SMALL_ID)"
if [ -n "$PURCHASE2_ID" ] && [ "$PURCHASE2_ID" != "null" ]; then
  echo "✅ Same package renew: $PURCHASE2_ID (effective_global_ids: $EFF_GLOBAL2)"
fi
if [ -n "$PURCHASE3_ID" ] && [ "$PURCHASE3_ID" != "null" ]; then
  echo "✅ Bigger package renew: $PURCHASE3_ID (effective_global_ids: $EFF_GLOBAL3)"
fi
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Comprehensive Renew Test Completed!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

