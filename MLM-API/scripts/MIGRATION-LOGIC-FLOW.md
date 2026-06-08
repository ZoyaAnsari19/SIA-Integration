# Migration Logic Flow - Complete

## Complete User Migration Flow

```
1. Check if user exists in DB
├─ If exists → Skip user creation (but continue to check packages/wallet)
└─ If NOT exists → Continue to step 2

2. Find referrer in DB
├─ Sponsor ID se referrer_user_id find karein
├─ If referrer NOT found → Error (cannot create user, skip this user)
└─ If referrer found → Continue to step 3

3. Create user account (only if NOT exists)
├─ Insert into users table
├─ Set default password (123456)
├─ Set status = 'active'
└─ Set referrer_user_id

4. Create user tree paths (only if new user)
├─ Get referrer's upline chain
├─ Create paths for all ancestors
└─ Set depth correctly (depth 1 = direct referrer, depth 2 = level 1, etc.)

5. Create/Update wallet
├─ Excel se spot_balance, other_balance read karein
├─ Calculate total balance = spot_balance + other_balance
└─ INSERT or UPDATE user_balances table

6. IF user has packages in Excel:
│
├─ For each package:
│  ├─ Map package (amount → package_id)
│  │  └─ Find package by amount (tolerance: ±0.01)
│  │
│  ├─ Get package details
│  │  ├─ global_ids (total available)
│  │  ├─ price
│  │  └─ validity_months/days
│  │
│  ├─ Check if purchase already exists
│  │  └─ If exists → Skip this package
│  │
│  ├─ Create purchase record
│  │  ├─ user_id
│  │  ├─ package_id
│  │  ├─ amount (from Excel or package price)
│  │  ├─ purchased_at (from Excel or current date)
│  │  ├─ active_until (calculate: purchased_at + validity)
│  │  ├─ status = 'completed'
│  │  └─ Set metadata if needed
│  │
│  ├─ Check if reinvestment
│  │  ├─ Check: Does user have active purchases BEFORE this purchase date?
│  │  ├─ If YES → is_reinvestment = True
│  │  └─ If NO → is_reinvestment = False
│  │
│  └─ Process SPOT commissions for uplines
│     │
│     ├─ Get all uplines (depth 1 to 10)
│     │
│     ├─ For each upline:
│     │  │
│     │  ├─ Direct Referrer (Level 0, depth 1):
│     │  │  ├─ Calculate: purchase_amount × 5% (Level 0 SPOT)
│     │  │  ├─ Check: Does referrer have active course?
│     │  │  ├─ Check: Are both users active?
│     │  │  ├─ If YES → Credit SPOT immediately ✅
│     │  │  │  ├─ Create ledger_entry (type: SPOT)
│     │  │  │  ├─ Create wallet_transaction
│     │  │  │  └─ Update user_balances (spot_balance)
│     │  │  └─ If NO → Skip (no pending for Level 0)
│     │  │
│     │  └─ Team Uplines (Level 1-9, depth 2-10):
│     │     │
│     │     ├─ Calculate level: level = depth - 1
│     │     │  └─ Example: depth 2 → level 1, depth 3 → level 2
│     │     │
│     │     ├─ Get SPOT percentage
│     │     │  ├─ Read from levels.spot_commission_percent
│     │     │  └─ Fallback: commission_rules table
│     │     │
│     │     ├─ Calculate SPOT amount
│     │     │  └─ spot_amount = purchase_amount × spot_percent / 100
│     │     │
│     │     ├─ Apply reinvestment reduction (if applicable)
│     │     │  ├─ If is_reinvestment AND level >= 1:
│     │     │  │  └─ spot_amount = spot_amount × 0.5 (50% reduction)
│     │     │  └─ If first purchase OR level 0:
│     │     │     └─ No reduction (100%)
│     │     │
│     │     ├─ Check eligibility
│     │     │  └─ eligible = checkEligibility(upline_id, level)
│     │     │     └─ Read from level_eligibility table
│     │     │
│     │     ├─ IF eligible (qualified for level):
│     │     │  ├─ Check: Does upline have active course?
│     │     │  ├─ Check: Are both users active?
│     │     │  ├─ If YES → Credit SPOT immediately ✅
│     │     │  │  ├─ Create ledger_entry (type: SPOT)
│     │     │  │  ├─ Create wallet_transaction
│     │     │  │  └─ Update user_balances (spot_balance)
│     │     │  └─ If NO → Skip (no pending, just skip)
│     │     │
│     │     └─ IF NOT eligible (unqualified for level):
│     │        └─ Add to pending_commissions ⏳
│     │           ├─ receiver_user_id = upline_id
│     │           ├─ source_user_id = buyer_id
│     │           ├─ purchase_id = purchase_id
│     │           ├─ level = level
│     │           ├─ commission_type = 'SPOT'
│     │           ├─ amount = spot_amount (already reduced if reinvestment)
│     │           └─ metadata = {level, depth, reason: 'eligibility', is_reinvestment}
│     │
│     └─ After all uplines processed:
│        └─ Recalculate eligibility (optional, for instant release)
│           └─ This will release pending SPOT if uplines just qualified

7. IF user has NO packages in Excel:
└─ Skip purchase creation (only create user + wallet if new user)

8. Final Steps:
├─ Log summary
│  ├─ Users created
│  ├─ Purchases created
│  ├─ SPOT commissions credited
│  └─ Pending commissions created
└─ Done ✅
```

## Key Points:

### SPOT Commission Logic (Migration):

**Important:** This is MIGRATION logic, different from production purchase flow!

1. **Level 0 (Direct Referrer, depth 1):**
   - SKIP completely ❌
   - No SPOT processing for direct referrer in migration

2. **Level 1-9 (Team Uplines, depth 2-10):**
   - Level-based SPOT percentage (from levels table)
   - First purchase: 100% SPOT amount
   - Reinvestment: 50% SPOT amount (Level 1+ only)
   
   **Rule 1: Qualified Uplines (SKIP completely) ❌**
   - "jo user inke level ko qualified karege unko naaa spot dena hai naaa pending mei add krna hai"
   - If upline is eligible for the level → SKIP
   - NO SPOT commission
   - NO pending_commissions entry
   - Reason: Qualified users don't get retroactive commission in migration
   
   **Rule 2: Unqualified Uplines (Add to pending) ⏳**
   - "jo upline user inke level ko qualified abhi nhi karte unke liye level k hisab se invested amount ka spot amount pending mei add karna hoga"
   - If upline is NOT eligible for the level → Add to pending_commissions
   - Calculate: `spot_amount = invested_amount × level_spot_percent / 100`
   - Will be released when upline qualifies for that level

### Eligibility Check:

- Read from `level_eligibility` table
- Format: `{"1": true, "2": false, ...}`
- Check: `eligibility[str(level)] == true`
- If user not in table → Not eligible (return false)

### Active Course Check:

- User has at least one purchase where:
  - `status = 'completed'`
  - `active_until >= today`
  - SELF + GLOBAL_HELPING < 2x purchase amount

### Reinvestment Detection:

- Check if user has active purchases BEFORE current purchase date
- If YES → reinvestment = True
- If NO → reinvestment = False

## Important Notes (Migration):

1. ✅ **Qualified uplines: SKIP completely** (NO SPOT, NO pending)
   - Reason: They were already qualified, so no retroactive commission
2. ✅ **Unqualified uplines: Add to pending** (will be released when they qualify)
   - Calculate: `spot_amount = invested_amount × level_spot_percent / 100`
3. ✅ **Direct referrer (Level 0): SKIP completely** (not processed in migration)
4. ✅ **Reinvestment reduction applied before creating pending entry**
   - First purchase: 100% of calculated SPOT
   - Reinvestment: 50% of calculated SPOT (Level 1+ only)
5. ✅ **Pending stores already-reduced amount** (50% if reinvestment)
6. ✅ **SPOT amount based on invested amount from Excel** (purchase amount)

