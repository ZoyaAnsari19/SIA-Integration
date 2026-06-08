# Withdrawal Approval Verification

## Database Queries to Verify Withdrawal Approval

### 1. Check Withdrawal Request Status
```sql
-- Check if withdrawal request status changed from 'pending' to 'approved'
SELECT 
    id,
    user_id,
    amount,
    status,
    withdraw_type,
    payment_method,
    processed_at,
    processed_by,
    created_at,
    updated_at
FROM withdraw_requests
WHERE status = 'approved'
ORDER BY processed_at DESC
LIMIT 10;
```

### 2. Check Specific Withdrawal Request (Replace {request_id} with actual ID)
```sql
-- Check specific withdrawal request details
SELECT 
    id,
    user_id,
    amount,
    status,
    withdraw_type,
    payment_method,
    account_details,
    processed_at,
    processed_by,
    remarks,
    created_at,
    updated_at
FROM withdraw_requests
WHERE id = {request_id};  -- Replace with actual request ID
```

### 3. Check User Wallet Balance (After Approval)
```sql
-- Check if wallet balance was deducted correctly
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    u.wallet_balance,
    wr.id as withdrawal_id,
    wr.amount as withdrawal_amount,
    wr.status,
    wr.processed_at
FROM users u
JOIN withdraw_requests wr ON u.id = wr.user_id
WHERE wr.status = 'approved'
ORDER BY wr.processed_at DESC
LIMIT 10;
```

### 4. Check Wallet Ledger Entries (Deduction Records)
```sql
-- Check wallet ledger entries for withdrawal deductions
SELECT 
    id,
    user_id,
    amount,
    transaction_type,
    reason,
    reference_id,
    reference_type,
    created_at
FROM wallet_ledger
WHERE reference_type = 'withdraw_request'
   OR reference_type = 'withdraw_request_charges'
ORDER BY created_at DESC
LIMIT 20;
```

### 5. Verify Admin Charges Were Applied
```sql
-- Check if admin charges were deducted
SELECT 
    id,
    user_id,
    amount,
    transaction_type,
    reason,
    reference_id,
    reference_type,
    created_at
FROM wallet_ledger
WHERE reason = 'WITHDRAWAL_CHARGES'
ORDER BY created_at DESC
LIMIT 10;
```

### 6. Check Recent Approved Withdrawals (Last 24 Hours)
```sql
-- Check withdrawals approved in last 24 hours
SELECT 
    wr.id,
    wr.user_id,
    u.name as user_name,
    u.email as user_email,
    wr.amount,
    wr.status,
    wr.processed_at,
    wr.processed_by,
    wr.withdraw_type,
    wr.payment_method
FROM withdraw_requests wr
JOIN users u ON wr.user_id = u.id
WHERE wr.status = 'approved'
  AND wr.processed_at >= NOW() - INTERVAL '24 hours'
ORDER BY wr.processed_at DESC;
```

### 7. Verify Integration - Check Pending vs Approved Count
```sql
-- Compare pending vs approved withdrawals
SELECT 
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount
FROM withdraw_requests
GROUP BY status
ORDER BY status;
```

## Expected Results After Approval

When a withdrawal is approved, you should see:

1. **withdraw_requests table:**
   - `status` = 'approved' (was 'pending')
   - `processed_at` = current timestamp (was NULL)
   - `processed_by` = admin user_id (was NULL)
   - `updated_at` = current timestamp

2. **users table:**
   - `wallet_balance` decreased by (withdrawal_amount + admin_charges)

3. **wallet_ledger table:**
   - Entry with `reason` = 'WITHDRAWAL' and `amount` = withdrawal_amount
   - Entry with `reason` = 'WITHDRAWAL_CHARGES' and `amount` = admin_charges (if charges > 0)
   - Both entries have `reference_type` = 'withdraw_request' or 'withdraw_request_charges'
   - Both entries have `reference_id` = withdrawal_request_id

## Quick Verification Query (All-in-One)
```sql
-- Complete verification for a specific withdrawal request
SELECT 
    wr.id as withdrawal_id,
    wr.user_id,
    u.name as user_name,
    u.wallet_balance as current_balance,
    wr.amount as withdrawal_amount,
    wr.status,
    wr.processed_at,
    wr.processed_by,
    wr.created_at as request_created,
    wr.updated_at as last_updated,
    (SELECT COUNT(*) FROM wallet_ledger 
     WHERE reference_id = wr.id 
       AND reference_type IN ('withdraw_request', 'withdraw_request_charges')) as ledger_entries_count,
    (SELECT SUM(amount) FROM wallet_ledger 
     WHERE reference_id = wr.id 
       AND reference_type IN ('withdraw_request', 'withdraw_request_charges')) as total_deducted
FROM withdraw_requests wr
JOIN users u ON wr.user_id = u.id
WHERE wr.id = {request_id}  -- Replace with actual request ID
ORDER BY wr.processed_at DESC;
```

## Integration Status

✅ **Frontend Integration:**
- `approveWithdrawal()` function in `src/lib/api/withdraw.ts`
- `handleApprove()` in `src/app/withdraw/pending-withdraw/page.tsx`
- API endpoint: `POST /api/v1/admin/withdraw/requests/:id/approve`

✅ **Backend Implementation:**
- Endpoint: `POST /api/v1/admin/withdraw/requests/:id/approve`
- Updates `withdraw_requests.status` to 'approved'
- Sets `processed_at` and `processed_by`
- Deducts amount from user wallet
- Creates wallet ledger entries
- Applies admin charges (if configured)

## Test Verification Steps

1. **Before Approval:**
   ```sql
   SELECT id, user_id, amount, status, processed_at 
   FROM withdraw_requests 
   WHERE status = 'pending' 
   ORDER BY created_at DESC LIMIT 1;
   ```

2. **Approve via UI:**
   - Go to `/withdraw/pending-withdraw`
   - Click approve button on a pending request
   - Confirm approval

3. **After Approval - Verify:**
   ```sql
   SELECT id, user_id, amount, status, processed_at, processed_by 
   FROM withdraw_requests 
   WHERE id = {request_id};
   ```

4. **Check Wallet Deduction:**
   ```sql
   SELECT * FROM wallet_ledger 
   WHERE reference_id = {request_id} 
     AND reference_type LIKE 'withdraw_request%'
   ORDER BY created_at DESC;
   ```

