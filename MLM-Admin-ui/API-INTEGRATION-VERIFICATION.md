# API Integration Verification

## cURL Samples for Testing

### Authentication
```bash
# Admin Login
curl -X POST http://localhost:3006/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Response: {"token":"...","admin":{"role":"admin","authenticated":true}}
```

### Dashboard
```bash
# Get Dashboard Stats
curl -X GET http://localhost:3006/api/v1/admin/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Users Management
```bash
# List Users
curl -X GET "http://localhost:3006/api/v1/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get User by ID
curl -X GET http://localhost:3006/api/v1/admin/users/7 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Update User
curl -X PUT http://localhost:3006/api/v1/admin/users/7 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","email":"updated@example.com"}'

# Activate User
curl -X POST http://localhost:3006/api/v1/admin/users/7/activate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Deactivate User
curl -X POST http://localhost:3006/api/v1/admin/users/7/deactivate \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Commissions
```bash
# Get All Commissions
curl -X GET "http://localhost:3006/api/v1/admin/commissions?commission_type=SPOT&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get User Commissions
curl -X GET "http://localhost:3006/api/v1/admin/users/7/commissions?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Manual Credit
curl -X POST http://localhost:3006/api/v1/admin/commissions/manual-credit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"7","amount":100.00,"commission_type":"SPOT","reason":"Manual adjustment"}'

# Manual Debit
curl -X POST http://localhost:3006/api/v1/admin/commissions/manual-debit \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"7","amount":50.00,"reason":"Manual adjustment"}'
```

### Packages
```bash
# List Packages
curl -X GET "http://localhost:3006/api/v1/admin/packages?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get Package by ID
curl -X GET http://localhost:3006/api/v1/admin/packages/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Create Package
curl -X POST http://localhost:3006/api/v1/admin/packages \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Premium Package","price":2500.00,"validity_months":12,"status":"active"}'

# Update Package
curl -X PUT http://localhost:3006/api/v1/admin/packages/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Package","price":3000.00}'

# Delete Package
curl -X DELETE http://localhost:3006/api/v1/admin/packages/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### KYC Management
```bash
# Get All Profiles
curl -X GET "http://localhost:3006/api/v1/admin/profiles?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get User Documents
curl -X GET http://localhost:3006/api/v1/admin/kyc/7/documents \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Approve KYC
curl -X POST http://localhost:3006/api/v1/admin/kyc/7/approve \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Reject KYC
curl -X POST http://localhost:3006/api/v1/admin/kyc/7/reject \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Document unclear"}'
```

### Withdrawals
```bash
# Get Pending Withdrawals
curl -X GET "http://localhost:3006/api/v1/admin/withdraw/pending?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Approve Withdrawal
curl -X POST http://localhost:3006/api/v1/admin/withdraw/requests/1/approve \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Approved"}'

# Reject Withdrawal
curl -X POST http://localhost:3006/api/v1/admin/withdraw/requests/1/reject \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"rejection_reason":"Insufficient documentation"}'
```

### Master Settings
```bash
# Get Levels
curl -X GET http://localhost:3006/api/v1/admin/levels \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Update Level
curl -X PUT http://localhost:3006/api/v1/admin/levels/2 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","spot_commission_percent":5.0}'

# Get Fee Rules
curl -X GET "http://localhost:3006/api/v1/admin/fees/rules?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get Notices
curl -X GET "http://localhost:3006/api/v1/admin/notices?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get Company Bank Accounts
curl -X GET http://localhost:3006/api/v1/admin/company-bank \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Get Withdrawal Transfer Rules
curl -X GET http://localhost:3006/api/v1/admin/withdrawal-transfer-rules \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Update Withdrawal Transfer Rules
curl -X PUT http://localhost:3006/api/v1/admin/withdrawal-transfer-rules \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"admin_charges":10.00,"min_withdraw":100.00,"min_transfer_amt":10.00}'
```

## Database Check Queries

### Verify User Operations
```sql
-- Check user status after activate/deactivate
SELECT id, name, email, status, updated_at 
FROM users 
WHERE id = 7;

-- Check user update
SELECT id, name, email, kyc_status, updated_at 
FROM users 
WHERE id = 7;

-- Check wallet balance after manual credit/debit
SELECT user_id, balance, updated_at 
FROM user_balances 
WHERE user_id = 7;

-- Check ledger entries for manual operations
SELECT id, receiver_user_id, amount, commission_type, credited_at, metadata 
FROM ledger_entries 
WHERE receiver_user_id = 7 
ORDER BY credited_at DESC 
LIMIT 10;
```

### Verify Package Operations
```sql
-- Check package creation/update
SELECT id, name, price, status, updated_at 
FROM packages 
WHERE id = 1;

-- Verify package deletion (should not exist)
SELECT id, name 
FROM packages 
WHERE id = 1;
```

### Verify KYC Operations
```sql
-- Check KYC status after approve/reject
SELECT id, kyc_status, kyc_verified_at, updated_at 
FROM users 
WHERE id = 7;

-- Check KYC documents
SELECT id, user_id, document_type, status, submitted_at, verified_at 
FROM kyc_documents 
WHERE user_id = 7;
```

### Verify Withdrawal Operations
```sql
-- Check withdrawal request status
SELECT id, user_id, amount, status, processed_at, processed_by, rejection_reason 
FROM withdraw_requests 
WHERE id = 1;

-- Check wallet balance after withdrawal approval
SELECT user_id, balance, updated_at 
FROM user_balances 
WHERE user_id = (SELECT user_id FROM withdraw_requests WHERE id = 1);
```

### Verify Notice Operations
```sql
-- Check notice creation/update
SELECT id, title, content, is_active, created_at, updated_at 
FROM notices 
WHERE id = 1;

-- Verify notice deletion
SELECT id, title 
FROM notices 
WHERE id = 1;
```

### Verify Company Bank Operations
```sql
-- Check company bank account creation/update
SELECT id, bank_name, bank_ac_holder, bank_ac_no, is_active, updated_at 
FROM company_bank_accounts 
WHERE id = 1;

-- Verify company bank account deletion
SELECT id, bank_name 
FROM company_bank_accounts 
WHERE id = 1;
```

### Verify Fee Rules Operations
```sql
-- Check fee rule update
SELECT id, rule_code, rule_name, amount, is_active, updated_at 
FROM fee_rules 
WHERE id = 1;
```

### Verify Levels Operations
```sql
-- Check level update
SELECT level, title, spot_commission_percent, monthly_royalty_percent, updated_at 
FROM levels 
WHERE level = 2;
```

### Verify Withdrawal Transfer Rules
```sql
-- Check withdrawal transfer rules update
SELECT id, admin_charges, min_withdraw, max_withdraw, min_transfer_amt, max_transfer_amt, transfer_amt_tax, is_active, updated_at 
FROM withdrawal_transfer_rules 
WHERE is_active = true;
```

## Basic Integration Test

### Test Script (test-integration.sh)
```bash
#!/bin/bash

API_URL="http://localhost:3006/api/v1"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="password123"

echo "=== Testing Admin Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful"
echo "Token: ${TOKEN:0:20}..."

echo ""
echo "=== Testing Dashboard Data Fetch ==="
DASHBOARD_RESPONSE=$(curl -s -X GET "$API_URL/admin/dashboard" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DASHBOARD_RESPONSE" | jq -e '.total_users' > /dev/null 2>&1; then
  echo "✅ Dashboard data fetched successfully"
  echo "Total Users: $(echo $DASHBOARD_RESPONSE | jq -r '.total_users')"
else
  echo "❌ Dashboard fetch failed"
  echo "Response: $DASHBOARD_RESPONSE"
  exit 1
fi

echo ""
echo "=== Testing Users List Fetch ==="
USERS_RESPONSE=$(curl -s -X GET "$API_URL/admin/users?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN")

if echo "$USERS_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
  echo "✅ Users list fetched successfully"
  echo "Total Users: $(echo $USERS_RESPONSE | jq -r '.total')"
else
  echo "❌ Users list fetch failed"
  echo "Response: $USERS_RESPONSE"
  exit 1
fi

echo ""
echo "=== All Integration Tests Passed ==="
```

