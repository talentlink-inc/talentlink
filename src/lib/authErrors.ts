import type { AuthError } from "@supabase/supabase-js";

// Supabase's own error text ("Invalid login credentials", "Invalid TOTP code",
// etc.) leaks SDK/provider wording straight to the user. Map the ones users
// actually hit back to the original ITStaffing app's wording (Auth.js) —
// `error.code` is Supabase's stable identifier, checked first; the message
// substring is only a fallback for versions/errors that predate `.code`.
export function authErrorMessage(error: AuthError): string {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "invalid_credentials" || message.includes("Invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (code === "mfa_verification_failed" || message.includes("Invalid TOTP code")) {
    return "Invalid verification code.";
  }
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") {
    return "Too many attempts — please wait a moment and try again.";
  }
  return message;
}
