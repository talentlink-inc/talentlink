import { describe, it, expect } from "vitest";
import { rowSelectClass } from "./tableRow";

describe("[unit] rowSelectClass", () => {
  it("includes the low-contrast brand highlight when selected", () => {
    expect(rowSelectClass(true)).toContain("bg-brand-soft");
  });

  it("does not include the highlight when not selected", () => {
    expect(rowSelectClass(false)).not.toContain("bg-brand-soft");
  });
});
