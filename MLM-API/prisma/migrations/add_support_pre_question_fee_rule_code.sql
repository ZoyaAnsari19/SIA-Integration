-- Add optional fee_rule_code to support_pre_questions for topic-based ticket fees.
-- When set (e.g. NAME_CHANGE, NUMBER_CHANGE, EMAIL_CHANGE), creating a ticket with this topic
-- charges only that fee rule; when null, 2nd+ tickets use SUPPORT_TICKET fee.
ALTER TABLE support_pre_questions
  ADD COLUMN IF NOT EXISTS fee_rule_code VARCHAR(64) NULL;

COMMENT ON COLUMN support_pre_questions.fee_rule_code IS 'Fee rule to apply when user creates a ticket with this topic (e.g. NAME_CHANGE, NUMBER_CHANGE, EMAIL_CHANGE). Null = no topic fee; 2nd+ ticket uses SUPPORT_TICKET.';
