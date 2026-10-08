-- AgentSentry 2.0 — migration 001: scan history and remediation tracking.
-- Non-destructive: only CREATE ... IF NOT EXISTS and ADD COLUMN IF NOT EXISTS. No data is dropped or rewritten.
-- Run in AGENTSENTRY_DB.PUBLIC.

-- One row per website scan (summary only; response bodies are never stored).
CREATE TABLE IF NOT EXISTS SCANS (
  SCAN_ID        VARCHAR       NOT NULL,
  SOURCE_TYPE    VARCHAR       NOT NULL,          -- 'website'
  TARGET         VARCHAR       NOT NULL,          -- normalized origin, e.g. https://example.com, or fixture://demo-site
  FINAL_URL      VARCHAR,                         -- URL after safe redirects (no query string)
  RISK_SCORE     NUMBER(3,0),                     -- 0..100, sum of finding weights (capped)
  FINDING_COUNT  NUMBER(5,0),
  HIGH_COUNT     NUMBER(5,0),
  MEDIUM_COUNT   NUMBER(5,0),
  LOW_COUNT      NUMBER(5,0),
  SCANNED_AT     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  CONSTRAINT PK_SCANS PRIMARY KEY (SCAN_ID)
);

-- Existing table: link each security event to a scan and a stable finding identifier.
ALTER TABLE SECURITY_EVENTS ADD COLUMN IF NOT EXISTS SCAN_ID VARCHAR;
ALTER TABLE SECURITY_EVENTS ADD COLUMN IF NOT EXISTS FINDING_KEY VARCHAR;
ALTER TABLE SECURITY_EVENTS ADD COLUMN IF NOT EXISTS TITLE VARCHAR;

-- Append-only remediation log. Latest row per (TARGET, FINDING_KEY) is the current status.
-- 'proposed' / 'applied' are user claims; only 'verified_resolved' (written after a rescan no longer observes
-- the finding) indicates verification.
CREATE TABLE IF NOT EXISTS REMEDIATIONS (
  ID           VARCHAR       DEFAULT UUID_STRING(),
  TARGET       VARCHAR       NOT NULL,
  FINDING_KEY  VARCHAR       NOT NULL,
  STATUS       VARCHAR       NOT NULL,            -- proposed | applied | verified_resolved
  SCAN_ID      VARCHAR,
  NOTE         VARCHAR,
  UPDATED_AT   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
