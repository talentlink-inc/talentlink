import { describe, it, expect } from "vitest";
import { candidateSchema } from "./submission";

function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    requirementId: "req-1",
    candidateName: "Jane Doe",
    email: "jane@example.com",
    phone: "+1 (555) 123-4567",
    country: "USA",
    currentLocation: "Austin, TX",
    totalExperienceYears: "5",
    visaStatus: "H1B",
    linkedinUrl: undefined,
    employmentType: "W2",
    roleWithSkills: "Senior Engineer - React, Node",
    billRate: 90,
    billRateCurrency: "USD",
    payRate: "70",
    payRateCurrency: "USD",
    ...overrides,
  };
}

describe("[integration] candidateSchema — happy path", () => {
  it("accepts a fully valid payload", () => {
    expect(candidateSchema.safeParse(validPayload()).success).toBe(true);
  });

  it("accepts a payload with no resume-adjacent optional fields", () => {
    const result = candidateSchema.safeParse(
      validPayload({ billRate: null, billRateCurrency: undefined, linkedinUrl: undefined })
    );
    expect(result.success).toBe(true);
  });
});

describe("[negative] candidateSchema — rejected inputs", () => {
  it("rejects a missing requirement selection", () => {
    expect(candidateSchema.safeParse(validPayload({ requirementId: "" })).success).toBe(false);
  });

  it("rejects a missing email", () => {
    expect(candidateSchema.safeParse(validPayload({ email: "" })).success).toBe(false);
  });

  it("rejects a phone number containing letters", () => {
    expect(candidateSchema.safeParse(validPayload({ phone: "555-CALL-NOW" })).success).toBe(false);
  });

  it("accepts phone numbers with digits, spaces, +, -, ( )", () => {
    expect(candidateSchema.safeParse(validPayload({ phone: "+44 20 7946 0958" })).success).toBe(true);
  });

  it("rejects a negative total experience", () => {
    expect(
      candidateSchema.safeParse(validPayload({ totalExperienceYears: "-2" })).success
    ).toBe(false);
  });

  it("rejects a negative pay rate", () => {
    expect(candidateSchema.safeParse(validPayload({ payRate: "-1" })).success).toBe(false);
  });

  it("rejects a negative bill rate when one is supplied", () => {
    expect(candidateSchema.safeParse(validPayload({ billRate: -10 })).success).toBe(false);
  });

  it("rejects a malformed LinkedIn URL", () => {
    expect(
      candidateSchema.safeParse(validPayload({ linkedinUrl: "https://example.com/jane" })).success
    ).toBe(false);
  });

  it("accepts a well-formed LinkedIn URL", () => {
    expect(
      candidateSchema.safeParse(validPayload({ linkedinUrl: "https://www.linkedin.com/in/janedoe" }))
        .success
    ).toBe(true);
  });

  it("rejects an unsupported currency", () => {
    expect(candidateSchema.safeParse(validPayload({ payRateCurrency: "ZZZ" })).success).toBe(false);
  });
});

describe("[range] candidateSchema — boundary values", () => {
  it("accepts zero total experience (fresh graduate, not \"missing\")", () => {
    expect(
      candidateSchema.safeParse(validPayload({ totalExperienceYears: "0" })).success
    ).toBe(true);
  });

  it("accepts a zero pay rate", () => {
    expect(candidateSchema.safeParse(validPayload({ payRate: "0" })).success).toBe(true);
  });

  it("rejects a non-numeric total experience", () => {
    expect(
      candidateSchema.safeParse(validPayload({ totalExperienceYears: "many" })).success
    ).toBe(false);
  });

  it("rejects a missing pay rate (required, unlike bill rate)", () => {
    expect(candidateSchema.safeParse(validPayload({ payRate: "" })).success).toBe(false);
  });
});
