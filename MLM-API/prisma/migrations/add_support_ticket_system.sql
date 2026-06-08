-- Migration: Add support ticket system tables (pre-questions, tickets, messages)
-- Run this on local DB first: psql $DATABASE_URL -f prisma/migrations/add_support_ticket_system.sql

-- 1. Pre-defined questions (FAQ) for support
CREATE TABLE IF NOT EXISTS support_pre_questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_pre_questions_active_order ON support_pre_questions(is_active, sort_order);

-- 2. Support tickets (no FKs to avoid DB-specific PK names; app enforces refs)
CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  pre_question_id INT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  assigned_to BIGINT,
  closed_at TIMESTAMPTZ,
  closed_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- 3. Ticket messages (thread)
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_user_id BIGINT,
  message_text TEXT,
  attachment_urls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_support_ticket_messages_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created ON support_ticket_messages(ticket_id, created_at ASC);
