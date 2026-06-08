#!/bin/bash

# Master script to run all seeding scripts in sequence
# Usage: ./scripts/seed-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🌱 Starting Complete Database Seeding"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if API is running
print_info "Checking if API is running..."
if ! curl -s http://localhost:3000/api/v1/packages > /dev/null 2>&1; then
    print_error "API is not running on http://localhost:3000"
    print_info "Please start the API server first: npm run dev"
    exit 1
fi
print_success "API is running"
echo ""

# Step 1: Seed 50 users
print_info "Step 1: Seeding 50 users with 6-level hierarchy..."
if npx tsx scripts/seed-50-users.ts; then
    print_success "Step 1 completed: 50 users created and packages activated"
else
    print_error "Step 1 failed: User seeding failed"
    exit 1
fi
echo ""

# Step 2: Seed withdrawal requests
print_info "Step 2: Seeding withdrawal requests..."
if npx tsx scripts/seed-withdrawal-requests.ts; then
    print_success "Step 2 completed: Withdrawal requests seeded"
else
    print_error "Step 2 failed: Withdrawal requests seeding failed"
    exit 1
fi
echo ""

# Step 3: Seed ledger entries
print_info "Step 3: Seeding ledger entries..."
if npx tsx scripts/seed-ledger-entries.ts; then
    print_success "Step 3 completed: Ledger entries seeded and balances updated"
else
    print_error "Step 3 failed: Ledger entries seeding failed"
    exit 1
fi
echo ""

print_success "🎉 All seeding completed successfully!"
echo ""
print_info "Summary:"
echo "  - 50 users created with 6-level hierarchy"
echo "  - All users have active packages"
echo "  - 20 withdrawal requests seeded (various statuses)"
echo "  - Ledger entries seeded (SELF, GLOBAL_HELPING, MONTHLY, FEE_DEDUCTION)"
echo "  - User balances updated"
echo ""
print_info "User data saved to: scripts/seed-50-users-data.json"

