-- Add previous_package_id to purchase_requests table
-- This field tracks which expired package is being renewed/upgraded
-- For renewals: previous_package_id = expired package's package_id
-- For upgrades: previous_package_id = expired package's package_id, package_id = new upgraded package_id

ALTER TABLE purchase_requests 
ADD COLUMN IF NOT EXISTS previous_package_id INT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_purchase_requests_previous_package_id 
ON purchase_requests(previous_package_id);

-- Add comment
COMMENT ON COLUMN purchase_requests.previous_package_id IS 
'Package ID of the expired package being renewed/upgraded. For same package renewal, previous_package_id = package_id. For upgrade, previous_package_id != package_id.';

