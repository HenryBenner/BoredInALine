-- Migration 002: Broadcast notifications and super admins
-- Idempotent: safe to run on existing databases

CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);

CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  sent_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  recipient_count INTEGER DEFAULT 0,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_sent_at ON broadcast_notifications(sent_at DESC);
