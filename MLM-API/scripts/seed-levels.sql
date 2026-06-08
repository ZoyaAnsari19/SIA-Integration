-- Seed levels data with Spot Commission and Monthly Royalty percentages only
-- Amounts are calculated dynamically from purchase amounts
INSERT INTO levels (
  level, title, description, reward, 
  spot_commission_percent,
  monthly_royalty_percent,
  business_requirement, created_at, updated_at
)
VALUES
  -- Level 0: Direct (Field Worker)
  (0, 'Field Worker', 'Direct level - Starting position', NULL, 
   5.0, 0.75, -- Spot: 5%, Monthly: 0.50%-1% (using 0.75% as average)
   NULL, NOW(), NOW()),
  
  -- Level 1: Company Representative (combined: 4 legs, min 7500 each, total 2.15L)
  (1, 'Company Representative', '4 direct compulsory, har direct ke niche min ₹7,500, total team business ₹2.15 Lakh', 'T-shirt and Diary',
   2.5, 0.30, -- Spot: 2.5%, Monthly: 0.30%
   '{"required_leg_count": 4, "required_leg_min_amount": 7500, "total_business": 215000}'::jsonb, NOW(), NOW()),
  
  -- Level 2: Company City Manager
  (2, 'Company City Manager', 'Har 4 direct member ke niche se ₹3.75 Lakh ka business (total ₹15 Lakh)', '5G Mobile',
   2.50, 0.30, -- Spot: 2.50%, Monthly: 0.30%
   '{"required_leg_count": 4, "required_leg_min_amount": 375000, "total_business": 1500000}'::jsonb, NOW(), NOW()),
  
  -- Level 3: Company Area Manager
  (3, 'Company Area Manager', 'Har 3 direct member ke niche se ₹25 Lakh ka business (total ₹75 Lakh)', 'Laptop',
   2.0, 0.25, -- Spot: 2%, Monthly: 0.25%
   '{"required_leg_count": 3, "required_leg_min_amount": 2500000, "total_business": 7500000}'::jsonb, NOW(), NOW()),
  
  -- Level 4: Company District Manager
  (4, 'Company District Manager', 'Har 3 direct member ke niche se ₹77.62 Lakh ka business (total ₹2.32 Crore)', 'Motorcycle',
   2.0, 0.25, -- Spot: 2%, Monthly: 0.25%
   '{"required_leg_count": 3, "required_leg_min_amount": 7762000, "total_business": 23286000}'::jsonb, NOW(), NOW()),
  
  -- Level 5: Division Manager
  (5, 'Division Manager', 'Har 3 direct member ke niche se ₹2.53 Crore ka business (total ₹7.61 Crore)', 'Car',
   1.50, 0.20, -- Spot: 1.50%, Monthly: 0.20%
   '{"required_leg_count": 3, "required_leg_min_amount": 25300000, "total_business": 76100000}'::jsonb, NOW(), NOW()),
  
  -- Level 6: Regional Manager
  (6, 'Regional Manager', 'Har 2 direct member ke niche se ₹13.32 Crore ka business (total ₹26.65 Crore)', 'Land in Secure City',
   1.50, 0.20, -- Spot: 1.50%, Monthly: 0.20%
   '{"required_leg_count": 2, "required_leg_min_amount": 133200000, "total_business": 266500000}'::jsonb, NOW(), NOW()),
  
  -- Level 7: State Manager
  (7, 'State Manager', 'Har 2 direct member ke niche se ₹51.97 Crore ka business (total ₹103.93 Crore)', 'Flat in Secure City',
   1.0, 0.15, -- Spot: 1%, Monthly: 0.15%
   '{"required_leg_count": 2, "required_leg_min_amount": 519700000, "total_business": 1039300000}'::jsonb, NOW(), NOW()),
  
  -- Level 8: National Manager
  (8, 'National Manager', 'Har 2 direct member ke niche se ₹223.48 Crore ka business (total ₹446.96 Crore)', 'Company Director',
   1.0, 0.15, -- Spot: 1%, Monthly: 0.15%
   '{"required_leg_count": 2, "required_leg_min_amount": 2234800000, "total_business": 4469600000}'::jsonb, NOW(), NOW()),
  
  -- Level 9: King
  (9, 'King', 'Total ₹2100 Crore ka business', 'Freedom',
   0.50, 0.10, -- Spot: 0.50%, Monthly: 0.10%
   '{"required_leg_count": 0, "required_leg_min_amount": 0, "total_business": 21000000000}'::jsonb, NOW(), NOW())
ON CONFLICT (level) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward = EXCLUDED.reward,
  spot_commission_percent = EXCLUDED.spot_commission_percent,
  monthly_royalty_percent = EXCLUDED.monthly_royalty_percent,
  business_requirement = EXCLUDED.business_requirement,
  updated_at = NOW();
