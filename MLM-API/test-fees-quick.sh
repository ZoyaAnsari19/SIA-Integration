#!/bin/bash
# Quick Test - Operation Fees
# Usage: ./test-fees-quick.sh

API="http://localhost:3000/api/v1"

echo "🧪 Quick Operation Fees Test"
echo "============================"
echo ""

# 1. Seed fees
echo "1️⃣  Seeding fee rules..."
npm run seed:fees
echo ""

# 2. Register user
echo "2️⃣  Registering test user..."
REGISTER=$(curl -s -X POST "$API/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "Fee Test User", "email": "feetest@example.com"}')
USER_ID=$(echo $REGISTER | jq -r '.id')
echo "✅ User ID: $USER_ID"
echo ""

# 3. Login
echo "3️⃣  Logging in..."
LOGIN=$(curl -s -X POST "$API/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "feetest@example.com"}')
TOKEN=$(echo $LOGIN | jq -r '.token')
echo "✅ Token obtained"
echo ""

# 4. Check balance
echo "4️⃣  Checking wallet balance..."
BALANCE=$(curl -s -X GET "$API/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
echo "💰 Balance: $(echo $BALANCE | jq -r '.balance // 0')"
echo ""

# 5. Test Account Change
echo "5️⃣  Testing Account Change Fee..."
ACCOUNT_CHANGE=$(curl -s -w "\nHTTP:%{http_code}" -X PUT "$API/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "phone": "9876543210"}')
HTTP=$(echo "$ACCOUNT_CHANGE" | grep "HTTP:" | cut -d':' -f2)
if [ "$HTTP" = "200" ]; then
  echo "✅ Account updated"
else
  echo "❌ Failed: HTTP $HTTP"
fi
echo ""

# 6. Test OTP Send
echo "6️⃣  Testing OTP Send Fee..."
OTP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210"}')
HTTP=$(echo "$OTP" | grep "HTTP:" | cut -d':' -f2)
if [ "$HTTP" = "200" ]; then
  echo "✅ OTP sent"
else
  echo "❌ Failed: HTTP $HTTP"
fi
echo ""

# 7. Check final balance
echo "7️⃣  Final wallet balance..."
BALANCE=$(curl -s -X GET "$API/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
echo "💰 Final Balance: $(echo $BALANCE | jq -r '.balance // 0')"
echo ""

# 8. Check transactions
echo "8️⃣  Recent transactions..."
TXNS=$(curl -s -X GET "$API/users/$USER_ID/wallet/transactions?limit=5" \
  -H "Authorization: Bearer $TOKEN")
echo "$TXNS" | jq '.items[] | {amount, created_at}' | head -10
echo ""

echo "✅ Test Complete!"
echo ""
echo "To see all fee rules:"
echo "curl -X GET \"$API/admin/fees/rules\" -H \"Authorization: Bearer <ADMIN_TOKEN>\""

# Quick Test - Operation Fees
# Usage: ./test-fees-quick.sh

API="http://localhost:3000/api/v1"

echo "🧪 Quick Operation Fees Test"
echo "============================"
echo ""

# 1. Seed fees
echo "1️⃣  Seeding fee rules..."
npm run seed:fees
echo ""

# 2. Register user
echo "2️⃣  Registering test user..."
REGISTER=$(curl -s -X POST "$API/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "Fee Test User", "email": "feetest@example.com"}')
USER_ID=$(echo $REGISTER | jq -r '.id')
echo "✅ User ID: $USER_ID"
echo ""

# 3. Login
echo "3️⃣  Logging in..."
LOGIN=$(curl -s -X POST "$API/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "feetest@example.com"}')
TOKEN=$(echo $LOGIN | jq -r '.token')
echo "✅ Token obtained"
echo ""

# 4. Check balance
echo "4️⃣  Checking wallet balance..."
BALANCE=$(curl -s -X GET "$API/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
echo "💰 Balance: $(echo $BALANCE | jq -r '.balance // 0')"
echo ""

# 5. Test Account Change
echo "5️⃣  Testing Account Change Fee..."
ACCOUNT_CHANGE=$(curl -s -w "\nHTTP:%{http_code}" -X PUT "$API/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "phone": "9876543210"}')
HTTP=$(echo "$ACCOUNT_CHANGE" | grep "HTTP:" | cut -d':' -f2)
if [ "$HTTP" = "200" ]; then
  echo "✅ Account updated"
else
  echo "❌ Failed: HTTP $HTTP"
fi
echo ""

# 6. Test OTP Send
echo "6️⃣  Testing OTP Send Fee..."
OTP=$(curl -s -w "\nHTTP:%{http_code}" -X POST "$API/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{"mobile": "9876543210"}')
HTTP=$(echo "$OTP" | grep "HTTP:" | cut -d':' -f2)
if [ "$HTTP" = "200" ]; then
  echo "✅ OTP sent"
else
  echo "❌ Failed: HTTP $HTTP"
fi
echo ""

# 7. Check final balance
echo "7️⃣  Final wallet balance..."
BALANCE=$(curl -s -X GET "$API/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
echo "💰 Final Balance: $(echo $BALANCE | jq -r '.balance // 0')"
echo ""

# 8. Check transactions
echo "8️⃣  Recent transactions..."
TXNS=$(curl -s -X GET "$API/users/$USER_ID/wallet/transactions?limit=5" \
  -H "Authorization: Bearer $TOKEN")
echo "$TXNS" | jq '.items[] | {amount, created_at}' | head -10
echo ""

echo "✅ Test Complete!"
echo ""
echo "To see all fee rules:"
echo "curl -X GET \"$API/admin/fees/rules\" -H \"Authorization: Bearer <ADMIN_TOKEN>\""


