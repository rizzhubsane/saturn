-- Idempotent WhatsApp webhook handling (Meta may deliver the same message more than once)

CREATE TABLE IF NOT EXISTS processed_webhook_messages (
  message_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_webhook_messages_at
  ON processed_webhook_messages (processed_at);

COMMENT ON TABLE processed_webhook_messages IS 'WhatsApp wamid values already handled; prevents duplicate side effects on webhook retries';
