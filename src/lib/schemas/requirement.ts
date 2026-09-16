import { z } from "zod";
import { REQUIREMENT_STATUSES } from "@/lib/recruitment";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

// Extracted from requirements/actions.ts so it's unit-testable — a
// "use server" file may only export async functions, so this schema (and
// the form parser using it) can't live there directly.

export const screeningQuestionSchema = z.object({
  id: z.string(),
  text: z.string().trim().min(1),
  type: z.enum(["short", "long", "rating", "yesno"]),
  required: z.boolean(),
});

// Mandatory-field set mirrors the original ITStaffing (Google Apps Script)
// Requirements form validation (PageRecruitment.html: reqSaveRequirement) —
// Client Name, Job Description, Duration, Mandatory Skills, Country, Bill
// Rate, and Employment Type are all required there, plus Visa (only when
// Country includes USA) and Work Location (only when not Remote). Job ID
// isn't part of the form at all there — it's auto-generated.
export const requirementSchema = z
  .object({
    jobTitle: z.string().trim().min(1, "Job title is required").max(200, "Job title cannot exceed 200 characters"),
    clientName: z.string().trim().min(1, "Client name is required"),
    status: z.enum(REQUIREMENT_STATUSES),
    priority: z.coerce.number().int().min(0).max(5),
    employmentType: z.string().trim().min(1, "Employment type is required"),
    duration: z.string().trim().min(1, "Duration is required"),
    visa: z.string().trim().optional(),
    workLocation: z.string().trim().optional(),
    country: z.string().trim().min(1, "Country is required"),
    isRemote: z.coerce.boolean().optional(),
    billRate: z
      .string()
      .trim()
      .min(1, "Bill rate is required")
      .transform(Number)
      .pipe(z.number().nonnegative("Bill rate must be 0 or greater")),
    billRateCurrency: z.enum(SUPPORTED_CURRENCIES),
    payRate: z.coerce.number().nonnegative("Pay rate must be 0 or greater").optional().nullable(),
    payRateCurrency: z.enum(SUPPORTED_CURRENCIES),
    mandatorySkills: z.string().trim().min(1, "Mandatory skills is required"),
    // Rendered through a rich-text editor and sanitized server-side
    // (sanitizeRichText) before it's persisted, so a malicious client can't
    // bypass it by posting the form directly.
    jobDescription: z
      .string()
      .trim()
      .min(1, "Job description is required")
      .max(20000, "Job description cannot exceed 20,000 characters"),
    accountManagerRaw: z.string().trim().optional(),
    screeningQuestions: z.array(screeningQuestionSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.isRemote && !data.workLocation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workLocation"],
        message: "Work location is required (or check Remote)",
      });
    }
    if (data.country.toUpperCase().includes("USA") && !data.visa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visa"],
        message: "Visa is required for USA roles",
      });
    }
  });
