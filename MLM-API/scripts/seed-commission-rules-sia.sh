#!/bin/bash
# Seed Commission Rules as per SIA Presentation Image
# Package: ₹5 Lakh (₹500,000)
# SPOT Commission rates from image

echo "🌱 Seeding SIA Commission Rules..."

docker compose exec -T db psql -U postgres -d mlm << 'EOF'
-- Update commission rules as per SIA presentation
-- DIRECT = Level 1 (handled separately in code, but we'll set Level 1 for reference)
-- LEVEL-1 = Level 2, LEVEL-2 = Level 3, etc.

-- Delete existing rules
DELETE FROM commission_rules WHERE type = 'LEVEL_SPOT';

-- Insert new rules based on image
-- Level 1 (DIRECT): 5% = ₹25,000 on ₹5 Lakh
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 1, 5.0, NULL, NULL);

-- Level 2 (LEVEL-1): 2.50% = ₹12,500
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 2, 2.50, NULL, NULL);

-- Level 3 (LEVEL-2): 2.50% = ₹12,500
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 3, 2.50, NULL, NULL);

-- Level 4 (LEVEL-3): 2% = ₹10,000
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 4, 2.0, NULL, NULL);

-- Level 5 (LEVEL-4): 2% = ₹10,000
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 5, 2.0, NULL, NULL);

-- Level 6 (LEVEL-5): 1.50% = ₹7,500
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 6, 1.50, NULL, NULL);

-- Level 7 (LEVEL-6): 1.50% = ₹7,500
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 7, 1.50, NULL, NULL);

-- Level 8 (LEVEL-7): 1% = ₹5,000
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 8, 1.0, NULL, NULL);

-- Level 9 (LEVEL-8): 1% = ₹5,000
INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
VALUES ('LEVEL_SPOT', 9, 1.0, NULL, NULL);

-- Verify
SELECT level, percent, type 
FROM commission_rules 
WHERE type = 'LEVEL_SPOT' 
ORDER BY level;
EOF

echo "✅ Commission rules seeded successfully!"


