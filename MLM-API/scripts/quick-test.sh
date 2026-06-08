#!/bin/bash
set -e

API_BASE="http://localhost:3000/api/v1"

echo "🧪 Quick Test - Seeding and First Purchase"
echo "==========================================="

# Seed
echo "📦 Seeding..."
SEED_OUTPUT=$(docker exec mlm-app-1 npx tsx scripts/test-scenario.ts 2>&1)
echo "$SEED_OUTPUT"

# Extract IDs
MAIN_USER_ID=$(echo "$SEED_OUTPUT" | grep "MAIN_USER_ID=" | cut -d'=' -f2)
PKG_ID=$(echo "$SEED_OUTPUT" | grep "PKG_ID=" | cut -d'=' -f2)

echo ""
echo "Extracted IDs:"
echo "  Main User ID: $MAIN_USER_ID"
echo "  Package ID: $PKG_ID"
echo ""

# Login
echo "🔐 Login..."
LOGIN_RESP=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$MAIN_USER_ID}")
echo "Login Response: $LOGIN_RESP"
TOKEN=$(echo $LOGIN_RESP | jq -r .token)
echo "Token: ${TOKEN:0:50}..."
echo ""

# Purchase
echo "💰 Purchase..."
PURCHASE_RESP=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"user_id\":$MAIN_USER_ID,\"package_id\":$PKG_ID}")
echo "$PURCHASE_RESP" | jq .
echo ""

echo "✅ Quick test complete!"

