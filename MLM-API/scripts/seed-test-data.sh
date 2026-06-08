#!/bin/bash

# Seed Test Data for E2E Testing
# Creates purchases, transfers, and commissions to test APIs

echo "🌱 Seeding Test Business Data..."

# Get database container
DB_CONTAINER=$(docker ps --filter "name=mlm-api-db" --format "{{.Names}}" | head -1)

if [ -z "$DB_CONTAINER" ]; then
  echo "❌ Database container not found!"
  exit 1
fi

echo "✅ Found database: $DB_CONTAINER"

# Get root user ID and a test user ID
ROOT_ID=$(docker exec -i $DB_CONTAINER psql -U postgres -d mlm -t -c "SELECT id FROM users WHERE email = 'root@mlm.com' LIMIT 1;" | tr -d ' ')
TEST_USER_ID=$(docker exec -i $DB_CONTAINER psql -U postgres -d mlm -t -c "SELECT id FROM users WHERE email LIKE 'test1_%@test.com' ORDER BY id DESC LIMIT 1;" | tr -d ' ')

if [ -z "$ROOT_ID" ] || [ -z "$TEST_USER_ID" ]; then
  echo "❌ Users not found! Run seed-db.sh first"
  exit 1
fi

echo "📦 Root User ID: $ROOT_ID"
echo "👤 Test User ID: $TEST_USER_ID"

# Get a package ID
PACKAGE_ID=$(docker exec -i $DB_CONTAINER psql -U postgres -d mlm -t -c "SELECT id FROM packages WHERE status = 'active' LIMIT 1;" | tr -d ' ')

if [ -z "$PACKAGE_ID" ]; then
  echo "❌ No active packages found!"
  exit 1
fi

echo "📦 Package ID: $PACKAGE_ID"

# Seed data
docker exec -i $DB_CONTAINER psql -U postgres -d mlm << EOF

-- 1. Create a purchase for test user
INSERT INTO purchases (user_id, package_id, amount, status, purchased_at, active_until)
SELECT 
  $TEST_USER_ID,
  $PACKAGE_ID,
  (SELECT price FROM packages WHERE id = $PACKAGE_ID),
  'completed',
  NOW(),
  NOW() + INTERVAL '3 months'
WHERE NOT EXISTS (
  SELECT 1 FROM purchases WHERE user_id = $TEST_USER_ID
)
RETURNING id, user_id, amount;

-- 2. Create user balance for test user
INSERT INTO user_balances (user_id, balance, updated_at)
VALUES ($TEST_USER_ID, 5000.00, NOW())
ON CONFLICT (user_id) DO UPDATE SET balance = 5000.00;

-- 3. Create some ledger entries (commissions) for team business
INSERT INTO ledger_entries (source_user_id, receiver_user_id, amount, commission_type, description, created_at)
SELECT 
  $TEST_USER_ID,
  $ROOT_ID,
  500.00,
  'SPOT',
  'Test SPOT commission',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_entries WHERE receiver_user_id = $ROOT_ID AND commission_type = 'SPOT'
);

INSERT INTO ledger_entries (source_user_id, receiver_user_id, amount, commission_type, description, created_at)
SELECT 
  $TEST_USER_ID,
  $ROOT_ID,
  300.00,
  'MONTHLY',
  'Test MONTHLY commission',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM ledger_entries WHERE receiver_user_id = $ROOT_ID AND commission_type = 'MONTHLY'
);

-- 4. Update root user balance
INSERT INTO user_balances (user_id, balance, updated_at)
VALUES ($ROOT_ID, 800.00, NOW())
ON CONFLICT (user_id) DO UPDATE SET balance = 800.00;

SELECT '✅ Test data seeded successfully!' as result;

EOF

echo ""
echo "✅ Test Data Seeded!"
echo ""
echo "📊 Summary:"
echo "  ✅ Created purchase for user $TEST_USER_ID"
echo "  ✅ Set user balance: ₹5000"
echo "  ✅ Created SPOT commission: ₹500"
echo "  ✅ Created MONTHLY commission: ₹300"
echo "  ✅ Set root balance: ₹800"
echo ""
echo "🧪 Now run tests again - APIs should show real data!"

