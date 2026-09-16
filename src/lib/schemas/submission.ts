import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";

// Extracted from submissions/actions.ts so it's unit-testable — a
// "use server" file may only export async functions, so this schema can't
// live there directly.

// Mandatory-field set mirrors the original ITStaffing (Google Apps Script)
// Submissions form (PageRecruitment.html: REC_MANDATORY_FIELD_IDS /
// recSubmitResume) — Email, Contact Number, Current Location, Total
// Experience, Pay Rate, Visa Status, Employment Type, and Role with Skills
// are all required there. Bill Rate and LinkedIn URL were never mandatory.
export const LINKEDIN_URL_PATTERN = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/.+/i;
export const PHONE_PATTERN = /^[0-9+\-() ]+$/;

export const candidateSchema = z.object({
  requirementId: z.string().trim().min(1, "Select a requirement"),
  candidateName: z.string().trim().min(1, "Candidate name is required"),
  email: z.string().trim().min(1, "Email is required"),
  phone: z
    .string()
    .trim()
    .min(1, "Contact number is required")
    .regex(PHONE_PATTERN, "Phone number can only contain digits, spaces, and + - ( )"),
  country: z.string().trim().optional(),
  currentLocation: z.string().trim().min(1, "Current location is required"),
  totalExperienceYears: z
    .string()
    .trim()
    .min(1, "Total experience is required")
    .transform(Number)
    .pipe(z.number().nonnegative("Total experience cannot be negative")),
  visaStatus: z.string().trim().min(1, "Visa status is required"),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || LINKEDIN_URL_PATTERN.test(v), {
      message: "Please enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/username)",
    }),
  employmentType: z.string().trim().min(1, "Employment type is required"),
  roleWithSkills: z.string().trim().min(1, "Role with skills is required"),
  billRate: z.coerce.number().nonnegative("Bill rate must be 0 or greater").optional().nullable(),
  billRateCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  payRate: z
    .string()
    .trim()
    .min(1, "Pay rate is required")
    .transform(Number)
    .pipe(z.number().nonnegative("Pay rate must be 0 or greater")),
  payRateCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
});
