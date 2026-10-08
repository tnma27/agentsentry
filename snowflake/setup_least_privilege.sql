-- AgentSentry 2.0 — least-privilege application role.
-- Run ONCE as an administrator (e.g. ACCOUNTADMIN or SECURITYADMIN + SYSADMIN), after migration 001.
-- Then set SNOWFLAKE_ROLE=AGENTSENTRY_APP in .env.local so application requests stop using an admin role.
-- The app only needs to read and append rows; it cannot create, alter or drop objects with this role.

USE ROLE SECURITYADMIN;
CREATE ROLE IF NOT EXISTS AGENTSENTRY_APP COMMENT = 'AgentSentry application: read/append security events only';

USE ROLE ACCOUNTADMIN;  -- or the role that owns the warehouse/database
GRANT USAGE ON WAREHOUSE AGENTSENTRY_WH TO ROLE AGENTSENTRY_APP;
GRANT USAGE ON DATABASE AGENTSENTRY_DB TO ROLE AGENTSENTRY_APP;
GRANT USAGE ON SCHEMA AGENTSENTRY_DB.PUBLIC TO ROLE AGENTSENTRY_APP;
GRANT SELECT, INSERT ON TABLE AGENTSENTRY_DB.PUBLIC.SECURITY_EVENTS TO ROLE AGENTSENTRY_APP;
GRANT SELECT, INSERT ON TABLE AGENTSENTRY_DB.PUBLIC.SCANS TO ROLE AGENTSENTRY_APP;
GRANT SELECT, INSERT ON TABLE AGENTSENTRY_DB.PUBLIC.REMEDIATIONS TO ROLE AGENTSENTRY_APP;

-- Grant the role to the user whose RSA public key is registered (replace TNMA if you use a dedicated service user).
GRANT ROLE AGENTSENTRY_APP TO USER TNMA;

-- Optional, recommended: a dedicated service user instead of a personal admin account.
-- CREATE USER IF NOT EXISTS AGENTSENTRY_SVC TYPE = SERVICE DEFAULT_ROLE = AGENTSENTRY_APP
--   DEFAULT_WAREHOUSE = AGENTSENTRY_WH RSA_PUBLIC_KEY = '<contents of snowflake_key.pub without header/footer>';
-- GRANT ROLE AGENTSENTRY_APP TO USER AGENTSENTRY_SVC;
