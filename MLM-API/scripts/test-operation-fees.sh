#!/bin/bash
set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          OPERATION FEES TEST - CURL COMMANDS                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Seed Operation Fee Rules${NC}"
echo "=========================================="
echo "Running: npm run seed:fees"
npm run seed:fees
echo ""

echo -e "${BLUE}Step 2: Create Test Users${NC}"
echo "=========================================="

# Create User 1 (Main Test User)
echo "Creating User 1..."
USER1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User 1",
    "email": "testuser1@example.com"
  }')
USER1_ID=$(echo $USER1_RESP | jq -r '.id')
echo "✅ User 1 Created: ID = $USER1_ID"
echo ""

# Create User 2 (For ID Transfer)
echo "Creating User 2..."
USER2_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User 2",
    "email": "testuser2@example.com"
  }')
USER2_ID=$(echo $USER2_RESP | jq -r '.id')
echo "✅ User 2 Created: ID = $USER2_ID"
echo ""

# Login User 1
echo -e "${BLUE}Step 3: Login User 1${NC}"
echo "=========================================="
LOGIN_RESP=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"testuser1@example.com\"}")
TOKEN=$(echo $LOGIN_RESP | jq -r '.token')
echo "✅ Token: ${TOKEN:0:50}..."
echo ""

# Check initial wallet balance
echo -e "${BLUE}Step 4: Check Initial Wallet Balance${NC}"
echo "=========================================="
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
INITIAL_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Initial Balance: ₹$INITIAL_BALANCE"
echo ""

# Add some balance for testing (via admin or manual)
echo -e "${YELLOW}Note: Adding ₹100 to wallet for testing...${NC}"
echo "You may need to manually add balance via admin API or database"
echo ""

echo -e "${BLUE}Step 5: Test Account Details Change Fee${NC}"
echo "=========================================="
echo "Testing: PUT /api/v1/profile"
echo ""
ACCOUNT_CHANGE_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PUT "$API_BASE/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test User 1",
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai"
  }')
HTTP_CODE=$(echo "$ACCOUNT_CHANGE_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$ACCOUNT_CHANGE_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Account details updated successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after account change
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after account change: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 6: Test OTP Send Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/auth/otp/send"
echo ""
OTP_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210"
  }')
HTTP_CODE=$(echo "$OTP_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$OTP_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ OTP sent successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after OTP
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after OTP send: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 7: Test Fund Withdraw Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/withdraw/requests"
echo ""
WITHDRAW_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/withdraw/requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "payment_method": "bank_transfer",
    "account_details": "Account: 1234567890, IFSC: SBIN0001234",
    "withdraw_type": "wallet"
  }')
HTTP_CODE=$(echo "$WITHDRAW_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$WITHDRAW_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ Withdraw request created successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after withdraw
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after withdraw request: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 8: Test ID Transfer Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/users/$USER1_ID/transfer"
echo ""
ID_TRANSFER_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/users/$USER1_ID/transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"new_referrer_user_id\": \"$USER2_ID\"
  }")
HTTP_CODE=$(echo "$ID_TRANSFER_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$ID_TRANSFER_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ ID transfer successful${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after ID transfer
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after ID transfer: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 9: Test KYC Apply Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/users/$USER1_ID/kyc/submit"
echo ""
KYC_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/users/$USER1_ID/kyc/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "bank_account_no": "1234567890",
    "bank_ifsc": "SBIN0001234",
    "bank_name": "State Bank of India",
    "documents": [
      {
        "document_type": "aadhar",
        "document_number": "123456789012",
        "front_image_url": "https://example.com/aadhar-front.jpg"
      }
    ]
  }')
HTTP_CODE=$(echo "$KYC_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$KYC_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ KYC submitted successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after KYC
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after KYC submit: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 10: Check Fee Transactions${NC}"
echo "=========================================="
echo "Testing: GET /api/v1/users/$USER1_ID/wallet/transactions"
echo ""
TRANSACTIONS_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet/transactions?limit=20" \
  -H "Authorization: Bearer $TOKEN")
echo "Recent transactions:"
echo "$TRANSACTIONS_RESP" | jq '.items[] | {id, amount, created_at, commission_type}' | head -20
echo ""

echo -e "${BLUE}Step 11: Check Fee Rules (Admin)${NC}"
echo "=========================================="
echo "Testing: GET /api/v1/admin/fees/rules"
echo -e "${YELLOW}Note: Requires admin token${NC}"
echo ""
echo "To check fee rules, use:"
echo "curl -X GET \"$API_BASE/admin/fees/rules\" \\"
echo "  -H \"Authorization: Bearer <ADMIN_TOKEN>\""
echo ""

echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    TEST COMPLETED!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Summary:"
echo "- Account Change Fee: Tested"
echo "- OTP Send Fee: Tested"
echo "- Fund Withdraw Fee: Tested"
echo "- ID Transfer Fee: Tested"
echo "- KYC Apply Fee: Tested"
echo ""
echo "Check wallet balance and transactions to verify fee deductions!"

set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          OPERATION FEES TEST - CURL COMMANDS                   ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Seed Operation Fee Rules${NC}"
echo "=========================================="
echo "Running: npm run seed:fees"
npm run seed:fees
echo ""

echo -e "${BLUE}Step 2: Create Test Users${NC}"
echo "=========================================="

# Create User 1 (Main Test User)
echo "Creating User 1..."
USER1_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User 1",
    "email": "testuser1@example.com"
  }')
USER1_ID=$(echo $USER1_RESP | jq -r '.id')
echo "✅ User 1 Created: ID = $USER1_ID"
echo ""

# Create User 2 (For ID Transfer)
echo "Creating User 2..."
USER2_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User 2",
    "email": "testuser2@example.com"
  }')
USER2_ID=$(echo $USER2_RESP | jq -r '.id')
echo "✅ User 2 Created: ID = $USER2_ID"
echo ""

# Login User 1
echo -e "${BLUE}Step 3: Login User 1${NC}"
echo "=========================================="
LOGIN_RESP=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"testuser1@example.com\"}")
TOKEN=$(echo $LOGIN_RESP | jq -r '.token')
echo "✅ Token: ${TOKEN:0:50}..."
echo ""

# Check initial wallet balance
echo -e "${BLUE}Step 4: Check Initial Wallet Balance${NC}"
echo "=========================================="
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
INITIAL_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Initial Balance: ₹$INITIAL_BALANCE"
echo ""

# Add some balance for testing (via admin or manual)
echo -e "${YELLOW}Note: Adding ₹100 to wallet for testing...${NC}"
echo "You may need to manually add balance via admin API or database"
echo ""

echo -e "${BLUE}Step 5: Test Account Details Change Fee${NC}"
echo "=========================================="
echo "Testing: PUT /api/v1/profile"
echo ""
ACCOUNT_CHANGE_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X PUT "$API_BASE/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Test User 1",
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai"
  }')
HTTP_CODE=$(echo "$ACCOUNT_CHANGE_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$ACCOUNT_CHANGE_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ Account details updated successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after account change
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after account change: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 6: Test OTP Send Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/auth/otp/send"
echo ""
OTP_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/auth/otp/send" \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210"
  }')
HTTP_CODE=$(echo "$OTP_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$OTP_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ OTP sent successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after OTP
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after OTP send: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 7: Test Fund Withdraw Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/withdraw/requests"
echo ""
WITHDRAW_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/withdraw/requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50,
    "payment_method": "bank_transfer",
    "account_details": "Account: 1234567890, IFSC: SBIN0001234",
    "withdraw_type": "wallet"
  }')
HTTP_CODE=$(echo "$WITHDRAW_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$WITHDRAW_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ Withdraw request created successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after withdraw
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after withdraw request: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 8: Test ID Transfer Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/users/$USER1_ID/transfer"
echo ""
ID_TRANSFER_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/users/$USER1_ID/transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"new_referrer_user_id\": \"$USER2_ID\"
  }")
HTTP_CODE=$(echo "$ID_TRANSFER_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$ID_TRANSFER_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ ID transfer successful${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after ID transfer
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after ID transfer: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 9: Test KYC Apply Fee${NC}"
echo "=========================================="
echo "Testing: POST /api/v1/users/$USER1_ID/kyc/submit"
echo ""
KYC_RESP=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_BASE/users/$USER1_ID/kyc/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "bank_account_no": "1234567890",
    "bank_ifsc": "SBIN0001234",
    "bank_name": "State Bank of India",
    "documents": [
      {
        "document_type": "aadhar",
        "document_number": "123456789012",
        "front_image_url": "https://example.com/aadhar-front.jpg"
      }
    ]
  }')
HTTP_CODE=$(echo "$KYC_RESP" | grep "HTTP_CODE" | cut -d':' -f2)
RESP_BODY=$(echo "$KYC_RESP" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ KYC submitted successfully${NC}"
  echo "$RESP_BODY" | jq .
else
  echo -e "${RED}❌ Error (HTTP $HTTP_CODE):${NC}"
  echo "$RESP_BODY" | jq .
fi
echo ""

# Check wallet after KYC
BALANCE_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
NEW_BALANCE=$(echo $BALANCE_RESP | jq -r '.balance // 0')
echo "💰 Balance after KYC submit: ₹$NEW_BALANCE"
echo ""

echo -e "${BLUE}Step 10: Check Fee Transactions${NC}"
echo "=========================================="
echo "Testing: GET /api/v1/users/$USER1_ID/wallet/transactions"
echo ""
TRANSACTIONS_RESP=$(curl -s -X GET "$API_BASE/users/$USER1_ID/wallet/transactions?limit=20" \
  -H "Authorization: Bearer $TOKEN")
echo "Recent transactions:"
echo "$TRANSACTIONS_RESP" | jq '.items[] | {id, amount, created_at, commission_type}' | head -20
echo ""

echo -e "${BLUE}Step 11: Check Fee Rules (Admin)${NC}"
echo "=========================================="
echo "Testing: GET /api/v1/admin/fees/rules"
echo -e "${YELLOW}Note: Requires admin token${NC}"
echo ""
echo "To check fee rules, use:"
echo "curl -X GET \"$API_BASE/admin/fees/rules\" \\"
echo "  -H \"Authorization: Bearer <ADMIN_TOKEN>\""
echo ""

echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}                    TEST COMPLETED!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Summary:"
echo "- Account Change Fee: Tested"
echo "- OTP Send Fee: Tested"
echo "- Fund Withdraw Fee: Tested"
echo "- ID Transfer Fee: Tested"
echo "- KYC Apply Fee: Tested"
echo ""
echo "Check wallet balance and transactions to verify fee deductions!"


