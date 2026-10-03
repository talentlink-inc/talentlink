import { describe, expect, it } from "vitest";
import { isValidTimeZone, utcToZonedLocal, zonedLocalToUtc } from "./timezone";

describe("zonedLocalToUtc", () => {
  it("reads the wall-clock time in the given zone, not the server's", () => {
    // EDT is UTC-4 in October.
    expect(zonedLocalToUtc("2026-10-02T10:00", "America/New_York")?.toISOString()).toBe("2026-10-02T14:00:00.000Z");
    expect(zonedLocalToUtc("2026-10-02T10:00", "Asia/Kolkata")?.toISOString()).toBe("2026-10-02T04:30:00.000Z");
    expect(zonedLocalToUtc("2026-10-02T10:00", "UTC")?.toISOString()).toBe("2026-10-02T10:00:00.000Z");
  });

  it("handles both sides of a DST change", () => {
    // EST (UTC-5) in January, EDT (UTC-4) in July.
    expect(zonedLocalToUtc("2026-01-15T09:30", "America/New_York")?.toISOString()).toBe("2026-01-15T14:30:00.000Z");
    expect(zonedLocalToUtc("2026-07-15T09:30", "America/New_York")?.toISOString()).toBe("2026-07-15T13:30:00.000Z");
    // US DST starts 2026-03-08 at 2:00 AM; 3:30 AM that day is already EDT.
    expect(zonedLocalToUtc("2026-03-08T03:30", "America/New_York")?.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(zonedLocalToUtc("", "UTC")).toBeNull();
    expect(zonedLocalToUtc("not a date", "UTC")).toBeNull();
  });
});

describe("utcToZonedLocal", () => {
  it("round-trips with zonedLocalToUtc so re-saving an edit never drifts", () => {
    for (const tz of ["America/New_York", "Asia/Kolkata", "Europe/London", "UTC"]) {
      const instant = zonedLocalToUtc("2026-10-02T10:00", tz)!;
      expect(utcToZonedLocal(instant, tz)).toBe("2026-10-02T10:00");
    }
  });

  it("renders midnight as 00, not 24", () => {
    expect(utcToZonedLocal(new Date("2026-10-02T00:05:00Z"), "UTC")).toBe("2026-10-02T00:05");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zones and rejects free text", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Eastern time-ish")).toBe(false);
  });
});
