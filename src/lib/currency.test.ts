import { describe, it, expect } from "vitest";
import { SUPPORTED_CURRENCIES, REGION_DEFAULT_CURRENCY, defaultCurrencyForRegions } from "./currency";
import { SUPPORTED_REGIONS } from "./regions";

describe("[unit] currency", () => {
  it("defaults USA to USD", () => {
    expect(defaultCurrencyForRegions("USA")).toBe("USD");
  });

  it("defaults India to INR", () => {
    expect(defaultCurrencyForRegions("India")).toBe("INR");
  });

  it("defaults UK to GBP", () => {
    expect(defaultCurrencyForRegions("UK")).toBe("GBP");
  });

  it("picks the first region when multiple are given (first wins)", () => {
    expect(defaultCurrencyForRegions("UK, India")).toBe("GBP");
    expect(defaultCurrencyForRegions("India, UK")).toBe("INR");
  });

  it("[negative] falls back to USD for an unknown region string", () => {
    expect(defaultCurrencyForRegions("Narnia")).toBe("USD");
  });

  it("[range] falls back to USD for empty, null, or undefined input", () => {
    expect(defaultCurrencyForRegions("")).toBe("USD");
    expect(defaultCurrencyForRegions(null)).toBe("USD");
    expect(defaultCurrencyForRegions(undefined)).toBe("USD");
  });

  // [interoperability] regions.ts <-> currency.ts contract: every canonical
  // region needs an EXPLICIT entry in REGION_DEFAULT_CURRENCY, not just a
  // currency that happens to come out the other end — checking only the
  // output of defaultCurrencyForRegions() would trivially pass even for an
  // unmapped region, since USD is also its final fallback.
  it("[interoperability] has an explicit REGION_DEFAULT_CURRENCY entry for every SUPPORTED_REGION", () => {
    for (const region of SUPPORTED_REGIONS) {
      expect(REGION_DEFAULT_CURRENCY).toHaveProperty(region);
      expect(SUPPORTED_CURRENCIES).toContain(REGION_DEFAULT_CURRENCY[region]);
    }
  });

  it("[interoperability] never maps a region to a currency outside SUPPORTED_CURRENCIES", () => {
    for (const currency of Object.values(REGION_DEFAULT_CURRENCY)) {
      expect(SUPPORTED_CURRENCIES).toContain(currency);
    }
  });
});
