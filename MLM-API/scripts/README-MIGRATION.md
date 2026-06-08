# Migration Script - ₹25,000 and ₹200,000 Package Users

## Overview

This script migrates users with ₹25,000 and ₹200,000 packages from `products-export-3.xlsx` to the database.

## Process

For each user (25 users):

1. **Update wallet balances** - Vanish current balances and set Excel amounts
2. **Map package** - ₹25,000 → Package ID 12, ₹200,000 → Package ID 13
3. **Get package details** - Fetch global_ids and other package info
4. **Create purchase record** with:
   - package_id (mapped)
   - amount (from Excel)
   - income (from Excel "Pack. X self + global")
   - active_until (initially future date - display only)
   - effective_global_ids (from package.global_ids)
   - status = 'completed'
5. **Check package expiry** (2x amount):
   - If income >= amount * 2 → Set active_until = NOW() (mark as expired)
   - If income < amount * 2 → Keep active_until as future date (active)
6. **Check if reinvestment**:
   - If user has active packages (before purchase) → Reinvestment (50% reduction for Level 1+)
7. **Process SPOT commissions**:
   - Direct Referrer (Level 0, depth 1) → ❌ SKIP (no SPOT, no pending)
   - Team Uplines (Level 1-9, depth 2-10):
     - Calculate: purchase_amount × spot_percent
     - Check: Is reinvestment? → Apply 50% reduction if yes (Level 1+)
     - Check: Is upline eligible for this level?
     - If eligible → ❌ SKIP (no SPOT, no pending)
     - If NOT eligible → ✅ Add to pending_commissions (with reduced amount if reinvestment)

## Prerequisites

1. Excel file `products-export-3.xlsx` in the root directory
2. Kubernetes cluster access configured
3. kubectl with proper kubeconfig
4. Database access via kubectl exec

## Usage

```bash
cd /Users/faizanansari/Documents/MLM-bilal-sir/MLM
python3 MLM-API/scripts/migrate-25000-200000-packages.py
```

## Configuration

Edit the script to update:
- `EXCEL_FILE` - Path to Excel file
- `KUBECONFIG` - Path to kubeconfig file
- `PACKAGE_MAPPING` - Package amount to ID mapping

## Output

- Console output with progress and results
- `migration-summary.json` - Detailed migration summary

## Important Notes

1. **Backup First**: Always take a database backup before running migration
2. **Test First**: Test with a single user before running full migration
3. **Wallet Balances**: Current DB balances will be replaced with Excel amounts
4. **SPOT Commissions**: Only unqualified uplines get pending SPOT commissions
5. **Package Expiry**: Based solely on 2x amount (income >= amount * 2)

## Database Backup

Before running migration, take a backup:

```bash
kubectl exec -n mlm postgres-0 -- pg_dump -U mlm_user mlm_commission > migrated-db-6.sql
```

## Verification

After migration, verify:
1. Wallet balances match Excel amounts
2. Purchase records created correctly
3. Package expiry status (active/expired)
4. Pending commissions for unqualified uplines

