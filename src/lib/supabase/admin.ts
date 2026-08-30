import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only import this from server-only code
// that must run privileged (migration scripts, Inngest-style background jobs,
// route handlers that already did their own auth check).
//
// Lazily instantiated: Next.js statically imports every route handler's
// module graph during `next build` to collect route config, which would
// otherwise construct this client (and throw on a missing env var) even in
// environments — like CI — that never actually call a route needing it.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return cached;
}

export const RESUME_BUCKET = "resumes";
