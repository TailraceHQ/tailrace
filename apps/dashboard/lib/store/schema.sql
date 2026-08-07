-- Tailrace policy plane schema (Postgres / Neon).
-- MVP ships an in-memory store; apply this when DATABASE_URL is configured.
-- Isolation: every row is scoped by environment_id; API keys map 1:1 to environments.

CREATE TABLE orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs (id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE environments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE policy_versions (
  id TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL REFERENCES environments (id),
  version INT NOT NULL,
  document JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (environment_id, version)
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  environment_id TEXT NOT NULL REFERENCES environments (id),
  type TEXT NOT NULL CHECK (type IN ('check', 'restore')),
  workflow_id TEXT NOT NULL,
  event_timestamp BIGINT NOT NULL,
  decisions JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_env_ts ON audit_events (environment_id, event_timestamp DESC);
-- GIN on decisions for entity / contentHash filters (MVP can seq-scan small volumes).
CREATE INDEX audit_events_decisions ON audit_events USING GIN (decisions);
