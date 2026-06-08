#!/usr/bin/env python3
"""
Complete Database Cleanup and Migration Script

This script:
1. Cleans transaction history (ledger_entries, wallet_transactions, fee_transactions)
2. Cleans KYC requests (kyc_documents)
3. Cleans activation requests (purchase_requests)
4. Clears package effective_global_ids
5. Clears user wallets (balance, spot_balance, other_balance)
6. Clears purchase income (self + global)
7. Migrates remaining users from products-export-3.xlsx

SPOT Commission Logic:
- Qualified upline → NO SPOT (skip completely)
- Unqualified upline → SPOT = invested_amount × level_spot_percent / 100 → Add to pending_commissions
"""

import openpyxl
import subprocess
import json
import sys
import argparse
from datetime import datetime

# Configuration
# Database connection matches MLM-API .env:
# DATABASE_URL=postgresql://mlm_user:mlm_password@localhost:5435/mlm_commission
EXCEL_FILE = 'products-export-3.xlsx'
USE_LOCAL_DB = True  # Set to True to use local Docker container, False for Kubernetes
LOCAL_CONTAINER = 'mlm-prod-dump'  # ✅ This is the database MLM-API is connected to  # Container name matching MLM-API database
KUBECONFIG = 'azure-kube/0ffdcdf4-849b-4521-9868-be1000865e08'
NAMESPACE = 'mlm'
POD_NAME = 'postgres-0'
DB_USER = 'mlm_user'  # Matches MLM-API .env
DB_NAME = 'mlm_commission'  # Matches MLM-API .env

DEFAULT_PASSWORD = '123456'

def run_sql_query(query, description="", return_id=False):
    """Execute SQL query via docker exec (local) or kubectl exec (remote)"""
    if description:
        print(f"    {description}...")
    
    # Clean query (remove extra whitespace, newlines)
    query = ' '.join(query.split())
    
    if USE_LOCAL_DB:
        # Use local Docker container
        escaped_query = query.replace("'", "'\\''")
        cmd = [
            'docker', 'exec', LOCAL_CONTAINER,
            'bash', '-c', f"psql -U {DB_USER} -d {DB_NAME} -t -A -F '|' -c '{escaped_query}'"
        ]
    else:
        # Use Kubernetes pod
        escaped_query = query.replace("'", "'\"'\"'")
        cmd = [
            'kubectl', '--kubeconfig', KUBECONFIG,
            'exec', '-n', NAMESPACE, POD_NAME, '--',
            'bash', '-c', f"psql -U {DB_USER} -d {DB_NAME} -t -A -F '|' -c '{escaped_query}'"
        ]
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=60
    )
    
    if result.returncode != 0:
        if description:
            error_msg = result.stderr[:200] if result.stderr else "Unknown error"
            print(f"    ❌ Error: {error_msg}")
        return None
    
    output = result.stdout.strip()
    
    if return_id and output:
        lines = output.split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('INSERT') and line.isdigit():
                return line
        numbers = re.findall(r'\d+', output)
        if numbers:
            return numbers[-1]
    
    return output

def verify_database_connection():
    """Verify database connection and show current stats"""
    print("\n" + "=" * 80)
    print("🔍 Verifying Database Connection")
    print("=" * 80)
    
    # Test connection
    query = "SELECT current_database(), current_user, version();"
    result = run_sql_query(query, "Testing database connection")
    
    if not result:
        print("   ❌ Failed to connect to database!")
        print(f"   Container: {LOCAL_CONTAINER}")
        print(f"   Database: {DB_NAME}")
        print(f"   User: {DB_USER}")
        return False
    
    print(f"   ✅ Connected to database successfully")
    print(f"   Container: {LOCAL_CONTAINER}")
    print(f"   Database: {DB_NAME}")
    print(f"   User: {DB_USER}")
    
    # Show current stats
    print("\n   📊 Current Database Stats:")
    users_count = get_table_count("users")
    purchases_count = get_table_count("purchases")
    ledger_count = get_table_count("ledger_entries")
    wallet_txn_count = get_table_count("wallet_transactions")
    
    print(f"      - Users: {users_count:,}")
    print(f"      - Purchases: {purchases_count:,}")
    print(f"      - Ledger entries: {ledger_count:,}")
    print(f"      - Wallet transactions: {wallet_txn_count:,}")
    
    return True

def get_table_count(table_name):
    """Get count of records in a table"""
    query = f"SELECT COUNT(*) FROM {table_name};"
    result = run_sql_query(query)
    if result:
        try:
            return int(result.strip())
        except:
            pass
    return 0

# Global flag for non-interactive mode
NON_INTERACTIVE = False

def confirm_action(message):
    """Ask for user confirmation"""
    if NON_INTERACTIVE:
        print(f"{message} → Auto-confirmed (non-interactive mode)")
        return True
    response = input(f"{message} (yes/no): ").strip().lower()
    return response in ['yes', 'y']

def clean_transaction_history():
    """Clean all transaction history"""
    print("\n" + "=" * 80)
    print("🧹 STEP 1: Cleaning Transaction History")
    print("=" * 80)
    
    # Get counts before deletion
    ledger_count = get_table_count("ledger_entries")
    wallet_txn_count = get_table_count("wallet_transactions")
    fee_txn_count = get_table_count("fee_transactions")
    
    print(f"\n📊 Current counts:")
    print(f"   - ledger_entries: {ledger_count:,}")
    print(f"   - wallet_transactions: {wallet_txn_count:,}")
    print(f"   - fee_transactions: {fee_txn_count:,}")
    
    if ledger_count == 0 and wallet_txn_count == 0 and fee_txn_count == 0:
        print("   ✅ No transaction history to clean")
        return
    
    if not confirm_action("\n⚠️  Delete all transaction history?"):
        print("   ⏭️  Skipping transaction history cleanup")
        return
    
    # Delete in correct order (respecting foreign keys)
    print("\n   🗑️  Deleting fee_transactions...")
    run_sql_query("DELETE FROM fee_transactions;", "Deleting fee_transactions")
    
    print("   🗑️  Deleting wallet_transactions...")
    run_sql_query("DELETE FROM wallet_transactions;", "Deleting wallet_transactions")
    
    print("   🗑️  Deleting ledger_entries...")
    run_sql_query("DELETE FROM ledger_entries;", "Deleting ledger_entries")
    
    print("   ✅ Transaction history cleaned")

def clean_kyc_and_activation_requests():
    """Clean KYC documents and purchase requests"""
    print("\n" + "=" * 80)
    print("🧹 STEP 2: Cleaning KYC and Activation Requests")
    print("=" * 80)
    
    # Get counts before deletion
    kyc_count = get_table_count("kyc_documents")
    purchase_req_count = get_table_count("purchase_requests")
    
    print(f"\n📊 Current counts:")
    print(f"   - kyc_documents: {kyc_count:,}")
    print(f"   - purchase_requests: {purchase_req_count:,}")
    
    if kyc_count == 0 and purchase_req_count == 0:
        print("   ✅ No KYC/activation requests to clean")
        return
    
    if not confirm_action("\n⚠️  Delete all KYC documents and purchase requests?"):
        print("   ⏭️  Skipping KYC/activation cleanup")
        return
    
    print("\n   🗑️  Deleting purchase_requests...")
    run_sql_query("DELETE FROM purchase_requests;", "Deleting purchase_requests")
    
    print("   🗑️  Deleting kyc_documents...")
    run_sql_query("DELETE FROM kyc_documents;", "Deleting kyc_documents")
    
    print("   ✅ KYC and activation requests cleaned")

def clear_package_data():
    """Clear package effective_global_ids and purchase income"""
    print("\n" + "=" * 80)
    print("🧹 STEP 3: Clearing Package Data")
    print("=" * 80)
    
    # Get counts
    purchases_with_global_ids = get_table_count("purchases WHERE effective_global_ids IS NOT NULL")
    purchases_with_income = get_table_count("purchases WHERE income > 0")
    
    print(f"\n📊 Current data:")
    print(f"   - Purchases with effective_global_ids: {purchases_with_global_ids:,}")
    print(f"   - Purchases with income > 0: {purchases_with_income:,}")
    
    if purchases_with_global_ids == 0 and purchases_with_income == 0:
        print("   ✅ No package data to clear")
        return
    
    if not confirm_action("\n⚠️  Clear all package effective_global_ids and income?"):
        print("   ⏭️  Skipping package data cleanup")
        return
    
    print("\n   🗑️  Clearing effective_global_ids...")
    run_sql_query("UPDATE purchases SET effective_global_ids = NULL;", "Clearing effective_global_ids")
    
    print("   🗑️  Clearing purchase income...")
    run_sql_query("UPDATE purchases SET income = 0;", "Clearing purchase income")
    
    print("   ✅ Package data cleared")

def clear_user_wallets():
    """Clear all user wallets"""
    print("\n" + "=" * 80)
    print("🧹 STEP 4: Clearing User Wallets")
    print("=" * 80)
    
    # Get count of users with non-zero balance
    query = "SELECT COUNT(*) FROM user_balances WHERE balance > 0 OR spot_balance > 0 OR other_balance > 0;"
    result = run_sql_query(query)
    users_with_balance = 0
    if result:
        try:
            users_with_balance = int(result.strip())
        except:
            pass
    
    print(f"\n📊 Current data:")
    print(f"   - Users with non-zero balance: {users_with_balance:,}")
    
    if users_with_balance == 0:
        print("   ✅ No wallets to clear")
        return
    
    if not confirm_action("\n⚠️  Clear all user wallets (balance, spot_balance, other_balance)?"):
        print("   ⏭️  Skipping wallet cleanup")
        return
    
    print("\n   🗑️  Clearing all wallet balances...")
    run_sql_query(
        "UPDATE user_balances SET balance = 0, spot_balance = 0, other_balance = 0;",
        "Clearing wallet balances"
    )
    
    print("   ✅ User wallets cleared")

def main():
    global NON_INTERACTIVE
    
    parser = argparse.ArgumentParser(description='Database Cleanup and Migration Script')
    parser.add_argument('--yes', '-y', action='store_true', 
                       help='Auto-confirm all prompts (non-interactive mode)')
    args = parser.parse_args()
    
    NON_INTERACTIVE = args.yes
    
    print("=" * 80)
    print("🧹 DATABASE CLEANUP AND MIGRATION SCRIPT")
    print("=" * 80)
    print()
    print("This script will:")
    print("  1. Clean transaction history (ledger, wallet_transactions, fee_transactions)")
    print("  2. Clean KYC documents and purchase requests")
    print("  3. Clear package effective_global_ids and income")
    print("  4. Clear all user wallets")
    print("  5. Migrate remaining users from products-export-3.xlsx")
    print()
    print("⚠️  WARNING: This will DELETE data from the database!")
    if NON_INTERACTIVE:
        print("⚠️  NON-INTERACTIVE MODE: All confirmations will be auto-approved!")
    print()
    
    # Verify database connection first
    if not verify_database_connection():
        print("\n❌ Cannot proceed without database connection")
        return
    
    if not confirm_action("\n⚠️  Do you want to proceed with database cleanup?"):
        print("\n❌ Cleanup cancelled by user")
        return
    
    # Step 1: Clean transaction history
    clean_transaction_history()
    
    # Step 2: Clean KYC and activation requests
    clean_kyc_and_activation_requests()
    
    # Step 3: Clear package data
    clear_package_data()
    
    # Step 4: Clear user wallets
    clear_user_wallets()
    
    # Step 5: Migration
    print("\n" + "=" * 80)
    print("📦 STEP 5: Migrate Remaining Users from Excel")
    print("=" * 80)
    print()
    print("The migration script (migrate-new-users.py) will:")
    print("  - Create new users from products-export-3.xlsx")
    print("  - Set up wallets with Excel amounts")
    print("  - Create purchase records")
    print("  - Process SPOT commissions (only for unqualified uplines)")
    print()
    
    if not confirm_action("Do you want to run the migration now?"):
        print("\n⏭️  Skipping migration. You can run it later with:")
        print("   python3 MLM-API/scripts/migrate-new-users.py")
        return
    
    print("\n🚀 Running migration script...")
    print("=" * 80)
    
    # Run the migration script as subprocess
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    migration_script = os.path.join(script_dir, 'migrate-new-users.py')
    mlm_root = os.path.dirname(os.path.dirname(script_dir))  # MLM root directory
    
    result = subprocess.run(
        ['python3', migration_script],
        cwd=mlm_root,  # Run from MLM root directory (where Excel file is)
        capture_output=False
    )
    
    if result.returncode == 0:
        print("\n" + "=" * 80)
        print("✅ CLEANUP AND MIGRATION COMPLETE!")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("⚠️  Migration completed with errors (exit code: {})".format(result.returncode))
        print("=" * 80)

if __name__ == '__main__':
    import re  # For regex in run_sql_query
    main()

