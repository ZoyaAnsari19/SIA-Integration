#!/bin/bash
# Complete curl test commands for Levels APIs
# Usage: ./test-levels-curl.sh

API_BASE="http://localhost:3000/api/v1"
TEST_EMAIL="testkyc@example.com"
TEST_USER_ID="2"

echo "🧪 Levels API Test Commands"
echo "=========================================="
echo ""
echo "⚠️  Make sure server is running first!"
echo "   docker compose up"
echo "   OR"
echo "   npm run dev"
echo ""
echo "=========================================="
echo ""

# Step 1: Login to get token
echo "📝 Step 1: Login to get token"
echo "-----------------------------------"
echo "curl -X POST $API_BASE/users/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\": \"$TEST_EMAIL\"}'"
echo ""
echo "Save the token from response!"
echo ""
echo "=========================================="
echo ""

# Step 2: Get all levels (User API)
echo "📝 Step 2: GET /api/v1/users/levels"
echo "-----------------------------------"
echo "curl -X GET $API_BASE/users/levels \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'Content-Type: application/json' | jq ."
echo ""
echo "Expected: All 10 levels with rewards, percentages"
echo ""
echo "=========================================="
echo ""

# Step 3: Get user eligibility
echo "📝 Step 3: GET /api/v1/users/:id/eligibility"
echo "-----------------------------------"
echo "curl -X GET $API_BASE/users/$TEST_USER_ID/eligibility \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -H 'Content-Type: application/json' | jq ."
echo ""
echo "Expected: User eligibility for all levels with details"
echo ""
echo "=========================================="
echo ""

# Step 4: Admin - Get all levels
echo "📝 Step 4: GET /api/v1/admin/levels (Admin)"
echo "-----------------------------------"
echo "curl -X GET $API_BASE/admin/levels \\"
echo "  -H 'Authorization: Bearer ADMIN_TOKEN' \\"
echo "  -H 'Content-Type: application/json' | jq ."
echo ""
echo "Expected: All levels with full admin details"
echo ""
echo "=========================================="
echo ""

# Step 5: Admin - Update level (example)
echo "📝 Step 5: PUT /api/v1/admin/levels/:level (Admin)"
echo "-----------------------------------"
echo "curl -X PUT $API_BASE/admin/levels/1 \\"
echo "  -H 'Authorization: Bearer ADMIN_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"reward\": \"T-shirt and Diary\","
echo "    \"spot_commission_percent\": 2.5"
echo "  }' | jq ."
echo ""
echo "Expected: Updated level details"
echo ""
echo "=========================================="
echo ""

echo "✅ All test commands ready!"
echo ""
echo "Note: Replace YOUR_TOKEN with actual token from Step 1"
echo "      Replace ADMIN_TOKEN with admin JWT token"

