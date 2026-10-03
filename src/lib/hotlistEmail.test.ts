import { describe, expect, it } from "vitest";
import { buildHotlistEmailHtml, buildHotlistText, escapeHtml, type HotlistConsultant } from "./hotlistEmail";

const jane: HotlistConsultant = {
  consultantName: "Jane Doe",
  role: "Java Developer",
  technologySkills: "Java, Spring",
  visaStatus: "H1B",
  relocation: "Yes",
  experience: "8 Years",
  location: "Dallas, TX",
  availability: "Immediate",
};
const date = new Date("2026-10-03T12:00:00Z");

describe("buildHotlistEmailHtml", () => {
  it("lists every consultant with GAS's columns and a count", () => {
    const html = buildHotlistEmailHtml("Digital Links Inc", [jane, { ...jane, consultantName: "John Roe" }], date);
    expect(html).toContain("Jane Doe");
    expect(html).toContain("John Roe");
    expect(html).toContain("2 consultant(s)");
    for (const col of ["Name", "Role", "Skills", "Visa", "Relocation", "Exp", "Location", "Availability"]) {
      expect(html).toContain(`>${col}</th>`);
    }
  });

  it("escapes consultant and company text (GAS didn't)", () => {
    const html = buildHotlistEmailHtml("A&B <Co>", [{ ...jane, technologySkills: '<img src=x onerror="x">C# & .NET' }], date);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=&quot;x&quot;&gt;C# &amp; .NET");
    expect(html).toContain("A&amp;B &lt;Co&gt;");
  });
});

describe("buildHotlistText / escapeHtml", () => {
  it("produces a readable plain-text fallback", () => {
    expect(buildHotlistText("Digital Links Inc", [jane], date)).toContain("Name: Jane Doe | Role: Java Developer");
  });
  it("escapes all five HTML-significant characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
