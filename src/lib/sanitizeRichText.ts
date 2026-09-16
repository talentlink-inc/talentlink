import sanitizeHtml from "sanitize-html";

// Original app's Job Description is contenteditable rich text (bold/italic/
// underline/lists) — plain-tag allowlist, no attributes, so no repeat of
// this session's earlier legacy-data HTML contamination bug (no <span
// data-teams>, no event handlers, no <script>).
//
// Extracted from requirements/actions.ts so it's unit-testable — a
// "use server" file may only export async functions, so a plain sync
// helper like this can't be exported from there directly.
//
// SECURITY (2026-09-14): this used to be a hand-rolled regex tag-stripper.
// It required literal whitespace before an attribute list to recognize a
// tag, e.g. `/<(\/?)([a-zA-Z0-9]+)(\s[^>]*)?>/`. Real browsers don't — the
// HTML tokenizer treats `/` as an attribute separator exactly like
// whitespace, so `<svg/onload=alert(1)>` is parsed as a real tag with a
// live onload handler while completely failing to match that regex (no
// whitespace before `onload=`), passing through untouched. That's a stored
// XSS: this field renders via dangerouslySetInnerHTML on the authenticated
// RequirementModal AND the public, unauthenticated /apply/[token] page — an
// attacker posting a crafted jobDescription directly to the Server Action
// (bypassing the contenteditable UI entirely) would execute for every
// viewer. Hand-rolled regex HTML parsing can't reliably match what a real
// browser parser accepts as a tag, so this now defers to sanitize-html,
// which parses with a real HTML tokenizer instead of guessing at syntax.
const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "p", "div"];

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    // Strip disallowed tags but keep their (still-sanitized) inner text —
    // matches the original regex's behavior of only ever removing tag
    // syntax, never the text a recruiter actually typed.
    disallowedTagsMode: "discard",
  });
}
