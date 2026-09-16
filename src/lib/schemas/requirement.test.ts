import { describe, it, expect } from "vitest";
import { requirementSchema } from "./requirement";

// A minimal valid payload — every test below mutates one field off this
// baseline, so a failure always isolates to the field under test rather
// than an unrelated missing-field error.
function validPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    jobTitle: "Senior Engineer",
    clientName: "Acme Corp",
    status: "Open",
    priority: 3,
    employmentType: "W2",
    duration: "6 months",
    visa: undefined,
    workLocation: "Remote-friendly HQ",
    country: "Canada",
    isRemote: false,
    billRate: "85",
    billRateCurrency: "USD",
    payRate: 60,
    payRateCurrency: "USD",
    mandatorySkills: "React, Node",
    jobDescription: "Build things.",
    accountManagerRaw: undefined,
    screeningQuestions: undefined,
    ...overrides,
  };
}

describe("[integration] requirementSchema — happy path", () => {
  it("accepts a fully valid payload", () => {
    const result = requirementSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("accepts Remote with no workLocation", () => {
    const result = requirementSchema.safeParse(
      validPayload({ isRemote: true, workLocation: undefined })
    );
    expect(result.success).toBe(true);
  });
});

describe("[negative] requirementSchema — rejected inputs", () => {
  it("rejects a missing job title", () => {
    const result = requirementSchema.safeParse(validPayload({ jobTitle: "" }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative bill rate", () => {
    const result = requirementSchema.safeParse(validPayload({ billRate: "-5" }));
    expect(result.success).toBe(false);
  });

  it("rejects a negative pay rate", () => {
    const result = requirementSchema.safeParse(validPayload({ payRate: -1 }));
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric bill rate", () => {
    const result = requirementSchema.safeParse(validPayload({ billRate: "abc" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported currency", () => {
    const result = requirementSchema.safeParse(validPayload({ billRateCurrency: "XYZ" }));
    expect(result.success).toBe(false);
  });

  it("rejects a status outside REQUIREMENT_STATUSES", () => {
    const result = requirementSchema.safeParse(validPayload({ status: "Vaporized" }));
    expect(result.success).toBe(false);
  });

  // The conditional rules — mirrors the original GAS form's
  // reqSaveRequirement validation exactly.
  it("requires visa when country includes USA", () => {
    const result = requirementSchema.safeParse(
      validPayload({ country: "USA", visa: undefined })
    );
    expect(result.success).toBe(false);
  });

  it("accepts a USA role once visa is supplied", () => {
    const result = requirementSchema.safeParse(validPayload({ country: "USA", visa: "H1B" }));
    expect(result.success).toBe(true);
  });

  it("does not require visa for a non-USA country", () => {
    const result = requirementSchema.safeParse(
      validPayload({ country: "Canada", visa: undefined })
    );
    expect(result.success).toBe(true);
  });

  it("requires work location unless remote", () => {
    const result = requirementSchema.safeParse(
      validPayload({ isRemote: false, workLocation: undefined })
    );
    expect(result.success).toBe(false);
  });
});

describe("[range] requirementSchema — boundary values", () => {
  it("accepts priority 0 (the lower bound)", () => {
    expect(requirementSchema.safeParse(validPayload({ priority: 0 })).success).toBe(true);
  });

  it("accepts priority 5 (the upper bound)", () => {
    expect(requirementSchema.safeParse(validPayload({ priority: 5 })).success).toBe(true);
  });

  it("rejects priority -1 (just below the lower bound)", () => {
    expect(requirementSchema.safeParse(validPayload({ priority: -1 })).success).toBe(false);
  });

  it("rejects priority 6 (just above the upper bound)", () => {
    expect(requirementSchema.safeParse(validPayload({ priority: 6 })).success).toBe(false);
  });

  it("rejects a non-integer priority", () => {
    expect(requirementSchema.safeParse(validPayload({ priority: 2.5 })).success).toBe(false);
  });

  it("accepts a zero bill rate (0 is a valid rate, not \"unset\")", () => {
    expect(requirementSchema.safeParse(validPayload({ billRate: "0" })).success).toBe(true);
  });

  it("accepts a job title at exactly the 200-character limit", () => {
    const result = requirementSchema.safeParse(validPayload({ jobTitle: "A".repeat(200) }));
    expect(result.success).toBe(true);
  });

  it("rejects a job title one character over the 200-character limit", () => {
    const result = requirementSchema.safeParse(validPayload({ jobTitle: "A".repeat(201) }));
    expect(result.success).toBe(false);
  });

  it("rejects a job description over the 20,000-character limit", () => {
    const result = requirementSchema.safeParse(
      validPayload({ jobDescription: "A".repeat(20001) })
    );
    expect(result.success).toBe(false);
  });
});
