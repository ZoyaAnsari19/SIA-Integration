#!/bin/bash
# Test Admin Login API

set -e

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ADMIN LOGIN API TEST                                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

echo "📡 API URL: $API_URL"
echo "🔑 Admin Token: $ADMIN_TOKEN"
echo ""

# Test 1: Admin Login with valid token
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Admin Login (Valid Token)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"admin_token\": \"$ADMIN_TOKEN\"}")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract token from response
TOKEN=$(echo "$RESPONSE" | jq -r '.token' 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ FAILED: No token received"
  exit 1
fi

echo "✅ SUCCESS: Admin login successful"
echo "🔐 JWT Token: ${TOKEN:0:50}..."
echo ""

# Test 2: Admin Login with invalid token
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Admin Login (Invalid Token)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"admin_token": "invalid-token"}')

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

ERROR=$(echo "$RESPONSE" | jq -r '.error' 2>/dev/null || echo "")

if [ "$ERROR" = "invalid_admin_token" ]; then
  echo "✅ SUCCESS: Invalid token correctly rejected"
else
  echo "❌ FAILED: Expected 'invalid_admin_token' error"
  exit 1
fi
echo ""

# Test 3: Use JWT token to access admin endpoint
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Test 3: Access Admin Endpoint with JWT Token"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Try to access an admin endpoint (e.g., admin dashboard)
  RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/dashboard" \
    -H "Authorization: Bearer $TOKEN")

  echo "Response:"
  echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
  echo ""

  # Check if we got a valid response (not unauthorized)
  if echo "$RESPONSE" | grep -q "unauthorized\|error"; then
    echo "❌ FAILED: JWT token not accepted by admin endpoint"
    exit 1
  else
    echo "✅ SUCCESS: JWT token accepted by admin endpoint"
  fi
  echo ""
fi

# Test 4: Use direct ADMIN_TOKEN to access admin endpoint (backward compatibility)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Access Admin Endpoint with Direct Token (Backward Compatibility)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/dashboard" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if we got a valid response (not unauthorized)
if echo "$RESPONSE" | grep -q "unauthorized\|error"; then
  echo "❌ FAILED: Direct ADMIN_TOKEN not accepted"
  exit 1
else
  echo "✅ SUCCESS: Direct ADMIN_TOKEN still works (backward compatible)"
fi
echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ALL TESTS PASSED ✅                                          ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Summary:"
echo "  ✅ Admin login with valid token works"
echo "  ✅ Admin login with invalid token correctly rejected"
echo "  ✅ JWT token from login can access admin endpoints"
echo "  ✅ Direct ADMIN_TOKEN still works (backward compatible)"
echo ""

