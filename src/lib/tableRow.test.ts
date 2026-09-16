import { describe, it, expect } from "vitest";
import { rowSelectClass } from "./tableRow";

describe("[unit] rowSelectClass", () => {
  it("includes the low-contrast blue highlight when selected", () => {
    expect(rowSelectClass(true)).toContain("bg-blue-50");
  });

  it("does not include the highlight when not selected", () => {
    expect(rowSelectClass(false)).not.toContain("bg-blue-50");
  });
});
