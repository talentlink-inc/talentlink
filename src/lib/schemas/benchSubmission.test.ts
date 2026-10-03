import { describe, expect, it } from "vitest";
import { benchSubmissionSchema, normalizeCompany } from "./benchSubmission";

const valid = { benchConsultantId: "c1", companyName: "Acme Corp", status: "Vender_Submission" };

describe("benchSubmissionSchema", () => {
  it("requires a consultant and a company (GAS addBenchSubmission)", () => {
    expect(benchSubmissionSchema().safeParse(valid).success).toBe(true);
    expect(benchSubmissionSchema().safeParse({ ...valid, benchConsultantId: "" }).success).toBe(false);
    expect(benchSubmissionSchema().safeParse({ ...valid, companyName: "  " }).success).toBe(false);
  });

  it("requires a valid reject reason on reject statuses", () => {
    expect(benchSubmissionSchema().safeParse({ ...valid, status: "Client_Reject" }).success).toBe(false);
    expect(benchSubmissionSchema().safeParse({ ...valid, status: "Client_Reject", rejectReason: "Made_Up" }).success).toBe(false);
    expect(benchSubmissionSchema().safeParse({ ...valid, status: "Client_Reject", rejectReason: "Not_Selected" }).success).toBe(true);
  });

  it("rejects unknown statuses but keeps a record's legacy status valid", () => {
    expect(benchSubmissionSchema().safeParse({ ...valid, status: "Submitted" }).success).toBe(false);
    expect(benchSubmissionSchema("Submitted").safeParse({ ...valid, status: "Submitted" }).success).toBe(true);
  });

  it("validates an optional contact email", () => {
    expect(benchSubmissionSchema().safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(benchSubmissionSchema().safeParse({ ...valid, email: "" }).success).toBe(true);
    expect(benchSubmissionSchema().safeParse({ ...valid, email: "a@b.com" }).success).toBe(true);
  });
});

describe("normalizeCompany", () => {
  it("matches GAS's case-insensitive, trimmed duplicate check", () => {
    expect(normalizeCompany("  ACME   Corp ")).toBe(normalizeCompany("acme corp"));
  });
});
