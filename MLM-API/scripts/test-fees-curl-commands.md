# Operation Fees Test - CURL Commands

Complete set of curl commands to test all operation fees functionality.

## Prerequisites

1. **Seed Fee Rules:**
```bash
npm run seed:fees
# Or
npx tsx scripts/seed-operation-fees.ts
```

2. **Start Server:**
```bash
npm run dev
# Or
docker-compose up
```

3. **Get Admin Token** (for admin endpoints):
```bash
# Login as admin to get token
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com"}'
```

---

## Test 1: Account Details Change Fee

### Step 1: Register User
```bash
curl -X POST http://localhost:3000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com"
  }'
```

### Step 2: Login
```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Step 3: Check Initial Balance
```bash
USER_ID="<user_id_from_register>"
TOKEN="<token_from_login>"

curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Update Account Details (Fee will be deducted)
```bash
curl -X PUT http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }'
```

### Step 5: Check Balance After Update
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Balance should decrease by ACCOUNT_CHANGE fee amount (if fee > 0)

---

## Test 2: OTP Send Fee

### Send OTP (Fee will be deducted if user exists)
```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210"
  }'
```

**Expected:** 
- If user exists with this phone: Fee deducted (₹1 default)
- If user not found: OTP sent without fee (for registration)

### Check Balance After OTP
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 3: Fund Withdraw Fee

### Create Withdraw Request (Fee will be deducted)
```bash
curl -X POST http://localhost:3000/api/v1/withdraw/requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "payment_method": "bank_transfer",
    "account_details": "Account: 1234567890, IFSC: SBIN0001234",
    "withdraw_type": "wallet"
  }'
```

**Expected:** 
- Fee deducted before creating withdraw request
- If insufficient balance: Error returned

### Check Balance After Withdraw Request
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 4: ID Transfer Fee

### Step 1: Create Second User (as new referrer)
```bash
curl -X POST http://localhost:3000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Referrer User",
    "email": "referrer@example.com"
  }'
```

### Step 2: Transfer ID (Fee will be deducted)
```bash
USER_ID="<your_user_id>"
NEW_REFERRER_ID="<referrer_user_id>"

curl -X POST "http://localhost:3000/api/v1/users/$USER_ID/transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"new_referrer_user_id\": \"$NEW_REFERRER_ID\"
  }"
```

**Expected:** 
- Fee deducted before referrer change
- Referrer updated successfully
- Closure table rebuilt

### Check Balance After Transfer
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 5: KYC Apply Fee

### Submit KYC (Fee will be deducted)
```bash
curl -X POST "http://localhost:3000/api/v1/users/$USER_ID/kyc/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "aadhar_number": "123456789012",
    "bank_account_no": "1234567890",
    "bank_ifsc": "SBIN0001234",
    "bank_name": "State Bank of India",
    "documents": [
      {
        "document_type": "aadhar",
        "document_number": "123456789012",
        "front_image_url": "https://example.com/aadhar-front.jpg",
        "back_image_url": "https://example.com/aadhar-back.jpg"
      }
    ]
  }'
```

**Expected:** 
- Fee deducted before KYC submission
- KYC status changed to "submitted"

### Check Balance After KYC
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 6: Check Fee Transactions

### View Wallet Transactions
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet/transactions?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Should see fee deduction entries with `commission_type: "FEE_DEDUCTION"`

---

## Test 7: Admin - Manage Fee Rules

### List All Fee Rules
```bash
ADMIN_TOKEN="<admin_token>"

curl -X GET http://localhost:3000/api/v1/admin/fees/rules \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Update Fee Amount
```bash
RULE_ID="<rule_id_from_list>"

curl -X PUT "http://localhost:3000/api/v1/admin/fees/rules/$RULE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "is_active": true
  }'
```

### Create New Fee Rule
```bash
curl -X POST http://localhost:3000/api/v1/admin/fees/rules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_code": "CUSTOM_OP",
    "rule_name": "Custom Operation Fee",
    "description": "Fee for custom operation",
    "amount": 5,
    "is_active": true,
    "applies_to": "all_users"
  }'
```

---

## Test 8: Insufficient Balance Scenario

### Test with Low Balance
1. Ensure user has low balance (₹0 or ₹1)
2. Try to perform any operation (e.g., account change)
3. Should get error:

```bash
curl -X PUT http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Name"
  }'
```

**Expected Response:**
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient balance. Required: ₹10.00, Available: ₹1.00",
  "required_amount": 10,
  "available_balance": 1
}
```

---

## Quick Test Script

Run the automated test script:

```bash
./scripts/test-operation-fees.sh
```

Or manually:

```bash
bash scripts/test-operation-fees.sh
```

---

## Expected Results

After running all tests:

1. ✅ All operations should deduct fees (if fee > 0)
2. ✅ Ledger entries should be created for each fee
3. ✅ Wallet balance should decrease by fee amount
4. ✅ Insufficient balance should block operations
5. ✅ Fee transactions should be visible in wallet history
6. ✅ Admin can update fee amounts via API

---

## Troubleshooting

### Fee not being deducted?
- Check if fee rule exists: `GET /api/v1/admin/fees/rules`
- Check if `is_active: true` and `amount > 0`
- Verify user has sufficient balance

### Operation failing?
- Check wallet balance
- Verify fee rule is active
- Check error response for details

### Can't see fee transactions?
- Check wallet transactions endpoint
- Filter by `commission_type: "FEE_DEDUCTION"`
- Verify ledger entries were created


Complete set of curl commands to test all operation fees functionality.

## Prerequisites

1. **Seed Fee Rules:**
```bash
npm run seed:fees
# Or
npx tsx scripts/seed-operation-fees.ts
```

2. **Start Server:**
```bash
npm run dev
# Or
docker-compose up
```

3. **Get Admin Token** (for admin endpoints):
```bash
# Login as admin to get token
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com"}'
```

---

## Test 1: Account Details Change Fee

### Step 1: Register User
```bash
curl -X POST http://localhost:3000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com"
  }'
```

### Step 2: Login
```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Step 3: Check Initial Balance
```bash
USER_ID="<user_id_from_register>"
TOKEN="<token_from_login>"

curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

### Step 4: Update Account Details (Fee will be deducted)
```bash
curl -X PUT http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }'
```

### Step 5: Check Balance After Update
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Balance should decrease by ACCOUNT_CHANGE fee amount (if fee > 0)

---

## Test 2: OTP Send Fee

### Send OTP (Fee will be deducted if user exists)
```bash
curl -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "9876543210"
  }'
```

**Expected:** 
- If user exists with this phone: Fee deducted (₹1 default)
- If user not found: OTP sent without fee (for registration)

### Check Balance After OTP
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 3: Fund Withdraw Fee

### Create Withdraw Request (Fee will be deducted)
```bash
curl -X POST http://localhost:3000/api/v1/withdraw/requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "payment_method": "bank_transfer",
    "account_details": "Account: 1234567890, IFSC: SBIN0001234",
    "withdraw_type": "wallet"
  }'
```

**Expected:** 
- Fee deducted before creating withdraw request
- If insufficient balance: Error returned

### Check Balance After Withdraw Request
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 4: ID Transfer Fee

### Step 1: Create Second User (as new referrer)
```bash
curl -X POST http://localhost:3000/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Referrer User",
    "email": "referrer@example.com"
  }'
```

### Step 2: Transfer ID (Fee will be deducted)
```bash
USER_ID="<your_user_id>"
NEW_REFERRER_ID="<referrer_user_id>"

curl -X POST "http://localhost:3000/api/v1/users/$USER_ID/transfer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"new_referrer_user_id\": \"$NEW_REFERRER_ID\"
  }"
```

**Expected:** 
- Fee deducted before referrer change
- Referrer updated successfully
- Closure table rebuilt

### Check Balance After Transfer
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 5: KYC Apply Fee

### Submit KYC (Fee will be deducted)
```bash
curl -X POST "http://localhost:3000/api/v1/users/$USER_ID/kyc/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "address": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "pan_number": "ABCDE1234F",
    "aadhar_number": "123456789012",
    "bank_account_no": "1234567890",
    "bank_ifsc": "SBIN0001234",
    "bank_name": "State Bank of India",
    "documents": [
      {
        "document_type": "aadhar",
        "document_number": "123456789012",
        "front_image_url": "https://example.com/aadhar-front.jpg",
        "back_image_url": "https://example.com/aadhar-back.jpg"
      }
    ]
  }'
```

**Expected:** 
- Fee deducted before KYC submission
- KYC status changed to "submitted"

### Check Balance After KYC
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Test 6: Check Fee Transactions

### View Wallet Transactions
```bash
curl -X GET "http://localhost:3000/api/v1/users/$USER_ID/wallet/transactions?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** Should see fee deduction entries with `commission_type: "FEE_DEDUCTION"`

---

## Test 7: Admin - Manage Fee Rules

### List All Fee Rules
```bash
ADMIN_TOKEN="<admin_token>"

curl -X GET http://localhost:3000/api/v1/admin/fees/rules \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Update Fee Amount
```bash
RULE_ID="<rule_id_from_list>"

curl -X PUT "http://localhost:3000/api/v1/admin/fees/rules/$RULE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "is_active": true
  }'
```

### Create New Fee Rule
```bash
curl -X POST http://localhost:3000/api/v1/admin/fees/rules \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_code": "CUSTOM_OP",
    "rule_name": "Custom Operation Fee",
    "description": "Fee for custom operation",
    "amount": 5,
    "is_active": true,
    "applies_to": "all_users"
  }'
```

---

## Test 8: Insufficient Balance Scenario

### Test with Low Balance
1. Ensure user has low balance (₹0 or ₹1)
2. Try to perform any operation (e.g., account change)
3. Should get error:

```bash
curl -X PUT http://localhost:3000/api/v1/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Name"
  }'
```

**Expected Response:**
```json
{
  "error": "INSUFFICIENT_BALANCE",
  "message": "Insufficient balance. Required: ₹10.00, Available: ₹1.00",
  "required_amount": 10,
  "available_balance": 1
}
```

---

## Quick Test Script

Run the automated test script:

```bash
./scripts/test-operation-fees.sh
```

Or manually:

```bash
bash scripts/test-operation-fees.sh
```

---

## Expected Results

After running all tests:

1. ✅ All operations should deduct fees (if fee > 0)
2. ✅ Ledger entries should be created for each fee
3. ✅ Wallet balance should decrease by fee amount
4. ✅ Insufficient balance should block operations
5. ✅ Fee transactions should be visible in wallet history
6. ✅ Admin can update fee amounts via API

---

## Troubleshooting

### Fee not being deducted?
- Check if fee rule exists: `GET /api/v1/admin/fees/rules`
- Check if `is_active: true` and `amount > 0`
- Verify user has sufficient balance

### Operation failing?
- Check wallet balance
- Verify fee rule is active
- Check error response for details

### Can't see fee transactions?
- Check wallet transactions endpoint
- Filter by `commission_type: "FEE_DEDUCTION"`
- Verify ledger entries were created


