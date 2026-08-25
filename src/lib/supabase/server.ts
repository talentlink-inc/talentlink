import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Server Component / Server Action / Route Handler client — reads the session
// from cookies. Use this everywhere on the server except the service-role tasks
// in scripts/ (those use supabaseAdmin from ./admin.ts instead).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component with no writable cookie jar
            // (Next.js refreshes the session in proxy.ts instead) — safe to ignore.
          }
        },
      },
    }
  );
}
