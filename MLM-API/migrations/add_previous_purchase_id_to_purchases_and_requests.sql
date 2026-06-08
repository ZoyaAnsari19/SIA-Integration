-- Add previous_purchase_id to purchases & purchase_requests
-- This field tracks the EXACT expired purchase that was renewed/upgraded.
-- It fixes UI ambiguity when multiple purchases share the same package_id.

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS previous_purchase_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_purchases_previous_purchase_id
ON purchases(previous_purchase_id);

COMMENT ON COLUMN purchases.previous_purchase_id IS
'Purchase ID of the expired purchase that was renewed/upgraded. For upgrades, points to the old expired purchase record.';

ALTER TABLE purchase_requests
ADD COLUMN IF NOT EXISTS previous_purchase_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_purchase_requests_previous_purchase_id
ON purchase_requests(previous_purchase_id);

COMMENT ON COLUMN purchase_requests.previous_purchase_id IS
'Purchase ID of the expired purchase being renewed/upgraded (exact). Used to pick the correct expired purchase when multiple exist.';

