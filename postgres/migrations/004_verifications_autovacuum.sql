-- Migration 004: per-table autovacuum tuning for the high-churn verifications
-- table. With 60 workers cycling rows through pending -> processing -> done and
-- a daily prune deleting old rows, the default (scale_factor 0.2) lets dead
-- tuples pile up before autovacuum kicks in, bloating the table and spiking
-- Postgres CPU on every scan/plan. These thresholds make autovacuum trigger
-- earlier and work harder so bloat doesn't rebuild after the one-time cleanup.
--
-- This is a catalog-only change (sets reloptions); it does NOT lock or rewrite
-- the table and is safe to run live. Idempotent.

BEGIN;

ALTER TABLE verifications SET (
  autovacuum_vacuum_scale_factor  = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit    = 2000
);

COMMIT;

-- ROLLBACK (run manually if you need to undo this migration):
--   BEGIN;
--   ALTER TABLE verifications RESET (
--     autovacuum_vacuum_scale_factor,
--     autovacuum_analyze_scale_factor,
--     autovacuum_vacuum_cost_limit
--   );
--   COMMIT;
