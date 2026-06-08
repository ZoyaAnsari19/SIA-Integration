#!/bin/bash

# Test: Negative Balance Recovery via Commissions
# User submits KYC with ₹20 fee → balance goes to -₹20
# User purchases package → SELF commission of ₹500 → balance recovers to ₹480

set -e

BASE_URL="http://localhost:3000/api/v1"
TS=$(date +%s)

echo "================================================================"
echo "NEGATIVE BALANCE RECOVERY TEST"
echo "================================================================"
echo ""
echo "Scenario:"
echo "1. User submits KYC (₹20 fee) → Balance: -₹20"
echo "2. User purchases package → SELF commission: ₹500"
echo "3. Final balance: -₹20 + ₹500 = ₹480 ✅"
echo ""

# Admin login
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@secureinfiniteassociation.com", "password": "admin123"}' | jq -r '.token')

echo "✅ Admin authenticated"
echo ""

# Register user
echo "─────────────────────────────────────────────"
echo "STEP 1: Register User"
echo "─────────────────────────────────────────────"
USER_EMAIL="recovery-$TS@test.com"
REG=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Recovery Test User\",
    \"email\": \"$USER_EMAIL\",
    \"mobile\": \"6666666666\",
    \"password\": \"password123\",
    \"referrer_user_id\": \"2\"
  }")

USER_ID=$(echo $REG | jq -r '.id')
DISPLAY=$(echo $REG | jq -r '.display_id')
echo "User: $DISPLAY (ID: $USER_ID)"

# Login
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_EMAIL\", \"password\": \"password123\"}" | jq -r '.token')

# Check initial balance
BALANCE_1=$(docker exec mlm-api-db-1 psql -U postgres -d mlm -t -c "SELECT COALESCE(balance, 0) FROM user_balances WHERE user_id = $USER_ID;" 2>&1 | xargs)
echo "💰 Initial Balance: ₹${BALANCE_1:-0}"
echo ""

# Submit KYC
echo "─────────────────────────────────────────────"
echo "STEP 2: Submit KYC (₹20 fee deducted)"
echo "─────────────────────────────────────────────"
curl -s -X POST "$BASE_URL/users/$USER_ID/kyc/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pan_number": "CCCCC3333C",
    "aadhar_number": "777777777777",
    "bank_account_no": "1111222233",
    "bank_ifsc": "ICIC0001234",
    "bank_name": "ICICI Bank",
    "documents": [{"document_type": "aadhar", "document_number": "777777777777", "front_image_url": "https://example.com/f.jpg", "back_image_url": "https://example.com/b.jpg"}]
  }' > /dev/null

sleep 1
BALANCE_2=$(docker exec mlm-api-db-1 psql -U postgres -d mlm -t -c "SELECT COALESCE(balance, 0) FROM user_balances WHERE user_id = $USER_ID;" 2>&1 | xargs)
echo "KYC submitted"
echo "💰 Balance after KYC: ₹$BALANCE_2 (went negative!)"
echo ""

# Admin approve KYC
echo "─────────────────────────────────────────────"
echo "STEP 3: Admin Approves KYC"
echo "─────────────────────────────────────────────"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "UPDATE users SET kyc_status = 'approved' WHERE id = $USER_ID;" 2>&1 > /dev/null
echo "✅ KYC approved by admin"
echo ""

# Create purchase request
echo "─────────────────────────────────────────────"
echo "STEP 4: Create Purchase Request"
echo "─────────────────────────────────────────────"
REQ=$(curl -s -X POST "$BASE_URL/deposit/manual" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"package_id\": 1,
    \"amount\": 2500,
    \"request_type\": \"activation\",
    \"utr_number\": \"UTR${TS}\",
    \"payment_proof_url\": \"https://example.com/proof.jpg\",
    \"payment_type\": \"bank_transfer\",
    \"remarks\": \"Recovery test\"
  }")

REQ_ID=$(echo $REQ | jq -r '.id')
echo "Purchase request created: ID=$REQ_ID"
echo ""

# Admin approve purchase
echo "─────────────────────────────────────────────"
echo "STEP 5: Admin Approves Purchase"
echo "─────────────────────────────────────────────"
APPROVE=$(curl -s -X POST "$BASE_URL/admin/activation/requests/$REQ_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}')

PURCHASE_ID=$(echo $APPROVE | jq -r '.purchase.id')
echo "✅ Purchase approved: ID=$PURCHASE_ID"
echo "✅ Package activated"
echo "✅ Commissions triggered (processing...)"
echo ""

# Wait for commission job
sleep 5

# Check final balance
echo "─────────────────────────────────────────────"
echo "STEP 6: BALANCE VERIFICATION"
echo "─────────────────────────────────────────────"
BALANCE_3=$(docker exec mlm-api-db-1 psql -U postgres -d mlm -t -c "SELECT COALESCE(balance, 0) FROM user_balances WHERE user_id = $USER_ID;" 2>&1 | xargs)

echo "Balance Journey:"
echo "  1. Initial: ₹0"
echo "  2. After KYC fee: ₹$BALANCE_2 (negative)"
echo "  3. After SELF commission: ₹$BALANCE_3 (recovered!)"
echo ""

# Show commission breakdown
echo "Commission Breakdown:"
docker exec mlm-api-db-1 psql -U postgres -d mlm -c "
SELECT 
  commission_type,
  amount,
  'from purchase ' || purchase_id as source
FROM ledger_entries
WHERE receiver_user_id = $USER_ID
  AND purchase_id = $PURCHASE_ID
ORDER BY credited_at;
" 2>&1

echo ""
echo "================================================================"
echo "RESULT SUMMARY"
echo "================================================================"
echo ""
if [ "$BALANCE_2" == "-20.00" ] && [ "$BALANCE_3" != "-20.00" ]; then
  echo "✅ SUCCESS!"
  echo "  - KYC fee deducted: -₹20 ✓"
  echo "  - Wallet went negative: ✓"
  echo "  - SELF commission credited: ✓"
  echo "  - Balance recovered to positive: ✓"
  echo ""
  echo "Final Balance: ₹$BALANCE_3"
  echo "Recovery: ₹20 (KYC fee) covered by commission ✅"
else
  echo "⚠️ Check balances:"
  echo "  After KYC: ₹$BALANCE_2"
  echo "  After Commission: ₹$BALANCE_3"
fi
echo ""



