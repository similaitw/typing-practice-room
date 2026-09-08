-- Phase 4: aggregate typing mistake data only. No full typed text is stored.
ALTER TABLE typing_records ADD COLUMN IF NOT EXISTS mistakes jsonb;
