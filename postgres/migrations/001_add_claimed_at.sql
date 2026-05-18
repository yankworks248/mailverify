-- Migration 001: add claimed_at to verifications so the stale-claim janitor
-- (backend/src/cron/staleClaim.js) can reset rows that workers abandoned.
-- Apply against an already-initialised database. Idempotent.

BEGIN;

ALTER TABLE verifications
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_verifications_processing
  ON verifications(claimed_at) WHERE status = 'processing';

-- One-time rescue: rows already stuck in 'processing' pre-migration have
-- claimed_at = NULL, and the janitor's "claimed_at < threshold" predicate
-- evaluates NULL -> false, so they would never be reset. Push them back
-- to 'pending' once so workers re-pick them up.
UPDATE verifications
   SET status = 'pending'
 WHERE status = 'processing';

COMMIT;

-- ROLLBACK (run manually if you need to undo this migration):
--   BEGIN;
--   DROP INDEX IF EXISTS idx_verifications_processing;
--   ALTER TABLE verifications DROP COLUMN IF EXISTS claimed_at;
--   COMMIT;
-- Note: the one-time UPDATE above cannot be rolled back (the original
-- 'processing' rows are not recorded anywhere). That is acceptable because
-- those rows were already orphaned.
