import { describe, it, expect } from "vitest";
import {
  QUALIFYING_PLACEMENT_STATUSES,
  REJECTED_STATUSES,
  SUBMISSION_STATUSES,
  REQUIREMENT_STATUSES,
  VISA_STATUSES,
  REQUIREMENT_EMPLOYMENT_TYPES,
  SUBMISSION_EMPLOYMENT_TYPES,
  isQualifyingPlacementStatus,
  isRejectedStatus,
  shouldClearPlacementId,
  parseEmploymentTypes,
  toggleEmploymentType,
} from "./recruitment";

describe("[unit] isQualifyingPlacementStatus / isRejectedStatus", () => {
  it("recognizes every qualifying status", () => {
    for (const s of QUALIFYING_PLACEMENT_STATUSES) expect(isQualifyingPlacementStatus(s)).toBe(true);
  });

  it("recognizes every rejected status", () => {
    for (const s of REJECTED_STATUSES) expect(isRejectedStatus(s)).toBe(true);
  });

  // The two sets must never overlap — a status can't be both a placement
  // win and a rejection, or shouldClearPlacementId's branching (below)
  // silently breaks.
  it("[negative] has no status that is both qualifying and rejected", () => {
    const overlap = QUALIFYING_PLACEMENT_STATUSES.filter((s) =>
      (REJECTED_STATUSES as readonly string[]).includes(s)
    );
    expect(overlap).toEqual([]);
  });

  it("returns false for an unrecognized status", () => {
    expect(isQualifyingPlacementStatus("Not_A_Real_Status")).toBe(false);
    expect(isRejectedStatus("Not_A_Real_Status")).toBe(false);
  });
});

// [unit] placement lifecycle — a durable PlacementID is kept through a later
// reject ("fell through") but wiped on any regression back into the
// ordinary, non-qualifying/non-rejected pipeline.
describe("[unit] shouldClearPlacementId", () => {
  it("never clears when there was no placement id to begin with", () => {
    expect(shouldClearPlacementId("New_Resume", false)).toBe(false);
    expect(shouldClearPlacementId(QUALIFYING_PLACEMENT_STATUSES[0], false)).toBe(false);
  });

  it("keeps the placement id moving between qualifying statuses", () => {
    expect(shouldClearPlacementId("Onboarding", true)).toBe(false);
  });

  it("keeps the placement id on a later reject (fell through)", () => {
    expect(shouldClearPlacementId(REJECTED_STATUSES[0], true)).toBe(false);
  });

  it("[negative] clears the placement id on a regression to an ordinary pipeline status", () => {
    expect(shouldClearPlacementId("New_Resume", true)).toBe(true);
  });
});

describe("[unit] parseEmploymentTypes / toggleEmploymentType", () => {
  it("parses a comma-joined csv into a trimmed list", () => {
    expect(parseEmploymentTypes("W2, C2C")).toEqual(["W2", "C2C"]);
  });

  it("[range] returns an empty array for empty, null, or undefined", () => {
    expect(parseEmploymentTypes("")).toEqual([]);
    expect(parseEmploymentTypes(null)).toEqual([]);
    expect(parseEmploymentTypes(undefined)).toEqual([]);
  });

  it("toggle adds when absent, removes when present", () => {
    expect(toggleEmploymentType("W2", "C2C")).toBe("W2, C2C");
    expect(toggleEmploymentType("W2, C2C", "W2")).toBe("C2C");
  });
});

// [module] cross-cutting shape checks for every option list this module
// exports — catches an accidental duplicate/typo entry anywhere in the
// module without needing one test per constant.
describe("[module] recruitment option lists", () => {
  const lists: [string, readonly (string | { value: string })[]][] = [
    ["QUALIFYING_PLACEMENT_STATUSES", QUALIFYING_PLACEMENT_STATUSES],
    ["REJECTED_STATUSES", REJECTED_STATUSES],
    ["SUBMISSION_STATUSES", SUBMISSION_STATUSES],
    ["REQUIREMENT_STATUSES", REQUIREMENT_STATUSES],
    ["VISA_STATUSES", VISA_STATUSES],
  ];

  it.each(lists)("%s has no duplicate values", (_name, list) => {
    const values = list.map((item) => (typeof item === "string" ? item : item.value));
    expect(new Set(values).size).toBe(values.length);
  });

  it("VISA_STATUSES includes H4-EAD (GAS parity item #9)", () => {
    expect(VISA_STATUSES).toContain("H4-EAD");
  });

  it("SUBMISSION_EMPLOYMENT_TYPES is REQUIREMENT_EMPLOYMENT_TYPES plus Others-Referral", () => {
    expect(SUBMISSION_EMPLOYMENT_TYPES.length).toBe(REQUIREMENT_EMPLOYMENT_TYPES.length + 1);
    expect(SUBMISSION_EMPLOYMENT_TYPES.map((t) => t.value)).toEqual(
      expect.arrayContaining(REQUIREMENT_EMPLOYMENT_TYPES.map((t) => t.value))
    );
    expect(SUBMISSION_EMPLOYMENT_TYPES.at(-1)?.value).toBe("Others-Referral");
  });
});
