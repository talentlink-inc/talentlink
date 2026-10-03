import { describe, expect, it } from "vitest";
import { redactCandidateContact, serializeSubmission } from "./types";

// [security] Contact data has to be stripped before it reaches the browser —
// the UI's "Restricted" label alone left it readable in the page payload.

const row = {
  candidate: { email: "jane@example.com", phone: "+1 555 0100", linkedinUrl: "https://linkedin.com/in/jane" },
};

describe("redactCandidateContact", () => {
  it("leaves everything when the user can see both", () => {
    expect(redactCandidateContact(row, { canViewEmail: true, canViewPhone: true })).toEqual(row);
  });

  it("strips only what the user can't see", () => {
    const noEmail = redactCandidateContact(row, { canViewEmail: false, canViewPhone: true });
    expect(noEmail.candidate).toMatchObject({ email: null, phone: "+1 555 0100" });
    const noPhone = redactCandidateContact(row, { canViewEmail: true, canViewPhone: false });
    expect(noPhone.candidate).toMatchObject({ email: "jane@example.com", phone: null });
  });

  it("strips an email that was imported into the LinkedIn field", () => {
    const legacy = { candidate: { ...row.candidate, linkedinUrl: "jane@example.com" } };
    expect(redactCandidateContact(legacy, { canViewEmail: false, canViewPhone: true }).candidate.linkedinUrl).toBeNull();
    // A real LinkedIn URL isn't contact data — it stays.
    expect(redactCandidateContact(row, { canViewEmail: false, canViewPhone: false }).candidate.linkedinUrl).toBe(
      "https://linkedin.com/in/jane"
    );
  });
});

describe("serializeSubmission", () => {
  const submission = {
    billRate: null,
    payRate: null,
    commission: null,
    candidate: { name: "Jane", identityHash: "abc123", totalExperienceYears: null },
    requirement: {
      id: "r1",
      jobId: "JOB-0001",
      jobTitle: "Dev",
      clientName: "Acme",
      status: "Open",
      jobDescription: "<p>long HTML</p>",
    },
    resume: null,
  } as unknown as Parameters<typeof serializeSubmission>[0];

  it("never sends the candidate identity hash (brute-forceable back to a phone number)", () => {
    expect(serializeSubmission(submission).candidate).not.toHaveProperty("identityHash");
  });

  it("embeds only the requirement summary, not the full record", () => {
    expect(serializeSubmission(submission).requirement).toEqual({
      id: "r1",
      jobId: "JOB-0001",
      jobTitle: "Dev",
      clientName: "Acme",
      status: "Open",
    });
  });
});
