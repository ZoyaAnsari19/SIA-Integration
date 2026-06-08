#!/bin/bash
# Complete SIA Seed Script
# Seeds: Levels, Commission Rules, and Operation Fees as per SIA Presentation

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  SIA COMPLETE SEED SCRIPT                                     ║"
echo "║  Levels, Commission Rules, and Operation Fees                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

docker compose exec -T db psql -U postgres -d mlm << 'EOF'
-- ============================================================
-- 1. SEED LEVELS (with business requirements and percentages)
-- ============================================================

-- Level 0 (DIRECT / Field Worker)
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  0,
  'Field Worker',
  'Direct level - Starting position',
  NULL,
  5.0,  -- SPOT: 5%
  0.75, -- MONTHLY: 0.50%-1% (using 0.75% as average)
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 1 (LEVEL-1 / Company Representative)
-- Condition: 3.75L ANY LEG
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  1,
  'Company Representative',
  'Har 1 direct member ke niche se ₹3.75 Lakh ka business',
  'T-shirt and Diary',
  2.5,  -- SPOT: 2.5%
  0.30, -- MONTHLY: 0.30%
  '{"required_leg_count": 1, "required_leg_min_amount": 375000, "total_business": 375000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 2 (LEVEL-2 / City Manager)
-- Condition: 3.75L X 4 LEG = ₹15L
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  2,
  'Company City Manager',
  'Har 4 direct member ke niche se ₹3.75 Lakh ka business (total ₹15 Lakh)',
  '5G Mobile',
  2.50, -- SPOT: 2.50%
  0.30, -- MONTHLY: 0.30%
  '{"required_leg_count": 4, "required_leg_min_amount": 375000, "total_business": 1500000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 3 (LEVEL-3 / Area Manager)
-- Condition: 25L X 3 LEG = ₹75L
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  3,
  'Company Area Manager',
  'Har 3 direct member ke niche se ₹25 Lakh ka business (total ₹75 Lakh)',
  'Laptop',
  2.0,  -- SPOT: 2%
  0.25, -- MONTHLY: 0.25%
  '{"required_leg_count": 3, "required_leg_min_amount": 2500000, "total_business": 7500000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 4 (LEVEL-4 / District Manager)
-- Condition: 77.62L X 3 LEG = ₹2.32CR
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  4,
  'Company District Manager',
  'Har 3 direct member ke niche se ₹77.62 Lakh ka business (total ₹2.32 Crore)',
  'Motorcycle',
  2.0,  -- SPOT: 2%
  0.25, -- MONTHLY: 0.25%
  '{"required_leg_count": 3, "required_leg_min_amount": 7762000, "total_business": 23286000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 5 (LEVEL-5 / Division Manager)
-- Condition: 2.53CR X 3 LEG = ₹7.61CR
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  5,
  'Division Manager',
  'Har 3 direct member ke niche se ₹2.53 Crore ka business (total ₹7.61 Crore)',
  'Car',
  1.50, -- SPOT: 1.50%
  0.20, -- MONTHLY: 0.20%
  '{"required_leg_count": 3, "required_leg_min_amount": 25300000, "total_business": 76100000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 6 (LEVEL-6 / Regional Manager)
-- Condition: 13.32CR X 2 LEG = ₹26.65CR
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  6,
  'Regional Manager',
  'Har 2 direct member ke niche se ₹13.32 Crore ka business (total ₹26.65 Crore)',
  'Land in Secure City',
  1.50, -- SPOT: 1.50%
  0.20, -- MONTHLY: 0.20%
  '{"required_leg_count": 2, "required_leg_min_amount": 133200000, "total_business": 266500000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 7 (LEVEL-7 / State Manager)
-- Condition: 51.97 CR X 2 LEG = ₹103.93CR
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  7,
  'State Manager',
  'Har 2 direct member ke niche se ₹51.97 Crore ka business (total ₹103.93 Crore)',
  'Flat in Secure City',
  1.0,  -- SPOT: 1%
  0.15, -- MONTHLY: 0.15%
  '{"required_leg_count": 2, "required_leg_min_amount": 519700000, "total_business": 1039300000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 8 (LEVEL-8 / National Manager)
-- Condition: 223.48CR X 2 LEG = ₹446.96CR
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  8,
  'National Manager',
  'Har 2 direct member ke niche se ₹223.48 Crore ka business (total ₹446.96 Crore)',
  'Company Director',
  1.0,  -- SPOT: 1%
  0.15, -- MONTHLY: 0.15%
  '{"required_leg_count": 2, "required_leg_min_amount": 2234800000, "total_business": 4469600000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- Level 9 (LEVEL-9 / King / Freedom)
-- Condition: 2100 CR
INSERT INTO levels (level, title, description, reward, spot_commission_percent, monthly_royalty_percent, business_requirement, created_at, updated_at)
VALUES (
  9,
  'King',
  'Total ₹2100 Crore ka business',
  'Freedom',
  0.50, -- SPOT: 0.50%
  0.10, -- MONTHLY: 0.10%
  '{"required_leg_count": 0, "required_leg_min_amount": 0, "total_business": 21000000000}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();

-- ============================================================
-- 2. SEED COMMISSION RULES (LEVEL_SPOT)
-- ============================================================

-- Delete existing rules
DELETE FROM commission_rules WHERE type = 'LEVEL_SPOT';

-- Level 1 (DIRECT): 5%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 1, 5.0, NULL, NULL);

-- Level 2 (LEVEL-1): 2.5%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 2, 2.50, NULL, NULL);

-- Level 3 (LEVEL-2): 2.5%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 3, 2.50, NULL, NULL);

-- Level 4 (LEVEL-3): 2%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 4, 2.0, NULL, NULL);

-- Level 5 (LEVEL-4): 2%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 5, 2.0, NULL, NULL);

-- Level 6 (LEVEL-5): 1.5%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 6, 1.50, NULL, NULL);

-- Level 7 (LEVEL-6): 1.5%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 7, 1.50, NULL, NULL);

-- Level 8 (LEVEL-7): 1%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 8, 1.0, NULL, NULL);

-- Level 9 (LEVEL-8): 1%
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 9, 1.0, NULL, NULL);

-- ============================================================
-- 3. SEED OPERATION FEES
-- ============================================================

-- Delete existing fee rules
DELETE FROM fee_rules;

-- KYC Submission Fee
INSERT INTO fee_rules (rule_code, rule_name, amount, description, applies_to)
VALUES (
  'KYC_SUBMISSION',
  'KYC Submission Fee',
  50,
  'Fee charged when user submits KYC documents',
  'all_users'
);

-- Account Change Fee
INSERT INTO fee_rules (rule_code, rule_name, amount, description, applies_to)
VALUES (
  'ACCOUNT_CHANGE',
  'Account Change Fee',
  25,
  'Fee charged when user changes account details',
  'all_users'
);

-- Name Change Fee
INSERT INTO fee_rules (rule_code, rule_name, amount, description, applies_to)
VALUES (
  'NAME_CHANGE',
  'Name Change Fee',
  25,
  'Fee charged when user changes name',
  'all_users'
);

-- Withdrawal Fee
INSERT INTO fee_rules (rule_code, rule_name, amount, description, applies_to)
VALUES (
  'WITHDRAWAL',
  'Withdrawal Processing Fee',
  10,
  'Fee charged for processing withdrawal requests',
  'all_users'
);

-- ID Transfer Fee
INSERT INTO fee_rules (rule_code, rule_name, amount, description, applies_to)
VALUES (
  'ID_TRANSFER',
  'ID Transfer Fee',
  100,
  'Fee charged for transferring user ID to another account',
  'all_users'
);

-- OTP Generation Fee
INSERT INTO fee_rules (rule_code, rule_name, amount, description, applies_to)
VALUES (
  'OTP_GENERATION',
  'OTP Generation Fee',
  1,
  'Fee charged for generating OTP',
  'all_users'
);

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT '✅ Levels seeded successfully!' as status;
SELECT level, title, spot_commission_percent, monthly_royalty_percent FROM levels ORDER BY level;

SELECT '✅ Commission rules seeded successfully!' as status;
SELECT level, percent, type FROM commission_rules WHERE type = 'LEVEL_SPOT' ORDER BY level;

SELECT '✅ Operation fees seeded successfully!' as status;
SELECT rule_code, rule_name, amount FROM fee_rules ORDER BY rule_code;
EOF

echo ""
echo "✅ Complete SIA seed script executed successfully!"
echo ""
echo "📊 Summary:"
echo "  - Levels: 10 levels (0-9) with business requirements and commission percentages"
echo "  - Commission Rules: 9 LEVEL_SPOT rules (Level 1-9)"
echo "  - Operation Fees: 6 fee rules (KYC, Account Change, Name Change, Withdrawal, ID Transfer, OTP)"
echo ""


