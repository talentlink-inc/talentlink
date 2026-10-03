import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// CSRF protection for the calendar OAuth flow. `state` used to be the tenant
// id — predictable, and never checked on the way back — so a crafted
// callback link carrying an attacker's own authorization code, opened by
// anyone signed in to the workspace, would connect the tenant's calendar
// to the attacker's account (and sync every interview to it). Now it's a
// one-time random value bound to the browser that started the flow.
const COOKIE_NAME = "tl_oauth_state";

export async function issueOAuthState(): Promise<string> {
  const state = randomBytes(32).toString("hex");
  (await cookies()).set(COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive the top-level redirect back from the provider
    path: "/api/integrations",
    maxAge: 10 * 60,
  });
  return state;
}

export async function consumeOAuthState(returned: string | null): Promise<boolean> {
  const jar = await cookies();
  const expected = jar.get(COOKIE_NAME)?.value;
  jar.delete({ name: COOKIE_NAME, path: "/api/integrations" });
  if (!expected || !returned) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(returned);
  return a.length === b.length && timingSafeEqual(a, b);
}
