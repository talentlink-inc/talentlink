// Masks the person-identifying part of email addresses while keeping the
// company domain — "john.smith@acme.com" → "xxxx@acme.com". Used when
// importing GAS bench submissions, whose vendor/client contact emails the
// business chose not to carry into TalentLink.
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function maskEmailsInText(text: string): string {
  return text.replace(EMAIL_PATTERN, (_, domain: string) => `xxxx@${domain.toLowerCase()}`);
}

// For a field that should hold one email: masks it if it is one, or returns
// null for blank input. Anything that isn't email-shaped is masked within
// (it may still contain one) rather than passed through untouched.
export function maskEmail(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return maskEmailsInText(v);
}
