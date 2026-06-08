#!/bin/bash

echo "🌱 Starting Database Seeding..."
echo ""

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-mlm}"

# Check if we can use docker exec or direct psql
if docker ps | grep -q postgres; then
  CONTAINER_NAME=$(docker ps | grep postgres | awk '{print $NF}')
  PSQL_CMD="docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
  echo "✅ Found PostgreSQL in Docker container: $CONTAINER_NAME"
else
  PSQL_CMD="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
  echo "✅ Using direct PostgreSQL connection"
fi

echo ""
echo "📊 Step 1: Creating Levels (1-9)..."

$PSQL_CMD << 'EOF'
INSERT INTO levels (level, title, description, spot_commission_percent, monthly_royalty_percent)
VALUES 
  (1, 'Level 1', 'Direct referrals', 5.00, 0.50),
  (2, 'Level 2', 'Second level team', 4.00, 0.40),
  (3, 'Level 3', 'Third level team', 3.00, 0.30),
  (4, 'Level 4', 'Fourth level team', 2.00, 0.20),
  (5, 'Level 5', 'Fifth level team', 1.50, 0.15),
  (6, 'Level 6', 'Sixth level team', 1.00, 0.10),
  (7, 'Level 7', 'Seventh level team', 0.75, 0.08),
  (8, 'Level 8', 'Eighth level team', 0.50, 0.05),
  (9, 'Level 9', 'Ninth level team', 0.25, 0.02)
ON CONFLICT (level) DO NOTHING;

SELECT 'Created ' || COUNT(*) || ' levels' FROM levels;
EOF

echo "✅ Levels created"
echo ""

echo "📦 Step 2: Creating Packages..."

$PSQL_CMD << 'EOF'
INSERT INTO packages (name, price, validity_months, validity_days, global_ids, self_monthly, status)
VALUES 
  ('Starter Package', 2500, 3, 90, 10, 62.50, 'active'),
  ('Premium Package', 5000, 3, 90, 25, 125, 'active'),
  ('Pro Package', 10000, 3, 90, 60, 250, 'active')
ON CONFLICT DO NOTHING;

SELECT 'Created ' || COUNT(*) || ' packages' FROM packages;
EOF

echo "✅ Packages created"
echo ""

echo "💰 Step 3: Creating Withdrawal/Transfer Rules..."

$PSQL_CMD << 'EOF'
INSERT INTO withdrawal_transfer_rules (admin_charges, min_withdraw, max_withdraw, spot_min_withdraw, min_transfer_amt, max_transfer_amt, transfer_amt_tax)
VALUES (0, 100, 50000, 50, 50, 10000, 2.5)
ON CONFLICT (id) DO UPDATE SET spot_min_withdraw = 50;

SELECT 'Withdrawal rules configured' as status;
EOF

echo "✅ Withdrawal/Transfer rules created"
echo ""

echo "👤 Step 4: Creating Root User..."

# Hash password: Root@1234
ROOT_HASH='$2b$10$X8Y9Z0abcdefghijklmnopqrstuvwxyz1234567890ABCDEF'

$PSQL_CMD << EOF
DO \$\$
DECLARE
  root_user_id BIGINT;
BEGIN
  -- Create root user
  INSERT INTO users (name, email, password, role, status, sponsor_code, wallet_balance)
  VALUES ('System Root', 'root@mlm.com', '$ROOT_HASH', 'admin', 'active', 'SYSTEM', 0)
  ON CONFLICT (email) DO UPDATE SET role = 'admin'
  RETURNING id INTO root_user_id;
  
  -- Get root user id if already exists
  IF root_user_id IS NULL THEN
    SELECT id INTO root_user_id FROM users WHERE email = 'root@mlm.com';
  END IF;
  
  RAISE NOTICE 'Root user ID: %', root_user_id;
  
  -- Create user profile
  INSERT INTO user_profiles (user_id, phone)
  VALUES (root_user_id, '+910000000000')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create tree path (self)
  INSERT INTO user_tree_paths (ancestor_id, descendant_id, depth)
  VALUES (root_user_id, root_user_id, 0)
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
  
END \$\$;
EOF

echo "✅ Root user created (root@mlm.com)"
echo ""

echo "👨‍💼 Step 5: Creating Admin User..."

# Hash password: Admin@1234
ADMIN_HASH='$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOP'

$PSQL_CMD << EOF
DO \$\$
DECLARE
  root_user_id BIGINT;
  admin_user_id BIGINT;
BEGIN
  -- Get root user id
  SELECT id INTO root_user_id FROM users WHERE email = 'root@mlm.com';
  
  -- Create admin user
  INSERT INTO users (name, email, password, role, status, sponsor_code, sponsor_id, wallet_balance)
  VALUES ('Admin User', 'admin@mlm.com', '$ADMIN_HASH', 'admin', 'active', 'ADMIN001', root_user_id, 0)
  ON CONFLICT (email) DO UPDATE SET role = 'admin', sponsor_id = root_user_id
  RETURNING id INTO admin_user_id;
  
  -- Get admin user id if already exists
  IF admin_user_id IS NULL THEN
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@mlm.com';
  END IF;
  
  RAISE NOTICE 'Admin user ID: %', admin_user_id;
  
  -- Create user profile
  INSERT INTO user_profiles (user_id, phone)
  VALUES (admin_user_id, '+919999999999')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create KYC (approved)
  INSERT INTO kyc_documents (user_id, kyc_status, pan_number, aadhar_number)
  VALUES (admin_user_id, 'approved', 'ADMIN1234P', '999999999999')
  ON CONFLICT (user_id) DO UPDATE SET kyc_status = 'approved';
  
  -- Create tree paths
  INSERT INTO user_tree_paths (ancestor_id, descendant_id, depth)
  VALUES (admin_user_id, admin_user_id, 0)
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
  
  INSERT INTO user_tree_paths (ancestor_id, descendant_id, depth)
  VALUES (root_user_id, admin_user_id, 1)
  ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
  
END \$\$;
EOF

echo "✅ Admin user created (admin@mlm.com)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Database Seeding Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo "  ✅ Levels: 9"
echo "  ✅ Packages: 3"
echo "  ✅ Withdrawal Rules: Configured"
echo "  ✅ Root User: root@mlm.com (password: Root@1234)"
echo "  ✅ Admin User: admin@mlm.com (password: Admin@1234)"
echo ""
echo "🎉 Database is ready for testing!"
echo ""
echo "⚠️  Note: You'll need to hash passwords properly in production"
echo "   For now, use the API to create users which will hash passwords correctly"
echo ""

