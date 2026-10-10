import { describe, expect, it } from "vitest";
import { deriveCountry, parseRepositoryQuery, resumeAge } from "./repository";

describe("[unit] repository country (GAS _rdbDeriveCountry)", () => {
  it.each([
    ["Hyderabad, Telangana", "India"],
    ["Bengaluru", "India"],
    ["Toronto, ON", "Canada"],
    ["London", "UK"],
    ["Dallas, TX", "USA"],
    ["New Jersey", "USA"],
    ["Remote - United States", "USA"],
    ["Berlin, Germany", "Other"],
    ["", "Other"],
  ])("%s → %s", (loc, country) => {
    expect(deriveCountry(loc)).toBe(country);
  });
});

describe("[security] repository filter params", () => {
  it("keeps known values and drops anything else", () => {
    expect(parseRepositoryQuery({ q: " java ", visa: "H1B", exp: "6-10", country: "India", sort: "name-asc", page: "3" })).toEqual({
      q: "java",
      visa: "H1B",
      exp: "6-10",
      country: "India",
      sort: "name-asc",
      page: 3,
    });
    expect(parseRepositoryQuery({ visa: "'; drop", exp: "1-1000", country: "Mars", sort: "evil", page: "-5" })).toEqual({
      q: "",
      visa: "",
      exp: "",
      country: "",
      sort: "added-desc",
      page: 1,
    });
  });

  it("caps the search text length and the page number", () => {
    const q = parseRepositoryQuery({ q: "x".repeat(500), page: "99999999" });
    expect(q.q).toHaveLength(100);
    expect(q.page).toBe(10_000);
  });
});

describe("[unit] resume age", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it.each([
    ["2026-10-10T08:00:00Z", "today"],
    ["2026-10-07T12:00:00Z", "3d"],
    ["2026-09-12T12:00:00Z", "4w"],
    ["2026-06-10T12:00:00Z", "4mo"],
    ["2023-10-01T12:00:00Z", "3y"],
  ])("%s → %s", (d, age) => {
    expect(resumeAge(d, now)).toBe(age);
  });
});
