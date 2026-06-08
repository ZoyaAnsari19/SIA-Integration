-- Migration: Add gateway_payment_intents table for renewal via payment gateway
-- Used when request_type=renew: we don't create a purchase until callback (we update existing purchase).
-- Links merchant_txn_no to previous_purchase_id for callback handling.

CREATE TABLE IF NOT EXISTS gateway_payment_intents (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              BIGINT NOT NULL,
  merchant_txn_no      VARCHAR(255) NOT NULL UNIQUE,
  request_type         VARCHAR(50) NOT NULL,
  package_id           INTEGER NOT NULL,
  course_id            VARCHAR(255),
  previous_purchase_id BIGINT,
  amount               DECIMAL(18, 2) NOT NULL,
  status               VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gateway_payment_intents_merchant_txn_no ON gateway_payment_intents(merchant_txn_no);
CREATE INDEX IF NOT EXISTS idx_gateway_payment_intents_user_id ON gateway_payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_gateway_payment_intents_status ON gateway_payment_intents(status);

COMMENT ON TABLE gateway_payment_intents IS 'Stores payment intent for gateway renewal (same-package); callback updates existing purchase by previous_purchase_id';
