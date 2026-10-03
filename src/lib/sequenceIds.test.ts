import { describe, expect, it } from "vitest";
import { isUniqueConstraintError, nextSequenceId } from "./sequenceIds";

describe("nextSequenceId", () => {
  it("starts at 0001 when nothing exists", () => {
    expect(nextSequenceId("SUB", [])).toBe("SUB-0001");
  });

  it("uses the max, not the count — so gaps never cause a collision", () => {
    // e.g. PLC-0002 was un-assigned when its submission was rejected: a
    // count of 2 would hand out PLC-0003 again.
    expect(nextSequenceId("PLC", ["PLC-0001", "PLC-0003"])).toBe("PLC-0004");
  });

  it("ignores nulls and IDs in other formats", () => {
    expect(nextSequenceId("SUB", [null, "SUB-0007", "legacy-12", "SUB-abc", "PLC-0099"])).toBe("SUB-0008");
  });

  it("keeps counting past 9999", () => {
    expect(nextSequenceId("SUB", ["SUB-9999"])).toBe("SUB-10000");
    expect(nextSequenceId("SUB", ["SUB-10000", "SUB-9999"])).toBe("SUB-10001");
  });
});

describe("isUniqueConstraintError", () => {
  it("recognizes Prisma's P2002", () => {
    expect(isUniqueConstraintError(Object.assign(new Error("x"), { code: "P2002" }))).toBe(true);
    expect(isUniqueConstraintError(new Error("Unique constraint failed on the fields"))).toBe(true);
    expect(isUniqueConstraintError(new Error("Foreign key constraint failed"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
