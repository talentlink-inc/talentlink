import { describe, it, expect } from "vitest";
import {
  SUPPORTED_REGIONS,
  parseRegionsCsv,
  sanitizeRegionsCsv,
  toggleRegion,
  userCanSeeRegions,
} from "./regions";

describe("[unit] parseRegionsCsv", () => {
  it("splits, trims, and drops empty tokens", () => {
    expect(parseRegionsCsv("USA, India,  UK ")).toEqual(["USA", "India", "UK"]);
    expect(parseRegionsCsv("USA,,India")).toEqual(["USA", "India"]);
  });

  it("[range] returns an empty array for empty, null, or undefined input", () => {
    expect(parseRegionsCsv("")).toEqual([]);
    expect(parseRegionsCsv(null)).toEqual([]);
    expect(parseRegionsCsv(undefined)).toEqual([]);
  });
});

describe("[unit] [negative] sanitizeRegionsCsv", () => {
  it("keeps only canonical region names, case-insensitively", () => {
    expect(sanitizeRegionsCsv("usa, INDIA")).toBe("USA, India");
  });

  it("drops unknown tokens instead of throwing or keeping them", () => {
    expect(sanitizeRegionsCsv("USA, Narnia, Atlantis")).toBe("USA");
  });

  it("de-duplicates repeated regions", () => {
    expect(sanitizeRegionsCsv("USA, USA, usa")).toBe("USA");
  });

  it("returns an empty string for garbage-only input", () => {
    expect(sanitizeRegionsCsv("Narnia, Atlantis")).toBe("");
  });
});

describe("[unit] toggleRegion", () => {
  it("adds a region not already present", () => {
    expect(toggleRegion("USA", "India")).toBe("USA, India");
  });

  it("removes a region already present", () => {
    expect(toggleRegion("USA, India", "USA")).toBe("India");
  });

  it("starting from empty adds the region", () => {
    expect(toggleRegion("", "USA")).toBe("USA");
  });
});

// [security] data-visibility scoping — a bug here either leaks a recruiter
// data they shouldn't see, or wrongly blocks them from their own region.
describe("[unit] [security] userCanSeeRegions", () => {
  it("an unrestricted user (no regions set) sees everything", () => {
    expect(userCanSeeRegions("", "USA")).toBe(true);
    expect(userCanSeeRegions(null, "India")).toBe(true);
    expect(userCanSeeRegions(undefined, undefined)).toBe(true);
  });

  it("a requirement with no region set is visible to everyone", () => {
    expect(userCanSeeRegions("USA", "")).toBe(true);
    expect(userCanSeeRegions("USA", null)).toBe(true);
  });

  it("allows when the user's regions overlap the target's", () => {
    expect(userCanSeeRegions("USA, India", "India")).toBe(true);
    expect(userCanSeeRegions("USA", "USA, UK")).toBe(true);
  });

  // [negative] the actual access-control boundary
  it("denies when there is no overlap at all", () => {
    expect(userCanSeeRegions("USA", "India")).toBe(false);
    expect(userCanSeeRegions("USA, Canada", "India, UK")).toBe(false);
  });

  it("SUPPORTED_REGIONS has no duplicate entries", () => {
    expect(new Set(SUPPORTED_REGIONS).size).toBe(SUPPORTED_REGIONS.length);
  });
});
