#!/bin/bash

set -e

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_TOKEN_ENV="${ADMIN_TOKEN:-dev-admin}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ADMIN PACKAGES API TEST                                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📡 API URL: $API_URL"
echo ""

if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq is required but not installed. Please install jq and retry."
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1) Admin login to get JWT token"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"admin_token\": \"$ADMIN_TOKEN_ENV\"}")

echo "Login response:"
echo "$LOGIN_RESPONSE" | jq . || true
echo ""

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "❌ FAILED: Could not obtain admin JWT token"
  exit 1
fi

echo "✅ Got admin JWT token"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2) Create package (POST /api/v1/admin/packages)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/admin/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Package",
    "price": 50000,
    "min_amount": 50000,
    "max_amount": 50000,
    "self_monthly": 5000,
    "self_roi_percent": 10,
    "validity_months": 12,
    "status": "active"
  }')

echo "Create response:"
echo "$CREATE_RESPONSE" | jq . || true
echo ""

PACKAGE_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ -z "$PACKAGE_ID" ]; then
  echo "❌ FAILED: Package not created (no id in response)"
  exit 1
fi

echo "✅ Created package with id: $PACKAGE_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3) Verify package in DB (docker compose exec db psql)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker compose exec -T db psql -U postgres -d mlm -c \
  "SELECT id, name, price, status FROM packages WHERE id = $PACKAGE_ID;" || true

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4) List packages (GET /api/v1/admin/packages)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LIST_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/packages?page=1&limit=10&search=API%20Test%20Package" \
  -H "Authorization: Bearer $TOKEN")

echo "List response (filtered by name):"
echo "$LIST_RESPONSE" | jq . || true
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5) Get package by id (GET /api/v1/admin/packages/:id)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

GET_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/admin/packages/$PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Get response:"
echo "$GET_RESPONSE" | jq . || true
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6) Update package (PUT /api/v1/admin/packages/:id)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/api/v1/admin/packages/$PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 60000,
    "status": "inactive"
  }')

echo "Update response:"
echo "$UPDATE_RESPONSE" | jq . || true
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7) Verify updated values in DB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker compose exec -T db psql -U postgres -d mlm -c \
  "SELECT id, name, price, status FROM packages WHERE id = $PACKAGE_ID;" || true

echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8) Delete package (DELETE /api/v1/admin/packages/:id)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

DELETE_RESPONSE=$(curl -s -X DELETE "$API_URL/api/v1/admin/packages/$PACKAGE_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "Delete response:"
echo "$DELETE_RESPONSE" | jq . || true
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9) Confirm package deleted in DB"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

docker compose exec -T db psql -U postgres -d mlm -c \
  "SELECT id, name, price, status FROM packages WHERE id = $PACKAGE_ID;" || true

echo ""

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ADMIN PACKAGES API TEST COMPLETED                            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""


