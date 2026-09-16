import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "./sanitizeRichText";

// [security] jobDescription renders via dangerouslySetInnerHTML on both the
// authenticated RequirementModal and the public, unauthenticated
// /apply/[token] page — anything that survives this function runs in both
// places for every viewer. Every case here is a negative test: input that
// must NOT come out executable.
describe("[security] sanitizeRichText", () => {
  it("keeps plain text untouched", () => {
    expect(sanitizeRichText("Looking for a senior engineer.")).toBe("Looking for a senior engineer.");
  });

  it("keeps allowlisted formatting tags", () => {
    expect(sanitizeRichText("<p>Must have <b>5+ years</b> of <i>React</i>.</p>")).toBe(
      "<p>Must have <b>5+ years</b> of <i>React</i>.</p>"
    );
    expect(sanitizeRichText("<ul><li>Node.js</li><li>Postgres</li></ul>")).toBe(
      "<ul><li>Node.js</li><li>Postgres</li></ul>"
    );
  });

  it("strips <script> tags and their content entirely", () => {
    const out = sanitizeRichText('<p>Hi</p><script>alert(document.cookie)</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(document.cookie)");
  });

  it("strips inline event handler attributes from otherwise-allowed tags", () => {
    const out = sanitizeRichText('<p onclick="alert(1)">click me</p>');
    expect(out).not.toContain("onclick");
    expect(out).toContain("click me");
  });

  it("strips img/onerror payloads", () => {
    const out = sanitizeRichText('<img src=x onerror="alert(1)">');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<img");
  });

  // Regression test for the 2026-09-14 audit finding: the previous
  // regex-based sanitizer required literal whitespace before an attribute
  // list to recognize something as a tag at all. Real HTML tokenizers treat
  // `/` as an attribute separator exactly like whitespace, so this exact
  // payload matched nothing in the old regex and passed through completely
  // unmodified, while still executing as a live onload handler in every
  // browser.
  it("strips the slash-separated attribute bypass (<svg/onload=...>)", () => {
    const out = sanitizeRichText("<svg/onload=alert(1)>");
    expect(out).not.toContain("onload");
    expect(out).not.toContain("<svg");
  });

  it("strips javascript: URLs even on tags that would otherwise be dropped", () => {
    const out = sanitizeRichText('<a href="javascript:alert(1)">link</a>');
    expect(out).not.toContain("javascript:");
  });

  it("handles malformed/unclosed tags without throwing", () => {
    expect(() => sanitizeRichText("<p>unclosed <b>bold")).not.toThrow();
    expect(() => sanitizeRichText("<<script>>alert(1)<</script>>")).not.toThrow();
  });

  it("drops HTML comments", () => {
    const out = sanitizeRichText("<!-- <script>alert(1)</script> -->visible");
    expect(out).not.toContain("<script");
    expect(out).toContain("visible");
  });
});
