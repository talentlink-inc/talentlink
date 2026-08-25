# TalentLink

Phase 1 of the IT Staffing Portal rebuild: the recruitment module only —
Requirements (JDs), Submissions, Interviews, Placements (a status filter over
Submissions, not a separate table). Migrated out of the Google Apps Script
project at `/Users/rsaleru/claudecode/ITStaffing/`.

Stack: Next.js 16 (App Router, TypeScript) · Prisma 7 · Postgres on Supabase ·
Supabase Auth + Storage · deployed on Vercel.

Single-tenant for now (`tenant_id` is on every table so Postgres RLS can be
turned on later without a schema change — see `docs/` in the original GAS repo
for the full multi-tenant plan this phase feeds into).

## Setup

1. Create a Supabase project. Enable the `resumes` storage bucket (private).
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — Supabase's connection string (Session pooler, port 5432, for migrations)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Google service account JSON with read access to the source spreadsheet + Drive resume files (only needed to run the migration script)
3. Install deps and set up the database:
   ```bash
   npm install
   npm run db:migrate   # creates tables, runs prisma generate
   npm run db:seed      # creates the Digital Links Inc. tenant row
   ```
4. Create your first user in Supabase Auth (dashboard or `supabase.auth.admin.createUser`), then insert a matching row in the `users` table with `role = 'Admin'` and the same email.
5. `npm run dev` → http://localhost:3000

## Migrating data from the GAS app

Pulls the 100 most recently submitted candidates and the requirement JDs they
reference. Idempotent — safe to re-run.

```bash
npm run migrate:submissions -- --dry-run   # preview, writes nothing
npm run migrate:submissions                # writes to Postgres + uploads resumes to Supabase Storage
npm run migrate:submissions -- --skip-files  # skip resume downloads/uploads
```

Requires `GOOGLE_SERVICE_ACCOUNT_JSON` and `GAS_SPREADSHEET_ID` in `.env`. The
service account needs Viewer access shared on the source spreadsheet and the
`ITStaffing_Resumes` Drive folder.

## Deploying to Vercel

```bash
npx vercel link
npx vercel env pull .env.local   # or push the same vars from .env via the dashboard
npx vercel --prod
```

Add all `.env` vars (except the migration-only ones) as Vercel project env
vars. `postinstall` runs `prisma generate` automatically on every deploy.

## What's deliberately out of scope for phase 1

- Multi-tenant subdomain routing (schema is ready for it; `proxy.ts` doesn't do it yet)
- Bench sales, vendors, campaigns, email reports, AI analysis — later phases
- Postgres RLS policies — add before onboarding a second tenant
- User management UI — create/manage users directly in Supabase + the `users` table for now
