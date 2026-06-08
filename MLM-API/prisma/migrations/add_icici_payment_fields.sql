-- Migration: Add ICICI payment gateway fields to purchases table
-- Run this on postgres-p1 database

ALTER TABLE purchases 
ADD COLUMN IF NOT EXISTS merchant_txn_no VARCHAR(255),
ADD COLUMN IF NOT EXISTS icici_txn_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS icici_payment_id VARCHAR(255);

-- Add index on merchant_txn_no for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchases_merchant_txn_no ON purchases(merchant_txn_no);

COMMENT ON COLUMN purchases.merchant_txn_no IS 'ICICI merchant transaction number';
COMMENT ON COLUMN purchases.icici_txn_id IS 'ICICI transaction ID from gateway';
COMMENT ON COLUMN purchases.icici_payment_id IS 'ICICI payment ID from gateway';
