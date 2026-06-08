#!/bin/bash
set -e

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          MLM PLATFORM - 3 MONTH TEST SCENARIO                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Step 1: Seed database
echo "📦 Step 1: Seeding test course and main user..."
SEED_OUTPUT=$(docker exec mlm-app-1 npx tsx scripts/test-scenario.ts)
echo "$SEED_OUTPUT"
sleep 2

# Extract IDs from seed output
MAIN_USER_ID=$(echo "$SEED_OUTPUT" | grep "MAIN_USER_ID=" | cut -d'=' -f2)
PKG_ID=$(echo "$SEED_OUTPUT" | grep "PKG_ID=" | cut -d'=' -f2)

echo
echo "✅ Main User ID: $MAIN_USER_ID"
echo "✅ Course Package ID: $PKG_ID"
echo

# Step 2: Main user login
echo "🔐 Step 2: Main user login..."
LOGIN_RESP=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$MAIN_USER_ID}")
TOKEN=$(echo $LOGIN_RESP | jq -r .token)
echo "✅ Token: ${TOKEN:0:50}..."
echo

# Step 3: Main user purchases course
echo "💰 Step 3: Main user purchases course (₹2,500)..."
PURCHASE_RESP=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"user_id\":$MAIN_USER_ID,\"package_id\":$PKG_ID}")
echo $PURCHASE_RESP | jq .
MAIN_PURCHASE_ID=$(echo $PURCHASE_RESP | jq -r .purchase.id)
echo "✅ Main user purchased, Purchase ID: $MAIN_PURCHASE_ID"
echo

echo "════════════════════════════════════════════════════════════════"
echo "              MONTH 1 - JANUARY 2024"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 1: 6 Direct Users (spread over 18 days)
echo "👥 Month 1: Registering 6 direct users (spread over 18 days)..."
DIRECT_USERS_M1=()
for i in {1..6}; do
  DAY=$((i * 3)) # Spread over day 3, 6, 9, 12, 15, 18
  echo "  Day $DAY: Registering Direct User $i..."
  
  REG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Direct User M1-$i\",\"email\":\"direct_m1_${i}@test.com\",\"referrer_user_id\":$MAIN_USER_ID}")
  
  USER_ID=$(echo $REG_RESP | jq -r .id)
  DIRECT_USERS_M1+=($USER_ID)
  
  # Login and purchase
  LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo $LOGIN | jq -r .token)
  
  PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}")
  
  echo "    ✅ User ID: $USER_ID purchased (Spot Instant: ₹125)"
  sleep 0.5
done

echo
echo "🌍 Month 1: Registering 23 global users..."
GLOBAL_USERS_M1=()
for i in {1..23}; do
  # These users are referred by direct users (distribute randomly)
  REFERRER_IDX=$((i % 6))
  REFERRER=${DIRECT_USERS_M1[$REFERRER_IDX]}
  
  REG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global User M1-$i\",\"email\":\"global_m1_${i}@test.com\",\"referrer_user_id\":$REFERRER}")
  
  USER_ID=$(echo $REG_RESP | jq -r .id)
  GLOBAL_USERS_M1+=($USER_ID)
  
  # Login and purchase
  LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo $LOGIN | jq -r .token)
  
  PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}")
  
  if [ $((i % 5)) -eq 0 ]; then
    echo "  ✅ $i global users registered and purchased"
  fi
  sleep 0.2
done

echo "✅ Month 1 Complete: 6 direct + 23 global = 29 total users"
echo

echo "════════════════════════════════════════════════════════════════"
echo "              MONTH 2 - FEBRUARY 2024"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 2: 2 Direct Users
echo "👥 Month 2: Registering 2 direct users..."
DIRECT_USERS_M2=()
for i in {7..8}; do
  DAY=$((i == 7 ? 5 : 15)) # Early and mid-month
  echo "  Day $DAY: Registering Direct User $i..."
  
  REG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Direct User M2-$i\",\"email\":\"direct_m2_${i}@test.com\",\"referrer_user_id\":$MAIN_USER_ID}")
  
  USER_ID=$(echo $REG_RESP | jq -r .id)
  DIRECT_USERS_M2+=($USER_ID)
  
  # Login and purchase
  LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo $LOGIN | jq -r .token)
  
  PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}")
  
  echo "    ✅ User ID: $USER_ID purchased (Spot Instant: ₹125)"
  sleep 0.5
done

echo
echo "🌍 Month 2: Registering 20 global users..."
GLOBAL_USERS_M2=()
for i in {24..43}; do
  # Distribute across all 8 direct users
  REFERRER_IDX=$((i % 8))
  if [ $REFERRER_IDX -lt 6 ]; then
    REFERRER=${DIRECT_USERS_M1[$REFERRER_IDX]}
  else
    REFERRER=${DIRECT_USERS_M2[$((REFERRER_IDX - 6))]}
  fi
  
  REG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global User M2-$i\",\"email\":\"global_m2_${i}@test.com\",\"referrer_user_id\":$REFERRER}")
  
  USER_ID=$(echo $REG_RESP | jq -r .id)
  GLOBAL_USERS_M2+=($USER_ID)
  
  # Login and purchase
  LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo $LOGIN | jq -r .token)
  
  PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}")
  
  if [ $((i % 5)) -eq 0 ]; then
    echo "  ✅ $((i - 23)) global users registered and purchased"
  fi
  sleep 0.2
done

echo "✅ Month 2 Complete: 2 direct + 20 global = 22 new users (Total: 51)"
echo

echo "════════════════════════════════════════════════════════════════"
echo "              MONTH 3 - MARCH 2024"
echo "════════════════════════════════════════════════════════════════"
echo

# Month 3: 12 Global Users (reach cap of 55)
echo "🌍 Month 3: Registering 12 global users (reaching cap of 55)..."
GLOBAL_USERS_M3=()
for i in {44..55}; do
  # Distribute across all 8 direct users
  REFERRER_IDX=$((i % 8))
  if [ $REFERRER_IDX -lt 6 ]; then
    REFERRER=${DIRECT_USERS_M1[$REFERRER_IDX]}
  else
    REFERRER=${DIRECT_USERS_M2[$((REFERRER_IDX - 6))]}
  fi
  
  REG_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Global User M3-$i\",\"email\":\"global_m3_${i}@test.com\",\"referrer_user_id\":$REFERRER}")
  
  USER_ID=$(echo $REG_RESP | jq -r .id)
  GLOBAL_USERS_M3+=($USER_ID)
  
  # Login and purchase
  LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo $LOGIN | jq -r .token)
  
  PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}")
  
  if [ $((i % 5)) -eq 0 ]; then
    echo "  ✅ $((i - 43)) global users registered and purchased"
  fi
  sleep 0.2
done

echo "✅ Month 3 Complete: 12 global users (Total: 63 users including Main + 8 direct)"
echo

echo "════════════════════════════════════════════════════════════════"
echo "              COMMISSION CALCULATION SUMMARY"
echo "════════════════════════════════════════════════════════════════"
echo

# Check Main User's wallet
echo "💰 Checking Main User's Wallet Balance..."
WALLET=$(curl -s -X GET "$API_BASE/users/$MAIN_USER_ID/wallet" \
  -H "Authorization: Bearer $TOKEN")
echo $WALLET | jq .
echo

# Expected calculations:
echo "📊 Expected Commission Breakdown:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "1️⃣  SELF COMMISSION:"
echo "   - ₹62.50/month × 13 months = ₹812.50"
echo
echo "2️⃣  SPOT INSTANT (One-time from 8 direct users):"
echo "   - Month 1: 6 users × ₹125 = ₹750"
echo "   - Month 2: 2 users × ₹125 = ₹250"
echo "   - Total: ₹1,000"
echo
echo "3️⃣  SPOT RECURRING (Monthly from 8 direct users):"
echo "   - ₹12.50/user/month"
echo "   - Month 1: 6 users × ₹12.50 = ₹75/month"
echo "   - Month 2 onwards: 8 users × ₹12.50 = ₹100/month"
echo "   - Total for 13 months: (₹75 × 1) + (₹100 × 12) = ₹1,275"
echo
echo "4️⃣  GLOBAL HELPING (Capped at 55 IDs):"
echo "   - ₹6.25/ID/month × 55 IDs × 13 months = ₹4,468.75"
echo "   - Note: Only 55 counted (23 in M1 + 20 in M2 + 12 in M3)"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💵 TOTAL EXPECTED EARNINGS:"
echo "   Self: ₹812.50"
echo "   Spot Instant: ₹1,000"
echo "   Spot Recurring: ₹1,275"
echo "   Global Helping: ₹4,468.75"
echo "   ─────────────────────"
echo "   GRAND TOTAL: ₹7,556.25"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check ledger entries
echo "📖 Checking Ledger Entries for Main User..."
docker exec mlm-db-1 psql -U mlm_user -d mlm -c \
  "SELECT source, SUM(amount) as total_amount, COUNT(*) as count 
   FROM ledger_entries 
   WHERE user_id = $MAIN_USER_ID 
   GROUP BY source 
   ORDER BY source;"
echo

echo "✅ Test Scenario Complete!"
echo "════════════════════════════════════════════════════════════════"

