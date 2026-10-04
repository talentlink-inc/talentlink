import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

describe("format", () => {
  it("dates read 'Jul 13, 2026' with no day/month ambiguity, and don't shift by timezone", () => {
    expect(formatDate("2026-07-13T00:00:00.000Z")).toBe("Jul 13, 2026");
    expect(formatDate(new Date("2026-01-02T23:30:00.000Z"))).toBe("Jan 2, 2026");
  });

  it("date-times render in the given zone, falling back to UTC for an invalid one", () => {
    expect(formatDateTime("2026-12-15T15:00:00.000Z", "America/New_York")).toBe("Dec 15, 2026, 10:00 AM");
    expect(formatDateTime("2026-12-15T15:00:00.000Z", "Not/AZone")).toBe("Dec 15, 2026, 3:00 PM");
  });
});
