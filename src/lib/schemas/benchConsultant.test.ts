import { describe, expect, it } from "vitest";
import { benchConsultantSchema, titleCaseName } from "./benchConsultant";

const valid = {
  consultantName: "Jane Doe",
  role: "Java Developer",
  technologySkills: "Java, Spring",
  visaStatus: "H1B",
  experience: "8 Years",
  location: "Dallas, TX",
  availability: "Immediate",
  payRate: "$70/hr C2C",
};

describe("benchConsultantSchema", () => {
  it("accepts the GAS mandatory set and defaults the rest", () => {
    const parsed = benchConsultantSchema.parse(valid);
    expect(parsed.status).toBe("Available");
    expect(parsed.relocation).toBe("No");
  });

  it.each(["consultantName", "role", "technologySkills", "experience", "location", "availability", "payRate"])(
    "rejects a blank %s",
    (field) => {
      expect(benchConsultantSchema.safeParse({ ...valid, [field]: "  " }).success).toBe(false);
    }
  );

  it("keeps free-text rates as typed", () => {
    expect(benchConsultantSchema.parse({ ...valid, marketingRate: "$85/hr C2C" }).marketingRate).toBe("$85/hr C2C");
  });

  it("only allows known visa, status and relocation values", () => {
    expect(benchConsultantSchema.safeParse({ ...valid, visaStatus: "Martian" }).success).toBe(false);
    expect(benchConsultantSchema.safeParse({ ...valid, status: "Sleeping" }).success).toBe(false);
    expect(benchConsultantSchema.safeParse({ ...valid, relocation: "Maybe" }).success).toBe(false);
    expect(benchConsultantSchema.parse({ ...valid, relocation: "Open" }).relocation).toBe("Open");
  });

  it("validates LinkedIn URLs but allows blank", () => {
    expect(benchConsultantSchema.safeParse({ ...valid, linkedinUrl: "not a url" }).success).toBe(false);
    expect(benchConsultantSchema.safeParse({ ...valid, linkedinUrl: "" }).success).toBe(true);
  });
});

describe("titleCaseName (GAS _titleCaseName parity)", () => {
  it("capitalizes each word and collapses whitespace", () => {
    expect(titleCaseName("  JOHN   smith ")).toBe("John Smith");
    expect(titleCaseName("mary-jane o'neil")).toBe("Mary-jane O'neil");
  });
});
