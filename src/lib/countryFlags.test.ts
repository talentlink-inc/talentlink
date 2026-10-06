import { describe, expect, it } from "vitest";
import { countryFlags } from "./countryFlags";

describe("[unit] requirement country flags", () => {
  it("shows up to two flags, without repeats", () => {
    expect(countryFlags("USA")).toBe("🇺🇸");
    expect(countryFlags("USA, India, UK")).toBe("🇺🇸🇮🇳");
    expect(countryFlags("Mexico, South America")).toBe("🇲🇽🌎");
  });
  it("is empty when no region is set", () => {
    expect(countryFlags(null)).toBe("");
    expect(countryFlags("")).toBe("");
  });
});
