import { describe, expect, it } from "vitest";
import { statusLabel, statusTone } from "./statusLabels";
import { INTERVIEW_STATUSES, REJECTED_STATUSES, SUBMISSION_STATUSES } from "./recruitment";
import { BENCH_CONSULTANT_STATUSES } from "./bench";

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
});
