#!/bin/bash

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          SIDDHANT 3-MONTH COMMISSION SCENARIO                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Step 1: Clean database
echo "🧹 Step 1: Cleaning database..."
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
  packages 
RESTART IDENTITY CASCADE;
"
echo "✅ Database cleaned"
echo

# Step 2: Create package with proper commissions
echo "📦 Step 2: Creating ₹2,500 course package..."
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
echo "✅ Package created: ID=$PKG_ID"
echo

# Step 3: Register Siddhant (Main User)
echo "👤 Step 3: Registering Siddhant (Main User)..."
SIDDHANT_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Siddhant","email":"siddhant@test.com"}')
SIDDHANT_ID=$(echo "$SIDDHANT_RESP" | jq -r .id)
echo "✅ Siddhant ID: $SIDDHANT_ID"

# Login Siddhant
SIDDHANT_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$SIDDHANT_ID}")
SIDDHANT_TOKEN=$(echo "$SIDDHANT_LOGIN" | jq -r .token)
echo

# Step 4: Siddhant purchases ₹2,500 course
echo "💰 Step 4: Siddhant purchases ₹2,500 course..."
SIDDHANT_PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SIDDHANT_TOKEN" \
  -d "{\"user_id\":$SIDDHANT_ID,\"package_id\":$PKG_ID}")
echo "✅ Siddhant purchased"
echo

# Wait for commission processing
echo "⏳ Waiting 8 seconds for initial commission processing..."
sleep 8
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    MONTH 1 - 19 NEW USERS"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 1: 19 new users in system (global helping)
echo "🌍 Month 1: Adding 19 new users to system (for global helping)..."
for i in $(seq 1 19); do
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global-User-M1-$i\",\"email\":\"global-m1-$i-$(date +%s%N)@test.com\"}")
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
    echo "  ✅ $i global users added"
  fi
  sleep 0.3
done
echo "✅ Month 1: 19 global users added"
echo

# Month 1: Faizan joins via Siddhant's referral link
echo "👤 Month 1: Faizan joins via Siddhant's referral link..."
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
echo "✅ Faizan (ID: $FAIZAN_ID) purchased via Siddhant's referral"
echo

# Trigger daily commission for Month 1 (31 days)
echo "💰 Month 1: Processing 31 days of commissions..."
for day in $(seq 1 31); do
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts > /dev/null 2>&1
  if (( day % 10 == 0 )); then
    echo "  ✅ Day $day processed"
  fi
done
echo "✅ Month 1 complete: 31 days processed"
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    MONTH 2 - 31 NEW USERS"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 2: 31 new users in system (global helping)
echo "🌍 Month 2: Adding 31 new users to system..."
for i in $(seq 1 31); do
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global-User-M2-$i\",\"email\":\"global-m2-$i-$(date +%s%N)@test.com\"}")
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
    echo "  ✅ $i global users added"
  fi
  sleep 0.3
done
echo "✅ Month 2: 31 global users added (Total: 50)"
echo

# Month 2: Rekha and Nisha join via Siddhant's referral link
echo "👤 Month 2: Rekha joins via Siddhant's referral link..."
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
echo "✅ Rekha (ID: $REKHA_ID) purchased via Siddhant's referral"

echo "👤 Month 2: Nisha joins via Siddhant's referral link..."
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
echo "✅ Nisha (ID: $NISHA_ID) purchased via Siddhant's referral"
echo

# Trigger daily commission for Month 2 (28 days for Feb)
echo "💰 Month 2: Processing 28 days of commissions..."
for day in $(seq 1 28); do
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts > /dev/null 2>&1
  if (( day % 10 == 0 )); then
    echo "  ✅ Day $day processed"
  fi
done
echo "✅ Month 2 complete: 28 days processed"
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    MONTH 3 - 5 NEW USERS (CAP REACHED)"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 3: 5 new users (reaching 55 cap)
echo "🌍 Month 3: Adding 5 new users to system (reaching 55 cap)..."
for i in $(seq 1 5); do
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global-User-M3-$i\",\"email\":\"global-m3-$i-$(date +%s%N)@test.com\"}")
  USER_ID=$(echo "$USER_RESP" | jq -r .id)
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}" > /dev/null
  
  echo "  ✅ Global user $i added"
  sleep 0.3
done
echo "✅ Month 3: 5 global users added (Total: 55 - CAP REACHED)"
echo

# Month 3: Zishan and Sajid join via Siddhant's referral link
echo "👤 Month 3: Zishan joins via Siddhant's referral link..."
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
echo "✅ Zishan (ID: $ZISHAN_ID) purchased via Siddhant's referral"

echo "👤 Month 3: Sajid joins via Siddhant's referral link..."
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
echo "✅ Sajid (ID: $SAJID_ID) purchased via Siddhant's referral"
echo

# Trigger daily commission for Month 3 (31 days)
echo "💰 Month 3: Processing 31 days of commissions..."
for day in $(seq 1 31); do
  docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts > /dev/null 2>&1
  if (( day % 10 == 0 )); then
    echo "  ✅ Day $day processed"
  fi
done
echo "✅ Month 3 complete: 31 days processed"
echo

echo "════════════════════════════════════════════════════════════════"
echo "                    FINAL CALCULATIONS"
echo "════════════════════════════════════════════════════════════════"
echo

# Calculate expected amounts
echo "📊 EXPECTED COMMISSION BREAKDOWN:"
echo
echo "1️⃣  SELF COMMISSION (3 months):"
echo "   - ₹62.50/month"
echo "   - Month 1 (31 days): ₹62.50 = ₹62.50"
echo "   - Month 2 (28 days): ₹62.50 = ₹62.50"
echo "   - Month 3 (31 days): ₹62.50 = ₹62.50"
echo "   - Total SELF: ₹187.50"
echo

echo "2️⃣  GLOBAL HELPING COMMISSION:"
echo "   - Month 1: 19 users × ₹6.25 = ₹118.75"
echo "   - Month 2: 50 users × ₹6.25 = ₹312.50 (19+31)"
echo "   - Month 3: 55 users × ₹6.25 = ₹343.75 (cap reached)"
echo "   - Total GLOBAL: ₹775.00"
echo

echo "3️⃣  SPOT COMMISSION (5% instant):"
echo "   - Faizan (M1): ₹2,500 × 5% = ₹125"
echo "   - Rekha (M2): ₹2,500 × 5% = ₹125"
echo "   - Nisha (M2): ₹2,500 × 5% = ₹125"
echo "   - Zishan (M3): ₹2,500 × 5% = ₹125"
echo "   - Sajid (M3): ₹2,500 × 5% = ₹125"
echo "   - Total SPOT: ₹625"
echo

echo "4️⃣  MONTHLY RECURRING (0.5%):"
echo "   - Faizan: ₹2,500 × 0.5% = ₹12.50/month × 3 months = ₹37.50"
echo "   - Rekha: ₹2,500 × 0.5% = ₹12.50/month × 2 months = ₹25.00"
echo "   - Nisha: ₹2,500 × 0.5% = ₹12.50/month × 2 months = ₹25.00"
echo "   - Zishan: ₹2,500 × 0.5% = ₹12.50/month × 1 month = ₹12.50"
echo "   - Sajid: ₹2,500 × 0.5% = ₹12.50/month × 1 month = ₹12.50"
echo "   - Total MONTHLY: ₹112.50"
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💵 GRAND TOTAL EXPECTED:"
echo "   Self: ₹187.50"
echo "   Global: ₹775.00"
echo "   Spot: ₹625.00"
echo "   Monthly: ₹112.50"
echo "   ─────────────────────"
echo "   TOTAL: ₹1,700.00"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check actual wallet balance
echo "💰 ACTUAL WALLET BALANCE (from system):"
curl -s -X GET "$API_BASE/users/$SIDDHANT_ID/wallet" \
  -H "Authorization: Bearer $SIDDHANT_TOKEN" | jq .
echo

# Check commission breakdown
echo "📋 ACTUAL COMMISSION BREAKDOWN (from ledger):"
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

echo "📊 DETAILED LEDGER ENTRIES:"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT 
  id,
  commission_type, 
  amount::numeric(10,2), 
  credited_at::timestamp,
  metadata
FROM ledger_entries 
WHERE receiver_user_id = $SIDDHANT_ID 
ORDER BY credited_at 
LIMIT 50;
"
echo

echo "✅ Scenario complete!"
echo
echo "📝 VERIFICATION NOTES:"
echo "   - Self commission is paid daily (₹62.50 ÷ days_in_month)"
echo "   - Global helping is paid daily per user (₹6.25 ÷ days_in_month)"
echo "   - Spot commission is instant (5% of ₹2,500 = ₹125)"
echo "   - Monthly recurring is paid daily (₹12.50 ÷ days_in_month)"
echo "   - Total entries should match: (31+28+31) days × scheduled commissions + 5 spot"

