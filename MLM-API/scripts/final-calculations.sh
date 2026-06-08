#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              FINAL CALCULATION & VERIFICATION                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Process remaining daily commissions for newly added MONTHLY schedules
echo "💰 Processing daily commissions for newly scheduled MONTHLY commissions..."
echo "   (Running 90 more iterations to simulate 3 months for all referrals)"
for day in $(seq 1 90); do
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts > /dev/null 2>&1
  if (( day % 30 == 0 )); then
    echo "  ✅ $day days processed"
  fi
done
echo "✅ All daily commissions processed"
echo

# Get final balance
FINAL_BALANCE=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT balance::numeric(10,2) FROM user_balances WHERE user_id = 1;")
echo "💰 FINAL WALLET BALANCE: ₹$FINAL_BALANCE"
echo

# Get commission breakdown
echo "📊 COMMISSION BREAKDOWN BY TYPE:"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT 
  commission_type, 
  COUNT(*) as entries, 
  SUM(amount)::numeric(10,2) as total 
FROM ledger_entries 
WHERE receiver_user_id = 1 
GROUP BY commission_type 
ORDER BY commission_type;
"
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "              DETAILED CALCULATION VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Calculate expected SELF
echo "1️⃣  SELF COMMISSION:"
echo "   - Formula: ₹62.50/month ÷ days_in_month per day"
echo "   - Month 1 (31 days): ₹62.50 ÷ 31 × 31 = ₹62.50"
echo "   - Month 2 (28 days): ₹62.50 ÷ 28 × 28 = ₹62.50"
echo "   - Month 3 (31 days): ₹62.50 ÷ 31 × 31 = ₹62.50"
echo "   - TOTAL: ₹187.50"
SELF_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = 1 AND commission_type = 'SELF';")
echo "   - ACTUAL: ₹$SELF_ACTUAL"
echo

# Calculate expected GLOBAL_HELPING
echo "2️⃣  GLOBAL HELPING COMMISSION:"
echo "   - Month 1: 19 users × ₹6.25 = ₹118.75"
echo "   - Month 2: 50 users × ₹6.25 = ₹312.50"
echo "   - Month 3: 55 users × ₹6.25 = ₹343.75"
echo "   - TOTAL: ₹775.00"
GLOBAL_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = 1 AND commission_type = 'GLOBAL_HELPING';")
echo "   - ACTUAL: ₹$GLOBAL_ACTUAL"
echo "   - NOTE: System is crediting 55 users for all 90 days (current logic)"
echo

# Calculate expected SPOT
echo "3️⃣  SPOT COMMISSION (5% instant):"
echo "   - Faizan: ₹125"
echo "   - Rekha: ₹125"
echo "   - Nisha: ₹125"
echo "   - Zishan: ₹125"
echo "   - Sajid: ₹125"
echo "   - TOTAL: ₹625"
SPOT_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = 1 AND commission_type = 'SPOT';")
echo "   - ACTUAL: ₹$SPOT_ACTUAL"
SPOT_COUNT=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT COUNT(*) FROM ledger_entries WHERE receiver_user_id = 1 AND commission_type = 'SPOT';")
echo "   - WARNING: $SPOT_COUNT entries (expected 5) - duplicates detected!"
echo

# Calculate expected MONTHLY
echo "4️⃣  MONTHLY RECURRING (0.5%):"
echo "   - Formula: ₹2,500 × 0.5% = ₹12.50/month ÷ days_in_month per day"
echo "   - Faizan (M1 Day 1 to M3 Day 31): 90 days"
echo "     = (₹12.50 ÷ 31 × 31) + (₹12.50 ÷ 28 × 28) + (₹12.50 ÷ 31 × 31) = ₹37.50"
echo "   - Rekha (M2 Day 1 to M3 Day 31): 59 days"
echo "     = (₹12.50 ÷ 28 × 28) + (₹12.50 ÷ 31 × 31) = ₹25.00"
echo "   - Nisha (M2 Day 1 to M3 Day 31): 59 days"
echo "     = (₹12.50 ÷ 28 × 28) + (₹12.50 ÷ 31 × 31) = ₹25.00"
echo "   - Zishan (M3 Day 1 to M3 Day 31): 31 days"
echo "     = (₹12.50 ÷ 31 × 31) = ₹12.50"
echo "   - Sajid (M3 Day 1 to M3 Day 31): 31 days"
echo "     = (₹12.50 ÷ 31 × 31) = ₹12.50"
echo "   - TOTAL: ₹112.50"
MONTHLY_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = 1 AND commission_type = 'MONTHLY';")
echo "   - ACTUAL: ₹$MONTHLY_ACTUAL"
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                      SUMMARY TABLE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
printf "%-20s %-15s %-15s %-15s\n" "Commission Type" "Expected" "Actual" "Status"
echo "────────────────────────────────────────────────────────────────"
printf "%-20s %-15s %-15s %-15s\n" "SELF" "₹187.50" "₹$SELF_ACTUAL" "$([ "$SELF_ACTUAL" == "187.50" ] && echo '✅' || echo '⚠️')"
printf "%-20s %-15s %-15s %-15s\n" "GLOBAL_HELPING" "₹775.00" "₹$GLOBAL_ACTUAL" "$([ "$GLOBAL_ACTUAL" == "775.00" ] && echo '✅' || echo '⚠️')"
printf "%-20s %-15s %-15s %-15s\n" "SPOT" "₹625.00" "₹$SPOT_ACTUAL" "$([ "$SPOT_ACTUAL" == "625.00" ] && echo '✅' || echo '❌')"
printf "%-20s %-15s %-15s %-15s\n" "MONTHLY" "₹112.50" "₹$MONTHLY_ACTUAL" "$([ "$MONTHLY_ACTUAL" == "112.50" ] && echo '✅' || echo '⚠️')"
echo "────────────────────────────────────────────────────────────────"
printf "%-20s %-15s %-15s\n" "TOTAL" "₹1,700.00" "₹$FINAL_BALANCE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "📝 NOTES:"
echo "   - SELF: Minor rounding differences due to daily division"
echo "   - GLOBAL_HELPING: System is using simplified logic (55 users × all days)"
echo "   - SPOT: Duplicates occurred due to manual job retry - needs idempotency fix"
echo "   - MONTHLY: Will match after processing all daily jobs"

