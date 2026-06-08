#!/bin/bash

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       CLEAN SIDDHANT 3-MONTH TEST (NO DUPLICATES)            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Step 1: Clean database completely
echo "🧹 Step 1: Cleaning database completely..."
docker exec mlm-db-1 psql -U postgres -d mlm -c "
TRUNCATE TABLE 
  wallet_transactions, 
  ledger_entries, 
  scheduled_commissions, 
  pending_commissions, 
  level_eligibility, 
  user_balances, 
  purchases, 
  user_tree_paths, 
  users, 
  packages,
  commission_rules
RESTART IDENTITY CASCADE;
" > /dev/null 2>&1
echo "✅ Database cleaned"
echo

# Step 2: Restart app to ensure clean worker state
echo "🔄 Step 2: Restarting app for clean worker state..."
docker compose restart app > /dev/null 2>&1
echo "⏳ Waiting 10 seconds for app to start..."
sleep 10
echo "✅ App restarted"
echo

# Step 3: Create package
echo "📦 Step 3: Creating ₹2,500 course package..."
CREATE_PKG_RESP=$(curl -s -X POST "$API_BASE/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"₹2,500 Course",
    "price":2500,
    "validity_months":13,
    "self_monthly":62.50,
    "global_ids":55,
    "global_monthly_per_id":6.25,
    "recurring_rate_percent":0.5
  }')
PKG_ID=$(echo "$CREATE_PKG_RESP" | jq -r .id)
echo "✅ Package ID: $PKG_ID"
echo

# Step 4: Register Siddhant
echo "👤 Step 4: Registering Siddhant..."
SIDDHANT_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Siddhant","email":"siddhant@test.com"}')
SIDDHANT_ID=$(echo "$SIDDHANT_RESP" | jq -r .id)

SIDDHANT_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$SIDDHANT_ID}")
SIDDHANT_TOKEN=$(echo "$SIDDHANT_LOGIN" | jq -r .token)
echo "✅ Siddhant ID: $SIDDHANT_ID"
echo

# Step 5: Siddhant purchases
echo "💰 Step 5: Siddhant purchases ₹2,500 course..."
curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SIDDHANT_TOKEN" \
  -d "{\"user_id\":$SIDDHANT_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Siddhant purchased"
echo

echo "⏳ Waiting 10 seconds for commission processing..."
sleep 10
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    MONTH 1 SIMULATION"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 1: 19 global users
echo "🌍 Adding 19 global users..."
for i in $(seq 1 19); do
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global-M1-$i\",\"email\":\"gm1-$i-$(date +%s%N)@test.com\"}")
  USER_ID=$(echo "$USER_RESP" | jq -r .id)
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}" > /dev/null
  
  if (( i % 5 == 0 )); then
    echo "  ✅ $i users added"
  fi
  sleep 0.2
done
echo

# Month 1: Faizan (referral)
echo "👤 Adding Faizan (Siddhant's referral)..."
FAIZAN_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Faizan\",\"email\":\"faizan@test.com\",\"referrer_user_id\":$SIDDHANT_ID}")
FAIZAN_ID=$(echo "$FAIZAN_RESP" | jq -r .id)

FAIZAN_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$FAIZAN_ID}")
FAIZAN_TOKEN=$(echo "$FAIZAN_LOGIN" | jq -r .token)

curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FAIZAN_TOKEN" \
  -d "{\"user_id\":$FAIZAN_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Faizan purchased"
echo

# Wait for all jobs to complete
echo "⏳ Waiting 15 seconds for all commission jobs..."
sleep 15
echo

# Process Month 1 (31 days)
echo "💰 Processing Month 1 (31 days of commissions)..."
for day in $(seq 1 31); do
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts > /dev/null 2>&1
  if (( day % 10 == 0 )); then
    echo "  ✅ Day $day"
  fi
done
echo "✅ Month 1 complete (31 days)"
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    MONTH 2 SIMULATION"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 2: 31 global users
echo "🌍 Adding 31 global users..."
for i in $(seq 1 31); do
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global-M2-$i\",\"email\":\"gm2-$i-$(date +%s%N)@test.com\"}")
  USER_ID=$(echo "$USER_RESP" | jq -r .id)
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}" > /dev/null
  
  if (( i % 10 == 0 )); then
    echo "  ✅ $i users added"
  fi
  sleep 0.2
done
echo

# Month 2: Rekha and Nisha (referrals)
echo "👤 Adding Rekha (Siddhant's referral)..."
REKHA_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Rekha\",\"email\":\"rekha@test.com\",\"referrer_user_id\":$SIDDHANT_ID}")
REKHA_ID=$(echo "$REKHA_RESP" | jq -r .id)

REKHA_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$REKHA_ID}")
REKHA_TOKEN=$(echo "$REKHA_LOGIN" | jq -r .token)

curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $REKHA_TOKEN" \
  -d "{\"user_id\":$REKHA_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Rekha purchased"

echo "👤 Adding Nisha (Siddhant's referral)..."
NISHA_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Nisha\",\"email\":\"nisha@test.com\",\"referrer_user_id\":$SIDDHANT_ID}")
NISHA_ID=$(echo "$NISHA_RESP" | jq -r .id)

NISHA_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$NISHA_ID}")
NISHA_TOKEN=$(echo "$NISHA_LOGIN" | jq -r .token)

curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NISHA_TOKEN" \
  -d "{\"user_id\":$NISHA_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Nisha purchased"
echo

# Wait for jobs
echo "⏳ Waiting 15 seconds for commission jobs..."
sleep 15
echo

# Process Month 2 (28 days)
echo "💰 Processing Month 2 (28 days of commissions)..."
for day in $(seq 1 28); do
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts > /dev/null 2>&1
  if (( day % 10 == 0 )); then
    echo "  ✅ Day $day"
  fi
done
echo "✅ Month 2 complete (28 days)"
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    MONTH 3 SIMULATION"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 3: 5 global users (reaching cap of 55)
echo "🌍 Adding 5 global users (cap reached)..."
for i in $(seq 1 5); do
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global-M3-$i\",\"email\":\"gm3-$i-$(date +%s%N)@test.com\"}")
  USER_ID=$(echo "$USER_RESP" | jq -r .id)
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}" > /dev/null
  
  echo "  ✅ User $i added"
  sleep 0.2
done
echo

# Month 3: Zishan and Sajid (referrals)
echo "👤 Adding Zishan (Siddhant's referral)..."
ZISHAN_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Zishan\",\"email\":\"zishan@test.com\",\"referrer_user_id\":$SIDDHANT_ID}")
ZISHAN_ID=$(echo "$ZISHAN_RESP" | jq -r .id)

ZISHAN_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$ZISHAN_ID}")
ZISHAN_TOKEN=$(echo "$ZISHAN_LOGIN" | jq -r .token)

curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZISHAN_TOKEN" \
  -d "{\"user_id\":$ZISHAN_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Zishan purchased"

echo "👤 Adding Sajid (Siddhant's referral)..."
SAJID_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Sajid\",\"email\":\"sajid@test.com\",\"referrer_user_id\":$SIDDHANT_ID}")
SAJID_ID=$(echo "$SAJID_RESP" | jq -r .id)

SAJID_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$SAJID_ID}")
SAJID_TOKEN=$(echo "$SAJID_LOGIN" | jq -r .token)

curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SAJID_TOKEN" \
  -d "{\"user_id\":$SAJID_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Sajid purchased"
echo

# Wait for jobs
echo "⏳ Waiting 15 seconds for commission jobs..."
sleep 15
echo

# Process Month 3 (31 days)
echo "💰 Processing Month 3 (31 days of commissions)..."
for day in $(seq 1 31); do
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts > /dev/null 2>&1
  if (( day % 10 == 0 )); then
    echo "  ✅ Day $day"
  fi
done
echo "✅ Month 3 complete (31 days)"
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    FINAL RESULTS"
echo "════════════════════════════════════════════════════════════════"
echo

# Get final balance
FINAL_BALANCE=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT balance::numeric(10,2) FROM user_balances WHERE user_id = $SIDDHANT_ID;" | xargs)
echo "💰 SIDDHANT'S FINAL WALLET BALANCE: ₹$FINAL_BALANCE"
echo

# Commission breakdown
echo "📊 COMMISSION BREAKDOWN:"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT 
  commission_type, 
  COUNT(*) as entries, 
  SUM(amount)::numeric(10,2) as total 
FROM ledger_entries 
WHERE receiver_user_id = $SIDDHANT_ID 
GROUP BY commission_type 
ORDER BY commission_type;
"
echo

# Expected calculations
SELF_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = $SIDDHANT_ID AND commission_type = 'SELF';" | xargs)
GLOBAL_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = $SIDDHANT_ID AND commission_type = 'GLOBAL_HELPING';" | xargs)
SPOT_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = $SIDDHANT_ID AND commission_type = 'SPOT';" | xargs)
MONTHLY_ACTUAL=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT SUM(amount)::numeric(10,2) FROM ledger_entries WHERE receiver_user_id = $SIDDHANT_ID AND commission_type = 'MONTHLY';" | xargs)

SPOT_COUNT=$(docker exec mlm-db-1 psql -U postgres -d mlm -t -c "SELECT COUNT(*) FROM ledger_entries WHERE receiver_user_id = $SIDDHANT_ID AND commission_type = 'SPOT';" | xargs)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "                 EXPECTED vs ACTUAL COMPARISON"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "%-20s %-15s %-15s %-10s\n" "Commission Type" "Expected" "Actual" "Status"
echo "────────────────────────────────────────────────────────────────"
printf "%-20s %-15s %-15s %-10s\n" "SELF" "₹187.50" "₹$SELF_ACTUAL" "$(awk "BEGIN {if ($SELF_ACTUAL >= 187 && $SELF_ACTUAL <= 188) print \"✅\"; else print \"❌\"}")"
printf "%-20s %-15s %-15s %-10s\n" "GLOBAL_HELPING" "₹775.00" "₹$GLOBAL_ACTUAL" "$(awk "BEGIN {if ($GLOBAL_ACTUAL >= 774 && $GLOBAL_ACTUAL <= 776) print \"✅\"; else print \"⚠️\"}")"
printf "%-20s %-15s %-15s %-10s\n" "SPOT ($SPOT_COUNT entries)" "₹625.00" "₹$SPOT_ACTUAL" "$(awk "BEGIN {if ($SPOT_ACTUAL == 625) print \"✅\"; else print \"❌\"}")"
printf "%-20s %-15s %-15s %-10s\n" "MONTHLY" "₹112.50" "₹$MONTHLY_ACTUAL" "$(awk "BEGIN {if ($MONTHLY_ACTUAL >= 112 && $MONTHLY_ACTUAL <= 113) print \"✅\"; else print \"❌\"}")"
echo "────────────────────────────────────────────────────────────────"
printf "%-20s %-15s %-15s\n" "TOTAL" "₹1,700.00" "₹$FINAL_BALANCE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

echo "✅ Clean test complete - NO manual interventions!"

