CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE verdict_type AS ENUM ('valid', 'invalid', 'risky', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ip_status AS ENUM ('active', 'paused', 'blacklisted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bulk_jobs (
  id                BIGSERIAL PRIMARY KEY,
  job_uuid          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  original_filename TEXT,
  total_count       INT NOT NULL DEFAULT 0,
  processed_count   INT NOT NULL DEFAULT 0,
  valid_count       INT NOT NULL DEFAULT 0,
  invalid_count     INT NOT NULL DEFAULT 0,
  risky_count       INT NOT NULL DEFAULT 0,
  unknown_count     INT NOT NULL DEFAULT 0,
  status            job_status NOT NULL DEFAULT 'pending',
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  error             TEXT
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status      ON bulk_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_uploaded_at ON bulk_jobs(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS verifications (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  bulk_job_id  BIGINT REFERENCES bulk_jobs(id) ON DELETE SET NULL,
  verdict      verdict_type,
  reason       TEXT,
  ip_used      INET,
  raw_result   JSONB,
  duration_ms  INT,
  status       TEXT NOT NULL DEFAULT 'pending',
  verified_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_bulk_job ON verifications(bulk_job_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status   ON verifications(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verifications_email    ON verifications(email);

CREATE TABLE IF NOT EXISTS ip_pool (
  id            SERIAL PRIMARY KEY,
  ip            INET NOT NULL UNIQUE,
  hostname      TEXT NOT NULL,
  socks5_port   INT NOT NULL,
  daily_cap     INT NOT NULL DEFAULT 18000,
  used_today    INT NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        ip_status NOT NULL DEFAULT 'active'
);

INSERT INTO ip_pool (ip, hostname, socks5_port) VALUES
  ('135.181.11.73', 'verify1.inboxaxis.net', 11073),
  ('135.181.11.74', 'verify2.inboxaxis.net', 11074),
  ('135.181.11.75', 'verify3.inboxaxis.net', 11075),
  ('135.181.11.76', 'verify4.inboxaxis.net', 11076),
  ('135.181.11.77', 'verify5.inboxaxis.net', 11077),
  ('135.181.11.78', 'verify6.inboxaxis.net', 11078)
ON CONFLICT (ip) DO NOTHING;
