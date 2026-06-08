#!/bin/bash
# Test script for Levels APIs
# Make sure server is running: docker compose up or npm run dev

API_BASE="http://localhost:3000/api/v1"
echo "🧪 Testing Levels APIs"
echo "=========================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "❌ Server is not running!"
  echo "Please start the server first:"
  echo "  docker compose up"
  echo "  OR"
  echo "  npm run dev"
  exit 1
fi

echo "✅ Server is running"
echo ""

# Test 1: Get all levels (requires auth)
echo "📋 Test 1: GET /api/v1/users/levels"
echo "-----------------------------------"
echo "This endpoint requires authentication."
echo "First, login to get a token:"
echo ""
echo "curl -X POST $API_BASE/users/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\": \"YOUR_EMAIL@example.com\"}'"
echo ""
echo "Then use the token:"
echo ""
echo "curl -X GET $API_BASE/users/levels \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""

# Test 2: Get user eligibility
echo "📋 Test 2: GET /api/v1/users/:id/eligibility"
echo "-----------------------------------"
echo "curl -X GET $API_BASE/users/1/eligibility \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN'"
echo ""

# Test 3: Admin - Get all levels
echo "📋 Test 3: GET /api/v1/admin/levels (Admin)"
echo "-----------------------------------"
echo "curl -X GET $API_BASE/admin/levels \\"
echo "  -H 'Authorization: Bearer ADMIN_TOKEN'"
echo ""

# Test 4: Admin - Update level
echo "📋 Test 4: PUT /api/v1/admin/levels/:level (Admin)"
echo "-----------------------------------"
echo "curl -X PUT $API_BASE/admin/levels/1 \\"
echo "  -H 'Authorization: Bearer ADMIN_TOKEN' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{"
echo "    \"title\": \"Company Representative\","
echo "    \"reward\": \"T-shirt and Diary\","
echo "    \"spot_commission_percent\": 2.5,"
echo "    \"monthly_royalty_percent\": 0.30"
echo "  }'"
echo ""

echo "=========================================="
echo "✅ Test commands ready!"
echo ""
echo "Note: Replace YOUR_TOKEN and ADMIN_TOKEN with actual tokens"
echo "      Replace user ID (1) with actual user ID from database"

