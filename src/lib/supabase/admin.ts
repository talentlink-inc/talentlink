import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only import this from server-only code
// that must run privileged (migration scripts, Inngest-style background jobs).
// Never import this from anything reachable by a request handler without an
// explicit auth check first.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const RESUME_BUCKET = "resumes";
