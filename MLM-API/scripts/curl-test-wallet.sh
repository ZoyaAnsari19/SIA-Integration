#!/bin/bash
# Test /api/v1/dashboard/wallet with login token
# Usage:
#   ./scripts/curl-test-wallet.sh                    # prompts for userId and password
#   ./scripts/curl-test-wallet.sh SIA02047 mypass    # or pass as args

set -e
API_BASE="${API_BASE:-http://localhost:3000/api/v1}"

if [ -n "$1" ] && [ -n "$2" ]; then
  USER_ID="$1"
  PASSWORD="$2"
else
  echo "Enter userId (display_id / email / mobile):"
  read -r USER_ID
  echo "Enter password:"
  read -rs PASSWORD
  echo ""
fi

echo "=== 1. Login ==="
LOGIN_RESP=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$USER_ID\",\"password\":\"$PASSWORD\"}")

if echo "$LOGIN_RESP" | grep -q '"token"'; then
  TOKEN=$(echo "$LOGIN_RESP" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
  echo "Login OK. Token length: ${#TOKEN}"
else
  echo "Login failed: $LOGIN_RESP"
  exit 1
fi

echo ""
echo "=== 2. GET /dashboard/wallet (with token) ==="
WALLET_RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/dashboard/wallet")

HTTP_STATUS=$(echo "$WALLET_RESP" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$WALLET_RESP" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Response body:"
echo "$BODY" | head -20

if [ "$HTTP_STATUS" = "200" ]; then
  if echo "$BODY" | grep -q "team_royalty_balance"; then
    echo ""
    echo "OK: team_royalty_balance field present, status 200."
  else
    echo ""
    echo "WARN: 200 but team_royalty_balance not found in response."
  fi
else
  echo ""
  echo "FAIL: Expected 200, got $HTTP_STATUS"
  exit 1
fi
