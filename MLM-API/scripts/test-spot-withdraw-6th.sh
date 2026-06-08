#!/bin/bash

# Test script to send spot withdrawal request on 6th (temporarily allowed)
# Usage: ./test-spot-withdraw-6th.sh <user_id> <amount>

API_URL="http://localhost:3002"
USER_DISPLAY_ID=${1:-"SIA02047"}  # Default to SIA02047
AMOUNT=${2:-100}  # Default to ₹100
TRANSACTION_PASSWORD="1234"

echo "=========================================="
echo "Testing Spot Withdrawal Request (6th)"
echo "=========================================="
echo "User Display ID: $USER_DISPLAY_ID"
echo "Amount: ₹$AMOUNT"
echo "Transaction Password: $TRANSACTION_PASSWORD"
echo ""

# Step 1: Login as user using display_id (auth API supports display_id login)
echo "Step 1: Logging in as user $USER_DISPLAY_ID..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$USER_DISPLAY_ID\",
    \"password\": \"password123\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response:"
  echo "$LOGIN_RESPONSE" | jq .
  echo ""
  echo "Trying with different password or checking user..."
  exit 1
fi
echo "✅ Login successful"
echo ""

# Step 2: Check wallet balance
echo "Step 2: Checking wallet balance..."
WALLET_RESPONSE=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $TOKEN")

SPOT_BALANCE=$(echo $WALLET_RESPONSE | jq -r '.spot_balance // 0')
OTHER_BALANCE=$(echo $WALLET_RESPONSE | jq -r '.other_balance // 0')
TOTAL_BALANCE=$(echo $WALLET_RESPONSE | jq -r '.balance // 0')

echo "Spot Balance: ₹$SPOT_BALANCE"
echo "Other Balance: ₹$OTHER_BALANCE"
echo "Total Balance: ₹$TOTAL_BALANCE"
echo ""

# Step 3: Send spot withdrawal request
echo "Step 3: Sending spot withdrawal request..."
WITHDRAW_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/withdraw/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"amount\": $AMOUNT,
    \"withdraw_type\": \"spot\",
    \"payment_method\": \"bank_transfer\",
    \"account_details\": \"{\\\"bank_name\\\":\\\"Test Bank\\\",\\\"account_number\\\":\\\"1234567890\\\",\\\"ifsc\\\":\\\"TEST0001234\\\",\\\"account_holder\\\":\\\"Test User\\\"}\",
    \"transaction_password\": \"$TRANSACTION_PASSWORD\"
  }")

WITHDRAW_ID=$(echo $WITHDRAW_RESPONSE | jq -r '.id // empty')
WITHDRAW_ERROR=$(echo $WITHDRAW_RESPONSE | jq -r '.error // empty')

if [ -n "$WITHDRAW_ERROR" ]; then
  echo "❌ Withdrawal request failed: $WITHDRAW_ERROR"
  echo "$WITHDRAW_RESPONSE" | jq .
  exit 1
fi

if [ -z "$WITHDRAW_ID" ]; then
  echo "❌ Withdrawal request failed - no ID returned"
  echo "$WITHDRAW_RESPONSE" | jq .
  exit 1
fi

echo "✅ Withdrawal request created successfully!"
echo "Request ID: $WITHDRAW_ID"
echo "$WITHDRAW_RESPONSE" | jq '{id, amount, withdraw_type, status, created_at}'
echo ""

# Step 4: Get admin token
echo "Step 4: Getting admin token..."
ADMIN_TOKEN="dev-admin"
echo "✅ Using admin token: $ADMIN_TOKEN"
echo ""

# Step 5: Approve withdrawal (admin)
echo "Step 5: Approving withdrawal request $WITHDRAW_ID..."
APPROVE_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/admin/withdraw/requests/$WITHDRAW_ID/approve" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{}")

APPROVE_ERROR=$(echo $APPROVE_RESPONSE | jq -r '.error // empty')
if [ -n "$APPROVE_ERROR" ]; then
  echo "❌ Approval failed: $APPROVE_ERROR"
  echo "$APPROVE_RESPONSE" | jq .
  exit 1
fi

echo "✅ Withdrawal approved successfully!"
echo "$APPROVE_RESPONSE" | jq '{id, status, withdrawal_amount, withdrawal_processing_fee, admin_charges, total_deducted}'
echo ""

# Step 6: Check wallet balance after approval
echo "Step 6: Checking wallet balance after approval..."
sleep 2
WALLET_AFTER=$(curl -s -X GET "$API_URL/api/v1/dashboard/wallet" \
  -H "Authorization: Bearer $TOKEN")

SPOT_AFTER=$(echo $WALLET_AFTER | jq -r '.spot_balance // 0')
OTHER_AFTER=$(echo $WALLET_AFTER | jq -r '.other_balance // 0')
TOTAL_AFTER=$(echo $WALLET_AFTER | jq -r '.balance // 0')

echo "Spot Balance After: ₹$SPOT_AFTER (was ₹$SPOT_BALANCE)"
echo "Other Balance After: ₹$OTHER_AFTER (was ₹$OTHER_BALANCE)"
echo "Total Balance After: ₹$TOTAL_AFTER (was ₹$TOTAL_BALANCE)"

SPOT_DIFF=$(echo "$SPOT_BALANCE - $SPOT_AFTER" | bc)
TOTAL_DIFF=$(echo "$TOTAL_BALANCE - $TOTAL_AFTER" | bc)

echo ""
echo "Deductions:"
echo "  Spot Balance Deducted: ₹$SPOT_DIFF"
echo "  Total Balance Deducted: ₹$TOTAL_DIFF"
echo "  Expected: ₹$AMOUNT (withdrawal) + processing fee + admin charges"
echo ""

echo "=========================================="
echo "Test Complete!"
echo "=========================================="

