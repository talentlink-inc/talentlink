import { z } from "zod";
import { BENCH_CONSULTANT_STATUSES, BENCH_RELOCATION_OPTIONS } from "@/lib/bench";
import { VISA_STATUSES } from "@/lib/recruitment";
import { LINKEDIN_URL_PATTERN } from "@/lib/schemas/submission";

// Mandatory-field set mirrors GAS addBenchConsultant + PageBenchSales.html
// (Consultant Name, Role, Technology/Skills, Visa, Experience, Location,
// Availability, Pay Rate). Rates stay free text, as in GAS ("$70/hr C2C").
const RELOCATION_VALUES = BENCH_RELOCATION_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const benchConsultantSchema = z.object({
  consultantName: z.string().trim().min(1, "Consultant name is required").max(200),
  role: z.string().trim().min(1, "Role is required").max(300),
  technologySkills: z.string().trim().min(1, "Technology / skills are required").max(5000),
  visaStatus: z.enum(VISA_STATUSES, { message: "Select a visa status" }),
  relocation: z.enum(RELOCATION_VALUES).default("No"),
  experience: z.string().trim().min(1, "Experience is required").max(50),
  location: z.string().trim().min(1, "Location is required").max(200),
  availability: z.string().trim().min(1, "Availability is required").max(100),
  payRate: z.string().trim().min(1, "Pay rate is required").max(100),
  marketingRate: z.string().trim().max(100).optional(),
  status: z.enum(BENCH_CONSULTANT_STATUSES).default("Available"),
  linkedinUrl: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || LINKEDIN_URL_PATTERN.test(v), {
      message: "Please enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/username)",
    }),
  marketerUserId: z.string().trim().optional(),
});

export type BenchConsultantInput = z.infer<typeof benchConsultantSchema>;

// Exactly GAS's _titleCaseName (BenchSales.js): each whitespace-separated
// word becomes Capital + lowercase rest, whitespace collapsed — so a name is
// stored identically whichever system it was entered in.
export function titleCaseName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}
