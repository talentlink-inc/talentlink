import { z } from "zod";
import { REJECT_REASON_OPTIONS, SUBMISSION_STATUSES, isRejectedStatus } from "@/lib/recruitment";

// GAS addBenchSubmission / updateBenchSubmissionStatus: consultant and
// company are required; contact fields optional; status vocabulary and
// reject reasons are Recruitment's (GAS kept them identical on purpose).
// Legacy imported statuses (e.g. "Submitted") stay valid on edit so saving a
// record never silently changes its status.
export function benchSubmissionSchema(currentStatus?: string | null) {
  const allowed = new Set<string>([...SUBMISSION_STATUSES, ...(currentStatus ? [currentStatus] : [])]);
  return z
    .object({
      benchConsultantId: z.string().trim().min(1, "Select a bench consultant"),
      companyName: z.string().trim().min(1, "Client / vendor company is required").max(300),
      contactPerson: z.string().trim().max(200).optional(),
      contactNumber: z.string().trim().max(60).optional(),
      email: z
        .string()
        .trim()
        .max(320)
        .optional()
        .refine((v) => !v || z.email().safeParse(v).success, { message: "Enter a valid contact email" }),
      rate: z.string().trim().max(100).optional(),
      status: z.string().refine((s) => allowed.has(s), { message: "Select a valid status" }),
      rejectReason: z.string().trim().optional(),
      notes: z.string().trim().max(5000).optional(),
    })
    .superRefine((data, ctx) => {
      if (isRejectedStatus(data.status)) {
        if (!data.rejectReason) {
          ctx.addIssue({ code: "custom", message: "A reject reason is required for this status.", path: ["rejectReason"] });
        } else if (!(REJECT_REASON_OPTIONS as readonly string[]).includes(data.rejectReason)) {
          ctx.addIssue({ code: "custom", message: "Select a valid reject reason.", path: ["rejectReason"] });
        }
      }
    });
}

export type BenchSubmissionInput = z.infer<ReturnType<typeof benchSubmissionSchema>>;

// GAS duplicate rule: same consultant + same company (case-insensitive,
// trimmed) is a hard block.
export function normalizeCompany(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
