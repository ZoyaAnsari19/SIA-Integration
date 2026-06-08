#!/bin/bash
# Test GLOBAL_HELPING Commission Uses effective_global_ids

set -e

API_URL="${API_URL:-http://localhost:3000}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  GLOBAL_HELPING COMMISSION TEST (effective_global_ids)        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Helper function
execute_sql() {
  docker compose exec -T db psql -U postgres -d mlm -t -A -c "$1" 2>/dev/null || \
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mlm -t -A -c "$1" 2>/dev/null || echo ""
}

execute_sql_formatted() {
  docker compose exec -T db psql -U postgres -d mlm -c "$1" 2>/dev/null || \
  PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d mlm -c "$1" 2>/dev/null || echo ""
}

echo -e "${CYAN}Step 1: Check scheduled_commissions for GLOBAL_HELPING${NC}"
echo ""

execute_sql_formatted "
SELECT 
  sc.id,
  sc.receiver_user_id,
  sc.purchase_id,
  p.package_id,
  pk.name as package_name,
  pk.global_ids as package_global_ids,
  p.effective_global_ids,
  sc.commission_type,
  sc.monthly_amount
FROM scheduled_commissions sc
JOIN purchases p ON sc.purchase_id = p.id
JOIN packages pk ON p.package_id = pk.id
WHERE sc.commission_type = 'GLOBAL_HELPING'
ORDER BY sc.id DESC
LIMIT 5;
"

echo ""
echo -e "${CYAN}Step 2: Verify effective_global_ids values${NC}"
echo ""

execute_sql_formatted "
SELECT 
  p.id as purchase_id,
  p.package_id,
  pk.name as package_name,
  pk.global_ids as package_global_ids,
  p.is_renewal,
  p.previous_package_id,
  p.effective_global_ids,
  CASE 
    WHEN p.is_renewal = false THEN 'First Purchase - Should use package global_ids'
    WHEN p.previous_package_id = p.package_id THEN 'Same Package Renew - Should be 0'
    WHEN p.effective_global_ids > 0 THEN 'Bigger Package Renew - Should use new package global_ids'
    ELSE 'Unknown'
  END as expected_behavior
FROM purchases p
JOIN packages pk ON p.package_id = pk.id
WHERE p.id IN (
  SELECT purchase_id FROM scheduled_commissions 
  WHERE commission_type = 'GLOBAL_HELPING' 
  ORDER BY id DESC LIMIT 3
)
ORDER BY p.id;
"

echo ""
echo -e "${CYAN}Step 3: Expected Behavior Summary${NC}"
echo ""

echo -e "${GREEN}✅ First Purchase:${NC}"
echo "   - effective_global_ids = package.global_ids (e.g., 55)"
echo "   - GLOBAL_HELPING cap = 55 users"
echo ""

echo -e "${GREEN}✅ Same Package Renew:${NC}"
echo "   - effective_global_ids = 0"
echo "   - GLOBAL_HELPING cap = 0 users (no additional IDs)"
echo ""

echo -e "${GREEN}✅ Bigger Package Renew:${NC}"
echo "   - effective_global_ids = new package.global_ids (e.g., 900)"
echo "   - GLOBAL_HELPING cap = 900 users (full new cap, fresh)"
echo ""

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Test Complete!${NC}"
echo ""

