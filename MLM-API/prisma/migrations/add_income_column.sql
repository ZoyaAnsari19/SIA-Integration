-- Add income column to purchases table for 2x tracking
-- This column tracks SELF + GLOBAL_HELPING commissions earned per package

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS income DECIMAL(18, 2) DEFAULT 0;

-- Update existing purchases: Calculate income from ledger_entries
UPDATE purchases p
SET income = COALESCE((
  SELECT SUM(le.amount)
  FROM ledger_entries le
  WHERE le.purchase_id = p.id
    AND le.receiver_user_id = p.user_id
    AND le.commission_type IN ('SELF', 'GLOBAL_HELPING')
), 0)
WHERE p.status = 'completed';

-- Add comment
COMMENT ON COLUMN purchases.income IS 'Tracks SELF + GLOBAL_HELPING commissions earned from this purchase. Used for 2x investment check. Resets to 0 on renewal.';

