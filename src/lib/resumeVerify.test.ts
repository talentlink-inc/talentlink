import { describe, expect, it } from "vitest";
import {
  checkResumeText,
  isRealName,
  nameFromFileName,
  nameFromText,
  repositoryFileName,
  resolveName,
  resolveTitle,
  tidyName,
} from "./resumeVerify";

const RESUME = `JOHN A. DOE
Senior Java Developer
john.doe@example.com | +1 (469) 555-0123 | Dallas, TX

PROFESSIONAL SUMMARY
12 years building Java services.

TECHNICAL SKILLS
Java, Spring Boot, AWS, Kafka

EXPERIENCE
Acme Corp — Lead Engineer (2019–present)
- Built payment APIs used by 3M customers.

EDUCATION
B.S. Computer Science, UT Dallas
`.repeat(2);

describe("[unit] repository names", () => {
  it.each([
    ["John Doe", true],
    ["Mary-Jane O'Neil", true],
    ["Venkata Ramana Reddy Kumar", true],
    ["PROFESSIONAL SUMMARY", false],
    ["Professional Summary", false],
    ["", false],
    ["John", false],
    ["Java Developer", false],
    ["john@x.com", false],
    ["Resume 2024", false],
  ])("isRealName(%j) = %s", (n, ok) => {
    expect(isRealName(n)).toBe(ok);
  });

  it("tidies all-caps and all-lower names", () => {
    expect(tidyName("JOHN A. DOE")).toBe("John A. Doe");
    expect(tidyName("jane smith")).toBe("Jane Smith");
    expect(tidyName("Ravi Kumar")).toBe("Ravi Kumar");
  });

  it("recovers a name from typical file names", () => {
    expect(nameFromFileName("John_Doe_Resume_2024.pdf")).toBe("John Doe");
    expect(nameFromFileName("Resume - Jane Smith (Java).docx")).toBe("Jane Smith");
    expect(nameFromFileName("RAVI KUMAR - Sr SAP FICO Consultant.pdf")).toBe("Ravi Kumar");
    expect(nameFromFileName("resume_final_v3.pdf")).toBeNull();
    expect(nameFromFileName("john_doe_resume.pdf")).toBe("John Doe");
  });

  it("recovers a name from the top of the resume text", () => {
    expect(nameFromText(RESUME)).toBe("John A. Doe");
    expect(nameFromText("RESUME\nPriya Sharma    priya@x.com  +91 98765 43210\nData Engineer")).toBe("Priya Sharma");
    expect(nameFromText("PROFESSIONAL SUMMARY\nI build things")).toBeNull();
  });

  it("prefers GAS's name, then the file name, then the text", () => {
    expect(resolveName("Asha Rao", "John_Doe.pdf", RESUME)).toBe("Asha Rao");
    expect(resolveName("ravi kumar", "x.pdf", RESUME)).toBe("Ravi Kumar");
    expect(resolveName("PROFESSIONAL SUMMARY", "John_Doe_Resume.pdf", RESUME)).toBe("John Doe");
    expect(resolveName("", "resume.pdf", RESUME)).toBe("John A. Doe");
    expect(resolveName("", "resume.pdf", "no name here at all")).toBeNull();
  });
});

describe("[unit] repository titles", () => {
  it("uses GAS's title when usable, else a title line near the top", () => {
    expect(resolveTitle("SAP FICO Consultant", RESUME)).toBe("SAP FICO Consultant");
    expect(resolveTitle("", RESUME)).toBe("Senior Java Developer");
    expect(resolveTitle(null, "Nothing useful")).toBeNull();
  });
});

describe("[unit] is it a good resume?", () => {
  it("accepts a real resume", () => {
    expect(checkResumeText(RESUME, { verified: false })).toEqual({ ok: true });
  });
  it("rejects empty, tiny, section-less or contact-less text", () => {
    expect(checkResumeText("", { verified: false })).toMatchObject({ ok: false, reason: "no readable text" });
    expect(checkResumeText("Invoice #123 ".repeat(30), { verified: false })).toMatchObject({ ok: false });
    expect(checkResumeText("Experience and more words ".repeat(40), { verified: false })).toMatchObject({ ok: false, reason: "no resume sections" });
    expect(
      checkResumeText("Experience Education Skills ".repeat(40), { verified: false })
    ).toMatchObject({ ok: false, reason: "no contact details" });
  });
  it("trusts GAS-verified (Live) files once they have readable text", () => {
    expect(checkResumeText("x".repeat(250), { verified: true })).toEqual({ ok: true });
    expect(checkResumeText("short", { verified: true })).toMatchObject({ ok: false });
  });
});

describe("[unit] repository file names", () => {
  it("is 'Full Name - Job Title.ext', safe for storage", () => {
    expect(repositoryFileName("John Doe", "Senior Java Developer", "PDF")).toBe("John Doe - Senior Java Developer.pdf");
    expect(repositoryFileName("Jane Smith", null, ".docx")).toBe("Jane Smith.docx");
    expect(repositoryFileName("A/B", "C:D*E", "pdf")).toBe("A B - C D E.pdf");
  });
});
