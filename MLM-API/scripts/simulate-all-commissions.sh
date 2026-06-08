#!/bin/bash

API_BASE="http://localhost:3000/api/v1"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     SIMULATING ALL COMMISSION TYPES (SELF, SPOT, MONTHLY)    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

# Step 1: Create a proper package with ALL commissions
echo "📦 Step 1: Creating proper package with all commissions..."
CREATE_PKG_RESP=$(curl -s -X POST "$API_BASE/packages" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Full Commission Package",
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

# Step 2: Register Ramesh (Main User)
echo "👤 Step 2: Registering Ramesh (Main User)..."
RAMESH_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Ramesh","email":"ramesh-sim@test.com"}')
RAMESH_ID=$(echo "$RAMESH_RESP" | jq -r .id)
echo "✅ Ramesh ID: $RAMESH_ID"

# Login Ramesh
RAMESH_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$RAMESH_ID}")
RAMESH_TOKEN=$(echo "$RAMESH_LOGIN" | jq -r .token)
echo

# Step 3: Ramesh purchases package
echo "💰 Step 3: Ramesh purchases package..."
RAMESH_PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RAMESH_TOKEN" \
  -d "{\"user_id\":$RAMESH_ID,\"package_id\":$PKG_ID}")
RAMESH_PURCHASE_ID=$(echo "$RAMESH_PURCHASE" | jq -r .purchase.id)
echo "✅ Ramesh purchased, Purchase ID: $RAMESH_PURCHASE_ID"
echo

# Wait for commission processing
echo "⏳ Waiting 5 seconds for commission processing..."
sleep 5
echo

# Step 4: Register 3 direct referrals under Ramesh
echo "👥 Step 4: Creating 3 direct referrals under Ramesh..."
for i in 1 2 3; do
  echo "  Registering Ramesh-Team-$i..."
  
  # Register
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Ramesh-Team-$i\",\"email\":\"ramesh-team-$i-$(date +%s%N)@test.com\",\"referrer_user_id\":$RAMESH_ID}")
  USER_ID=$(echo "$USER_RESP" | jq -r .id)
  
  # Login
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
  
  # Purchase
  USER_PURCHASE=$(curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}")
  
  echo "    ✅ User ID: $USER_ID purchased"
  sleep 1
done
echo

# Step 5: Create Sudesh (under Ramesh) with 2 sub-referrals
echo "👤 Step 5: Creating Sudesh (under Ramesh)..."
SUDESH_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Sudesh\",\"email\":\"sudesh-sim@test.com\",\"referrer_user_id\":$RAMESH_ID}")
SUDESH_ID=$(echo "$SUDESH_RESP" | jq -r .id)

SUDESH_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$SUDESH_ID}")
SUDESH_TOKEN=$(echo "$SUDESH_LOGIN" | jq -r .token)

curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUDESH_TOKEN" \
  -d "{\"user_id\":$SUDESH_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Sudesh ID: $SUDESH_ID purchased"

# Sudesh's team
for i in 1 2; do
  echo "  Registering Sudesh-Team-$i..."
  
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Sudesh-Team-$i\",\"email\":\"sudesh-team-$i-$(date +%s%N)@test.com\",\"referrer_user_id\":$SUDESH_ID}")
  USER_ID=$(echo "$USER_RESP" | jq -r .id)
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}" > /dev/null
  
  echo "    ✅ User ID: $USER_ID purchased"
  sleep 1
done
echo

# Step 6: Create Lokesh (under Ramesh) with 2 sub-referrals
echo "👤 Step 6: Creating Lokesh (under Ramesh)..."
LOKESH_RESP=$(curl -s -X POST "$API_BASE/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Lokesh\",\"email\":\"lokesh-sim@test.com\",\"referrer_user_id\":$RAMESH_ID}")
LOKESH_ID=$(echo "$LOKESH_RESP" | jq -r .id)

LOKESH_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":$LOKESH_ID}")
LOKESH_TOKEN=$(echo "$LOKESH_LOGIN" | jq -r .token)

curl -s -X POST "$API_BASE/purchases" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LOKESH_TOKEN" \
  -d "{\"user_id\":$LOKESH_ID,\"package_id\":$PKG_ID}" > /dev/null
echo "✅ Lokesh ID: $LOKESH_ID purchased"

# Lokesh's team
for i in 1 2; do
  echo "  Registering Lokesh-Team-$i..."
  
  USER_RESP=$(curl -s -X POST "$API_BASE/users/register" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Lokesh-Team-$i\",\"email\":\"lokesh-team-$i-$(date +%s%N)@test.com\",\"referrer_user_id\":$LOKESH_ID}")
  USER_ID=$(echo "$USER_RESP" | jq -r .id)
  
  USER_LOGIN=$(curl -s -X POST "$API_BASE/users/login" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":$USER_ID}")
  USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
  
  curl -s -X POST "$API_BASE/purchases" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -d "{\"user_id\":$USER_ID,\"package_id\":$PKG_ID}" > /dev/null
  
  echo "    ✅ User ID: $USER_ID purchased"
  sleep 1
done
echo

# Step 7: Wait for all commission processing
echo "⏳ Waiting 15 seconds for all commissions to process..."
sleep 15
echo

# Step 8: Manually trigger daily commission job
echo "💰 Triggering daily commission job (SELF, GLOBAL_HELPING, MONTHLY)..."
docker exec mlm-app-1 npx tsx scripts/run-daily-commission.ts
echo

# Step 9: Wait and check results
echo "⏳ Waiting 3 seconds..."
sleep 3
echo

# Step 10: Display results
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                      FINAL RESULTS                             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo

echo "🌳 User Hierarchy:"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT u.id, u.name, u.referrer_user_id 
FROM users u 
WHERE u.id >= $RAMESH_ID 
ORDER BY u.id;"
echo

echo "💰 Wallet Balances:"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT u.name, ub.balance::numeric(10,2) 
FROM user_balances ub 
JOIN users u ON ub.user_id = u.id 
WHERE u.id >= $RAMESH_ID 
ORDER BY ub.balance DESC;"
echo

echo "📋 Commission Breakdown by User:"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT u.name, le.commission_type, COUNT(*) as entries, SUM(le.amount)::numeric(10,2) as total 
FROM ledger_entries le 
JOIN users u ON le.receiver_user_id = u.id 
WHERE u.id >= $RAMESH_ID 
GROUP BY u.name, le.commission_type 
ORDER BY u.name, le.commission_type;"
echo

echo "📊 Scheduled Commissions:"
docker exec mlm-db-1 psql -U postgres -d mlm -c "
SELECT u.name, sc.commission_type, sc.monthly_amount::numeric(10,2), sc.start_date::date, sc.end_date::date 
FROM scheduled_commissions sc 
JOIN users u ON sc.receiver_user_id = u.id 
WHERE u.id >= $RAMESH_ID 
ORDER BY u.name, sc.commission_type 
LIMIT 20;"
echo

echo "✅ Simulation complete!"

