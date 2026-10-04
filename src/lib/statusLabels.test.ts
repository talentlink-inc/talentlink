import { describe, expect, it } from "vitest";
import { statusLabel, statusTone } from "./statusLabels";
import { INTERVIEW_MODES, INTERVIEW_STATUSES, INTERVIEW_TYPES, REJECTED_STATUSES, REQUIREMENT_STATUSES, SUBMISSION_STATUSES } from "./recruitment";
import { BENCH_CONSULTANT_STATUSES, BENCH_HOTLIST_STATUSES } from "./bench";

describe("[module] status labels", () => {
  it("gives every submission and interview status a readable label (no underscores)", () => {
    for (const s of [...SUBMISSION_STATUSES, ...INTERVIEW_STATUSES]) {
      expect(statusLabel(s)).not.toContain("_");
    }
  });

  it("fixes GAS's 'Vender' spelling on screen only", () => {
    expect(statusLabel("Vender_Submission")).toBe("Vendor submission");
    expect(statusLabel("Vender_Reject")).toBe("Vendor rejected");
  });

  it("falls back gracefully for unknown or empty values", () => {
    expect(statusLabel("Some_New_Status")).toBe("Some New Status");
    expect(statusLabel(null)).toBe("—");
  });
});

describe("[module] status tones", () => {
  it("every reject status reads as closed, placements as placed", () => {
    for (const s of REJECTED_STATUSES) expect(statusTone(s)).toBe("closed");
    expect(statusTone("Started_Billable")).toBe("placed");
    expect(statusTone("Onboarding")).toBe("placed");
  });

  it("covers every bench consultant status explicitly", () => {
    for (const s of BENCH_CONSULTANT_STATUSES) expect(statusTone(s)).not.toBe("closed");
  });

  it("non-pipeline statuses (requirements, hotlist, user accounts) never show as red", () => {
    for (const s of [...REQUIREMENT_STATUSES, ...BENCH_HOTLIST_STATUSES, "active", "inactive"]) {
      expect(statusTone(s)).not.toBe("closed");
    }
    expect(statusLabel("active")).toBe("Active");
  });

  it("interview rounds and modes read in plain English", () => {
    for (const s of [...INTERVIEW_TYPES, ...INTERVIEW_MODES]) expect(statusLabel(s)).not.toContain("_");
    expect(statusLabel("in_person")).toBe("In person");
  });
});
