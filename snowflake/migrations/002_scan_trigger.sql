-- AgentSentry 2.0 — migration 002: record what triggered each scan (SCAN_TRIGGER; TRIGGER is a reserved word).
-- Non-destructive: adds one nullable column. Existing rows read as manual scans.
-- Values: 'manual' (user pressed scan/rescan) | 'scheduled' (the /api/cron/rescan endpoint).
ALTER TABLE SCANS ADD COLUMN IF NOT EXISTS SCAN_TRIGGER VARCHAR;
