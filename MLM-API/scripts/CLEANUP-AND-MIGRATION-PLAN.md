# Database Cleanup and Migration Plan

## Database Connection

**Current Database:** `mlm-prod-dump` container
- **Database:** `mlm_commission`
- **User:** `mlm_user`
- **Port:** 5435 (host) → 5432 (container)
- **Connection String:** `postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission`

This matches the MLM-API `.env` file configuration.

## Current Database Stats

- **Users:** 1,928
- **Ledger Entries:** 11,243
- **Wallet Transactions:** 11,231
- **KYC Documents:** 12
- **Purchase Requests:** 3

## Cleanup Steps

### Step 1: Clean Transaction History
- Delete all `ledger_entries`
- Delete all `wallet_transactions`
- Delete all `fee_transactions`

### Step 2: Clean KYC and Activation Requests
- Delete all `kyc_documents`
- Delete all `purchase_requests`

### Step 3: Clear Package Data
- Set `effective_global_ids = NULL` in `purchases` table
- Set `income = 0` in `purchases` table (clears self + global income)

### Step 4: Clear User Wallets
- Reset `balance = 0`
- Reset `spot_balance = 0`
- Reset `other_balance = 0`

### Step 5: Migrate Remaining Users
- Read users from `products-export-3.xlsx`
- Create new users (skip if already exists)
- Set up wallets with Excel amounts
- Create purchase records
- Process SPOT commissions

## SPOT Commission Logic

**Important:** SPOT commissions are only added to `pending_commissions` for **unqualified uplines**.

### Rules:
1. **Qualified Upline** → **NO SPOT** (skip completely, no pending, no credit)
2. **Unqualified Upline** → Calculate SPOT and add to pending:
   - `SPOT amount = invested_amount × level_spot_percent / 100`
   - Add to `pending_commissions` table
   - Will be credited when upline qualifies for that level

### Implementation:
```python
# Check if upline is qualified for that level
eligible = check_eligibility(upline_id, level)

if eligible:
    # Skip qualified upline - NO SPOT
    continue
else:
    # Calculate SPOT amount
    spot_amount = purchase_amount * spot_percent / 100
    
    # Add to pending_commissions
    INSERT INTO pending_commissions (
      receiver_user_id,
      source_user_id,
      purchase_id,
      level,
      commission_type,
      amount
    ) VALUES (...)
```

## How to Run

### Option 1: Run Complete Cleanup and Migration
```bash
cd /Users/faizanansari/Documents/MLM-bilal-sir/MLM
python3 MLM-API/scripts/clean-db-and-migrate.py
```

This will:
1. Verify database connection
2. Show current stats
3. Ask for confirmation before each cleanup step
4. Run migration for remaining users from Excel

### Option 2: Run Migration Only (if cleanup already done)
```bash
cd /Users/faizanansari/Documents/MLM-bilal-sir/MLM
python3 MLM-API/scripts/migrate-new-users.py
```

## Safety Features

- ✅ Database connection verification at start
- ✅ Shows current counts before deletion
- ✅ Confirmation prompts before each destructive operation
- ✅ Skips steps if no data to clean
- ✅ Only migrates NEW users (skips existing users)

## Files

- **Cleanup Script:** `MLM-API/scripts/clean-db-and-migrate.py`
- **Migration Script:** `MLM-API/scripts/migrate-new-users.py`
- **Excel File:** `products-export-3.xlsx`

## Notes

- Both scripts use the same database connection (`mlm-prod-dump`)
- Migration script only creates users that don't exist in the database
- SPOT commissions follow the qualification logic (qualified = no SPOT, unqualified = pending)
- All cleanup operations are reversible only if you have a database backup

