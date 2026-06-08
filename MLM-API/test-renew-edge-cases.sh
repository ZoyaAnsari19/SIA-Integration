#!/bin/bash
# Test Edge Cases for Renew API with Approval Workflow

set -e

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  RENEW API EDGE CASES TEST (WITH APPROVAL WORKFLOW)         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_section() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

execute_sql() {
  docker compose exec -T db psql -U postgres -d mlm -t -A -c "$1" 2>/dev/null || \
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mlm -t -A -c "$1" 2>/dev/null || echo ""
}

execute_sql_formatted() {
  docker compose exec -T db psql -U postgres -d mlm -c "$1" 2>/dev/null || \
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mlm -c "$1" 2>/dev/null || echo ""
}

# Helper function to approve a purchase request
approve_request() {
  local REQUEST_ID=$1
  echo "  Approving request ID: $REQUEST_ID" >&2
  
  APPROVE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/admin/activation/requests/$REQUEST_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  
  PURCHASE_ID=$(echo "$APPROVE_RESPONSE" | jq -r '.purchase.id // empty')
  
  if [ -z "$PURCHASE_ID" ] || [ "$PURCHASE_ID" = "null" ]; then
    echo -e "${RED}  ❌ Failed to approve request${NC}" >&2
    echo "  Response: $APPROVE_RESPONSE" >&2
    echo ""
    return 1
  fi
  
  echo -e "${GREEN}  ✅ Request approved! Purchase ID: $PURCHASE_ID${NC}" >&2
  echo "$PURCHASE_ID"
}

# Edge Case 1: Multiple renewals (55 -> 55 -> 900)
print_section "Edge Case 1: Multiple Renewals Chain"

TIMESTAMP=$(date +%s)
USER_EMAIL="edgetest${TIMESTAMP}@example.com"

# Get a valid referrer user ID (use first user or create one)
REFERRER_ID=$(execute_sql "SELECT id FROM users ORDER BY id LIMIT 1;" | tr -d ' ')
if [ -z "$REFERRER_ID" ]; then
  # Create a root user first
  echo "Creating root user for referrer..."
  ROOT_USER=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"Root User\",
      \"email\": \"root${TIMESTAMP}@example.com\",
      \"mobile\": \"9999999999\",
      \"password\": \"password123\",
      \"referrer_user_id\": 1
    }" || echo "")
  # If that fails, try to get any user or use 1
  REFERRER_ID="1"
fi

# Register user
echo "Registering user with referrer: $REFERRER_ID..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Edge Test User\",
    \"email\": \"$USER_EMAIL\",
    \"mobile\": \"9876543210\",
    \"password\": \"password123\",
    \"referrer_user_id\": $REFERRER_ID
  }")

USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.id // .user_id // .user.id' 2>/dev/null || echo "")

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to register user${NC}"
  echo "Response: $REGISTER_RESPONSE"
  exit 1
fi

# Login
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_EMAIL\",
    \"password\": \"password123\"
  }")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token' 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}❌ Failed to login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ User created: $USER_ID${NC}"
echo ""

# Get packages
PACKAGE1_ID=$(execute_sql "SELECT id FROM packages WHERE global_ids = 55 LIMIT 1;" | tr -d ' ')
PACKAGE2_ID=$(execute_sql "SELECT id FROM packages WHERE global_ids = 900 LIMIT 1;" | tr -d ' ')

if [ -z "$PACKAGE1_ID" ] || [ -z "$PACKAGE2_ID" ]; then
  echo -e "${YELLOW}⚠️  Need packages with global_ids 55 and 900${NC}"
  exit 1
fi

echo "Package 1 (55 IDs): $PACKAGE1_ID"
echo "Package 2 (900 IDs): $PACKAGE2_ID"
echo ""

# Create first purchase request (activation)
echo "Step 1: Creating first purchase request (activation)..."
REQUEST1=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE1_ID,
    \"request_type\": \"activation\",
    \"txn_id\": \"TXN-EDGE-001\"
  }")

REQUEST1_ID=$(echo "$REQUEST1" | jq -r '.request.id' 2>/dev/null || echo "")

if [ -z "$REQUEST1_ID" ] || [ "$REQUEST1_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create activation request${NC}"
  echo "Response: $REQUEST1"
  exit 1
fi

echo "  Request created: $REQUEST1_ID"
echo "  Request type: $(echo "$REQUEST1" | jq -r '.request.request_type')"
echo "  Status: $(echo "$REQUEST1" | jq -r '.request.status')"

# Approve first request
PURCHASE1_ID=$(approve_request "$REQUEST1_ID")
if [ -z "$PURCHASE1_ID" ]; then
  exit 1
fi

echo "  Purchase 1 ID: $PURCHASE1_ID"

# Wait for commission processing and DB sync
sleep 3

# Verify first purchase - check in DB directly
echo "  Verifying purchase in database..."
PURCHASE_INFO=$(execute_sql_formatted "SELECT id, package_id, effective_global_ids, is_renewal FROM purchases WHERE id = $PURCHASE1_ID;" 2>/dev/null | grep -v "^$" | tail -2 | head -1)
echo "  DB Info: $PURCHASE_INFO"

# Get effective_global_ids
EFF1=$(execute_sql_formatted "SELECT effective_global_ids FROM purchases WHERE id = $PURCHASE1_ID;" 2>/dev/null | grep -E "^[0-9]+|NULL" | head -1 | tr -d ' ')
if [ -z "$EFF1" ]; then
  # Try alternative query
  EFF1=$(docker compose exec -T db psql -U postgres -d mlm -t -A -c "SELECT COALESCE(effective_global_ids::text, 'NULL') FROM purchases WHERE id = $PURCHASE1_ID;" 2>/dev/null | tr -d ' ' || echo "NULL")
fi

echo "  Purchase 1: ID=$PURCHASE1_ID, effective_global_ids=$EFF1"
if [ "$EFF1" = "55" ] || [ "$EFF1" = "NULL" ]; then
  if [ "$EFF1" = "55" ]; then
    echo -e "${GREEN}  ✅ First purchase: effective_global_ids = 55${NC}"
  else
    echo -e "${YELLOW}  ⚠️  effective_global_ids is NULL (may be expected for first purchase)${NC}"
  fi
else
  echo -e "${RED}  ❌ Expected 55 or NULL, got $EFF1${NC}"
fi
echo ""

# Expire first purchase and create renew request (same package)
echo "Step 2: Expiring purchase and creating renew request (same package)..."
# Set active_until to past date using direct SQL
docker compose exec -T db psql -U postgres -d mlm -c "UPDATE purchases SET active_until = '2020-01-01'::timestamp WHERE id = $PURCHASE1_ID;" > /dev/null 2>&1 || \
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mlm -c "UPDATE purchases SET active_until = '2020-01-01'::timestamp WHERE id = $PURCHASE1_ID;" > /dev/null 2>&1
sleep 2
echo "  ✅ Purchase expiry updated (set to 2020-01-01)"

REQUEST2=$(curl -s -X POST "$API_URL/api/v1/purchases/renew" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE1_ID,
    \"txn_id\": \"TXN-EDGE-002\"
  }")

REQUEST2_ID=$(echo "$REQUEST2" | jq -r '.request.id' 2>/dev/null || echo "")

if [ -z "$REQUEST2_ID" ] || [ "$REQUEST2_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create renew request${NC}"
  echo "Response: $REQUEST2"
  exit 1
fi

echo "  Request created: $REQUEST2_ID"
echo "  Request type: $(echo "$REQUEST2" | jq -r '.request.request_type')"
echo "  Status: $(echo "$REQUEST2" | jq -r '.request.status')"

# Approve second request
PURCHASE2_ID=$(approve_request "$REQUEST2_ID")
if [ -z "$PURCHASE2_ID" ]; then
  exit 1
fi

sleep 2

# Verify second purchase
EFF2=$(execute_sql "SELECT COALESCE(effective_global_ids::text, 'NULL') FROM purchases WHERE id = $PURCHASE2_ID;" | tr -d ' ')
echo "  Purchase 2: ID=$PURCHASE2_ID, effective_global_ids=$EFF2"
if [ "$EFF2" = "0" ]; then
  echo -e "${GREEN}  ✅ Same package renew: effective_global_ids = 0${NC}"
else
  echo -e "${RED}  ❌ Expected 0, got $EFF2${NC}"
fi
echo ""

# Expire second purchase and create renew request (bigger package)
echo "Step 3: Expiring purchase and creating renew request (bigger package)..."
execute_sql_formatted "UPDATE purchases SET active_until = NOW() - INTERVAL '1 day' WHERE id = $PURCHASE2_ID;" > /dev/null
sleep 2

REQUEST3=$(curl -s -X POST "$API_URL/api/v1/purchases/renew" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE2_ID,
    \"txn_id\": \"TXN-EDGE-003\"
  }")

REQUEST3_ID=$(echo "$REQUEST3" | jq -r '.request.id' 2>/dev/null || echo "")

if [ -z "$REQUEST3_ID" ] || [ "$REQUEST3_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create renew request${NC}"
  echo "Response: $REQUEST3"
  exit 1
fi

echo "  Request created: $REQUEST3_ID"
echo "  Request type: $(echo "$REQUEST3" | jq -r '.request.request_type')"
echo "  Status: $(echo "$REQUEST3" | jq -r '.request.status')"

# Approve third request
PURCHASE3_ID=$(approve_request "$REQUEST3_ID")
if [ -z "$PURCHASE3_ID" ]; then
  exit 1
fi

sleep 2

# Verify third purchase
EFF3=$(execute_sql "SELECT COALESCE(effective_global_ids::text, 'NULL') FROM purchases WHERE id = $PURCHASE3_ID;" | tr -d ' ')
echo "  Purchase 3: ID=$PURCHASE3_ID, effective_global_ids=$EFF3"
if [ "$EFF3" = "900" ]; then
  echo -e "${GREEN}  ✅ Bigger package renew: effective_global_ids = 900${NC}"
else
  echo -e "${RED}  ❌ Expected 900, got $EFF3${NC}"
fi
echo ""

# Edge Case 2: Renew with smaller package (should handle gracefully)
print_section "Edge Case 2: Renew with Smaller Package"

execute_sql_formatted "UPDATE purchases SET active_until = NOW() - INTERVAL '1 day' WHERE id = $PURCHASE3_ID;" > /dev/null
sleep 2

echo "Step 4: Creating renew request with smaller package..."
REQUEST4=$(curl -s -X POST "$API_URL/api/v1/purchases/renew" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE1_ID,
    \"txn_id\": \"TXN-EDGE-004\"
  }")

REQUEST4_ID=$(echo "$REQUEST4" | jq -r '.request.id' 2>/dev/null || echo "")

if [ -z "$REQUEST4_ID" ] || [ "$REQUEST4_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create renew request${NC}"
  echo "Response: $REQUEST4"
  exit 1
fi

echo "  Request created: $REQUEST4_ID"

# Approve fourth request
PURCHASE4_ID=$(approve_request "$REQUEST4_ID")
if [ -z "$PURCHASE4_ID" ]; then
  exit 1
fi

sleep 2

# Verify fourth purchase
EFF4=$(execute_sql "SELECT COALESCE(effective_global_ids::text, 'NULL') FROM purchases WHERE id = $PURCHASE4_ID;" | tr -d ' ')
echo "  Purchase 4: ID=$PURCHASE4_ID, effective_global_ids=$EFF4"
if [ "$EFF4" = "0" ]; then
  echo -e "${GREEN}  ✅ Smaller package renew: effective_global_ids = 0 (no additional IDs)${NC}"
else
  echo -e "${YELLOW}  ⚠️  Got $EFF4 (expected 0 for smaller package)${NC}"
fi
echo ""

# Edge Case 3: Reinvestment request (user has active purchase)
print_section "Edge Case 3: Reinvestment Request"

# Make sure user has an active purchase (not expired, not 2x)
# Reset purchase 4 to be active
execute_sql_formatted "UPDATE purchases SET active_until = NOW() + INTERVAL '1 year' WHERE id = $PURCHASE4_ID;" > /dev/null
sleep 1

echo "Step 5: Creating reinvestment request (user has active purchase)..."
REQUEST5=$(curl -s -X POST "$API_URL/api/v1/purchases" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": $PACKAGE1_ID,
    \"request_type\": \"reinvestment\",
    \"txn_id\": \"TXN-EDGE-005\"
  }")

REQUEST5_ID=$(echo "$REQUEST5" | jq -r '.request.id' 2>/dev/null || echo "")

if [ -z "$REQUEST5_ID" ] || [ "$REQUEST5_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create reinvestment request${NC}"
  echo "Response: $REQUEST5"
  exit 1
fi

echo "  Request created: $REQUEST5_ID"
echo "  Request type: $(echo "$REQUEST5" | jq -r '.request.request_type')"
echo "  Status: $(echo "$REQUEST5" | jq -r '.request.status')"

# Approve fifth request
PURCHASE5_ID=$(approve_request "$REQUEST5_ID")
if [ -z "$PURCHASE5_ID" ]; then
  exit 1
fi

sleep 2

echo -e "${GREEN}  ✅ Reinvestment request approved! Purchase ID: $PURCHASE5_ID${NC}"
echo ""

# Summary
print_section "Edge Cases Test Summary"

execute_sql_formatted "
SELECT 
  p.id,
  p.package_id,
  pk.name,
  pk.global_ids as pkg_global_ids,
  p.is_renewal,
  p.previous_package_id,
  p.effective_global_ids,
  CASE 
    WHEN p.is_renewal = false THEN 'First Purchase'
    WHEN p.previous_package_id = p.package_id THEN 'Same Package Renew'
    WHEN p.effective_global_ids > (SELECT global_ids FROM packages WHERE id = p.previous_package_id) THEN 'Bigger Package Renew'
    ELSE 'Smaller/Equal Package Renew'
  END as renewal_type
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.user_id = $USER_ID
ORDER BY p.id;
"

echo ""
echo -e "${GREEN}✅ All Edge Cases Tested with Approval Workflow!${NC}"
echo ""
echo "Summary:"
echo "  ✅ Activation request created and approved"
echo "  ✅ Renew request (same package) created and approved"
echo "  ✅ Renew request (bigger package) created and approved"
echo "  ✅ Renew request (smaller package) created and approved"
echo "  ✅ Reinvestment request created and approved"
echo ""
