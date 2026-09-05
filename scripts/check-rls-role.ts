// Row-Level Security is only as real as the role the app connects as.
// Postgres unconditionally exempts superusers from every RLS policy, and
// exempts the owning role too unless FORCE ROW LEVEL SECURITY is set (which
// the RLS migration does set) — but FORCE does nothing against an actual
// superuser. Supabase projects commonly provision the default "postgres"
// role as a real Postgres superuser, which would make every policy in
// 20260905120000_add_row_level_security a silent no-op.
//
// Run this after applying that migration, against the exact DATABASE_URL
// the app uses, before trusting RLS is doing anything at all:
//   npx tsx scripts/check-rls-role.ts

import "dotenv/config";
import { Pool } from "pg";

const APP_ROLE = "talentlink_app";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const {
    rows: [role],
  } = await pool.query(
    "SELECT current_user AS name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
  );

  console.log(`Connected as: ${role.name}`);
  console.log(`  superuser:   ${role.rolsuper}`);
  console.log(`  bypassrls:   ${role.rolbypassrls}`);

  if (!role.rolsuper && !role.rolbypassrls) {
    console.log(
      "\n✓ This role is subject to RLS. As long as the migration applied cleanly, the policies are real."
    );
    await pool.end();
    return;
  }

  console.log(
    `\n✗ This role bypasses RLS entirely — every policy in the migration is currently a no-op.\n` +
      `Postgres exempts superusers (and BYPASSRLS roles) from RLS unconditionally; no policy or\n` +
      `FORCE ROW LEVEL SECURITY setting can change that.\n\n` +
      `Fix: create a dedicated, non-superuser role for the app to connect as, then point\n` +
      `DATABASE_URL/DIRECT_URL (locally and in Vercel) at it instead of "${role.name}".\n\n` +
      `Run this once, connected as ${role.name} (e.g. via the Supabase SQL editor):\n`
  );
  console.log(
    [
      `CREATE ROLE ${APP_ROLE} WITH LOGIN PASSWORD '<choose-a-strong-password>' NOSUPERUSER NOBYPASSRLS;`,
      `GRANT USAGE ON SCHEMA public TO ${APP_ROLE};`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_ROLE};`,
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_ROLE};`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_ROLE};`,
    ].join("\n")
  );
  console.log(
    `\nThen change DATABASE_URL/DIRECT_URL's username from "${role.name}" to "${APP_ROLE}"\n` +
      `(keep the same pooler host/port — e.g. postgresql://${APP_ROLE}.<project-ref>:<password>@...),\n` +
      `and re-run this script to confirm before deploying.`
  );

  await pool.end();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
