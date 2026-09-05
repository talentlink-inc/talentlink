-- Row-Level Security: a second, database-enforced layer of tenant
-- isolation underneath the existing app-level `where: { tenantId }`
-- filtering used throughout src/. If any query anywhere ever forgets that
-- filter, Postgres itself refuses to return or write rows belonging to a
-- different tenant, instead of silently leaking them.
--
-- tenant_id columns are TEXT here (Prisma's default @id @default(uuid())
-- mapping — NOT the native Postgres `uuid` type), so policies compare as
-- text. Confirmed against prisma/migrations/20260830120333_init/migration.sql
-- before writing this — a `::uuid` cast here would have silently broken
-- every policy.
--
-- current_setting('app.tenant_id', true) returns NULL if the app forgot to
-- set it for this transaction; NULL = anything is NULL (not true) in SQL,
-- so the default behavior on a missing setting is to deny access — fail
-- closed, not fail open.
--
-- IMPORTANT — this migration alone is NOT sufficient. Postgres exempts
-- superusers from RLS unconditionally, and exempts the owning role unless
-- FORCE ROW LEVEL SECURITY is set (included below). Supabase's default
-- "postgres" role is commonly provisioned as an actual superuser, in which
-- case every policy here is silently a no-op no matter how it's written.
-- Before trusting this migration, run scripts/check-rls-role.ts (added in
-- this same change) against the app's actual DATABASE_URL role and follow
-- its instructions if it reports a problem.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
-- users gets one extra clause: getCurrentUser() (src/lib/auth.ts) has to look
-- up a row by authUserId *before* it knows whether that user belongs to the
-- tenant the subdomain resolved to — that's the mismatch it's checking for.
-- app.bypass_rls is set only by getAuthBypassDb() in src/lib/tenantDb.ts,
-- never from request input.
CREATE POLICY tenant_isolation ON users
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.bypass_rls', true) = 'on'
  );

ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON requirements
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- requirement_assignees has no tenant_id column of its own (just
-- requirement_id + user_id) — scope it via the requirement it belongs to.
ALTER TABLE requirement_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_assignees FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON requirement_assignees
  USING (
    EXISTS (
      SELECT 1 FROM requirements r
      WHERE r.id = requirement_assignees.requirement_id
        AND r.tenant_id = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM requirements r
      WHERE r.id = requirement_assignees.requirement_id
        AND r.tenant_id = current_setting('app.tenant_id', true)
    )
  );

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON candidates
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON resumes
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON submissions
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON interviews
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notes
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_integrations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON calendar_integrations
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- tenants itself is deliberately NOT given a tenant-scoped policy: proxy.ts
-- has to look up an arbitrary tenant BY SUBDOMAIN to resolve who's asking in
-- the first place (that's the request that establishes app.tenant_id) —
-- scoping tenants to app.tenant_id would make that lookup unable to find
-- anything. It holds no per-row secrets itself (name/subdomain/plan/status);
-- the sensitive data one tenant could otherwise read from another
-- (candidates, submissions, calendar OAuth tokens, etc.) is exactly what
-- every policy above protects.
