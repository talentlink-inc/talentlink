import { describe, expect, it } from "vitest";
import { maskEmail, maskEmailsInText } from "./maskEmail";

describe("maskEmail", () => {
  it("hides the person, keeps the company domain", () => {
    expect(maskEmail("john.smith@acme.com")).toBe("xxxx@acme.com");
    expect(maskEmail(" J.Doe+vendor@Sub.Example.CO.UK ")).toBe("xxxx@sub.example.co.uk");
  });

  it("returns null for blank input", () => {
    expect(maskEmail("")).toBeNull();
    expect(maskEmail("   ")).toBeNull();
    expect(maskEmail(null)).toBeNull();
  });

  it("masks every address in a multi-address field", () => {
    expect(maskEmail("a@x.com; b.c@y.org")).toBe("xxxx@x.com; xxxx@y.org");
  });
});

describe("maskEmailsInText", () => {
  it("masks emails inside free text and leaves the rest alone", () => {
    expect(maskEmailsInText("Spoke to raj@vendor.io, follow up Monday")).toBe("Spoke to xxxx@vendor.io, follow up Monday");
    expect(maskEmailsInText("No emails here — call 555-0100")).toBe("No emails here — call 555-0100");
  });
});
