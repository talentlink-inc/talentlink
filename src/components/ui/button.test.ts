import { describe, expect, it } from "vitest";
import { buttonClass } from "./button";

describe("buttonClass", () => {
  it("[unit] defaults to a medium primary button in the brand colour", () => {
    const c = buttonClass();
    expect(c).toContain("bg-brand");
    expect(c).toContain("px-3.5 py-2 text-sm");
  });

  it("[unit] every variant keeps the shared focus ring and disabled styling", () => {
    for (const v of ["primary", "secondary", "danger", "dangerSoft", "subtle", "onDark"] as const) {
      const c = buttonClass(v);
      expect(c).toContain("focus-visible:outline-brand");
      expect(c).toContain("disabled:opacity-50");
    }
  });

  it("[unit] dangerSoft is an outlined red button, not a filled one", () => {
    const c = buttonClass("dangerSoft");
    expect(c).toContain("border-red-300");
    expect(c).not.toContain("bg-red-600");
  });

  it("[unit] appends extra classes and the small size", () => {
    expect(buttonClass("secondary", "sm", "ml-auto")).toMatch(/px-2\.5 py-1 text-xs ml-auto$/);
  });
});
