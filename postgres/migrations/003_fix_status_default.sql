-- Migration 003: fix verifications.status default.
-- Older prod databases were migrated by deploy/server-deploy.sh which
-- ADDed the column with DEFAULT 'done'. Any future INSERT that forgets
-- to set status would land in 'done' and be invisible to the worker.
-- Align with postgres/init.sql which has always used DEFAULT 'pending'.
-- Idempotent.

BEGIN;

ALTER TABLE verifications ALTER COLUMN status SET DEFAULT 'pending';

COMMIT;

-- ROLLBACK (re-creates the C8 footgun — only use if you must revert):
--   BEGIN;
--   ALTER TABLE verifications ALTER COLUMN status SET DEFAULT 'done';
--   COMMIT;
