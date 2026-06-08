#!/bin/bash
# Seed Levels and Commission Rules as per SIA Presentation
# SPOT and MONTHLY percentages from the image

echo "🌱 Seeding SIA Levels and Commission Rules..."

docker compose exec -T db psql -U postgres -d mlm << 'EOF'
-- Update levels table with SPOT and MONTHLY percentages from image
-- DIRECT = Level 0, LEVEL-1 = Level 1, LEVEL-2 = Level 2, etc.

-- Level 0 (DIRECT)
UPDATE levels SET 
  spot_commission_percent = 5.0,
  monthly_royalty_percent = 0.75  -- 0.50%-1% average
WHERE level = 0;

-- Level 1 (LEVEL-1)
UPDATE levels SET 
  spot_commission_percent = 2.5,
  monthly_royalty_percent = 0.30
WHERE level = 1;

-- Level 2 (LEVEL-2)
UPDATE levels SET 
  spot_commission_percent = 2.50,
  monthly_royalty_percent = 0.30
WHERE level = 2;

-- Level 3 (LEVEL-3)
UPDATE levels SET 
  spot_commission_percent = 2.0,
  monthly_royalty_percent = 0.25
WHERE level = 3;

-- Level 4 (LEVEL-4)
UPDATE levels SET 
  spot_commission_percent = 2.0,
  monthly_royalty_percent = 0.25
WHERE level = 4;

-- Level 5 (LEVEL-5)
UPDATE levels SET 
  spot_commission_percent = 1.50,
  monthly_royalty_percent = 0.20
WHERE level = 5;

-- Level 6 (LEVEL-6)
UPDATE levels SET 
  spot_commission_percent = 1.50,
  monthly_royalty_percent = 0.20
WHERE level = 6;

-- Level 7 (LEVEL-7)
UPDATE levels SET 
  spot_commission_percent = 1.0,
  monthly_royalty_percent = 0.15
WHERE level = 7;

-- Level 8 (LEVEL-8)
UPDATE levels SET 
  spot_commission_percent = 1.0,
  monthly_royalty_percent = 0.15
WHERE level = 8;

-- Level 9 (LEVEL-9)
UPDATE levels SET 
  spot_commission_percent = 0.50,
  monthly_royalty_percent = 0.10
WHERE level = 9;

-- Update commission_rules table for SPOT commissions
DELETE FROM commission_rules WHERE type = 'LEVEL_SPOT';

-- Level 1 (DIRECT in code, but Level 1 in commission_rules)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 1, 5.0, NULL, NULL);

-- Level 2 (LEVEL-1)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 2, 2.50, NULL, NULL);

-- Level 3 (LEVEL-2)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 3, 2.50, NULL, NULL);

-- Level 4 (LEVEL-3)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 4, 2.0, NULL, NULL);

-- Level 5 (LEVEL-4)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 5, 2.0, NULL, NULL);

-- Level 6 (LEVEL-5)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 6, 1.50, NULL, NULL);

-- Level 7 (LEVEL-6)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 7, 1.50, NULL, NULL);

-- Level 8 (LEVEL-7)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 8, 1.0, NULL, NULL);

-- Level 9 (LEVEL-8)
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 9, 1.0, NULL, NULL);

-- Verify levels
SELECT 
  level,
  spot_commission_percent,
  monthly_royalty_percent
FROM levels 
ORDER BY level;

-- Verify commission_rules
SELECT 
  level,
  percent,
  type
FROM commission_rules 
WHERE type = 'LEVEL_SPOT'
ORDER BY level;
EOF

echo "✅ SIA Levels and Commission Rules seeded successfully!"


