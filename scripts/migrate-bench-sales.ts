// Migrates the GAS app's Bench Sales data — BenchSales (consultants),
// BenchSubmissions and BenchInterviews — into the bench_* tables.
//
// Decisions (2026-10-03, per the business owner):
//   - Resumes ARE migrated (Drive → Supabase Storage). GAS's separate visa-
//     document slot (VisaDocFileIds — in practice driver's licences and
//     similar) is NOT: those files are never read or copied.
//   - Bench submission contact emails are masked on import, keeping the
//     company domain: "john@acme.com" → "xxxx@acme.com" (src/lib/maskEmail.ts),
//     including any emails inside submission Notes.
//   - GAS IDs carry over as readable codes: consultant #12 → BC-0012,
//     submission #40 → BSUB-0040.
//   - Status "Onboarded" (a legacy GAS value) maps to "Onboarding"; every
//     submission in a qualifying placement status gets a BPLC- id, numbered
//     in submission-date order. Other legacy statuses (e.g. "Submitted") are
//     kept as-is — the edit forms keep them selectable.
//
// Idempotent: rows already present (matched on legacyId) are skipped.
//
// Usage:
//   npx tsx scripts/migrate-bench-sales.ts --dry-run
//   npx tsx scripts/migrate-bench-sales.ts [--skip-files]

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { getSupabaseAdmin, RESUME_BUCKET } from "../src/lib/supabase/admin";
import { maskEmail, maskEmailsInText } from "../src/lib/maskEmail";
import { INTERVIEW_STATUSES, isQualifyingPlacementStatus, VISA_STATUSES } from "../src/lib/recruitment";
import { BENCH_CONSULTANT_STATUSES } from "../src/lib/bench";
import { titleCaseName } from "../src/lib/schemas/benchConsultant";
import { zonedLocalToUtc } from "../src/lib/timezone";
import { getGoogleClients, readSheetAsObjects } from "./lib/sheets";
import {
  DEFAULT_TIME_ZONE,
  MODES,
  TIME_ZONES,
  normalizeDate,
  normalizeTime,
  parseInt10,
  parseSheetDate,
  sha256Buffer,
} from "./lib/parse";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_FILES = process.argv.includes("--skip-files");
const SPREADSHEET_ID = process.env.GAS_SPREADSHEET_ID;
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

const code = (prefix: string, n: number) => `${prefix}-${String(n).padStart(4, "0")}`;
const blank = (v: string | undefined) => (v ?? "").trim() || null;

// GAS free-text visa values onto the app's vocabulary ("H4 EAD" → "H4-EAD").
function normalizeVisa(raw: string): string {
  const v = raw.trim();
  const match = VISA_STATUSES.find((s) => s.replace(/[\s-]/g, "").toLowerCase() === v.replace(/[\s-]/g, "").toLowerCase());
  return match ?? v;
}

function normalizeRelocation(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v.startsWith("y")) return "Yes";
  if (v.startsWith("open")) return "Open";
  return "No";
}

function normalizeSubmissionStatus(raw: string): string {
  const v = raw.trim();
  return v === "Onboarded" ? "Onboarding" : v || "Vender_Submission";
}

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GAS_SPREADSHEET_ID is not set.");
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant with subdomain "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id);

  const { sheets, drive } = getGoogleClients();
  const [consultantRows, submissionRows, interviewRows] = await Promise.all([
    readSheetAsObjects(sheets, SPREADSHEET_ID, "BenchSales"),
    readSheetAsObjects(sheets, SPREADSHEET_ID, "BenchSubmissions"),
    readSheetAsObjects(sheets, SPREADSHEET_ID, "BenchInterviews"),
  ]);
  console.log(
    `GAS: ${consultantRows.length} consultants, ${submissionRows.length} submissions, ${interviewRows.length} interviews.`
  );

  const users = await db.user.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true } });
  const userIdByName = new Map(users.map((u) => [u.name.trim().toLowerCase(), u.id]));
  const linkUser = (name: string | null) => (name ? userIdByName.get(name.trim().toLowerCase()) ?? null : null);

  // ---- Consultants ----
  const existingConsultants = await db.benchConsultant.findMany({
    where: { tenantId: tenant.id, legacyId: { not: null } },
    select: { id: true, legacyId: true },
  });
  const consultantIdByLegacy = new Map(existingConsultants.map((c) => [c.legacyId!, c.id]));
  let consultantsCreated = 0;
  let resumesCopied = 0;
  const resumeFailures: string[] = [];

  async function copyResume(driveFileId: string, fileName: string, consultantId: string) {
    const meta = await drive.files.get({ fileId: driveFileId, fields: "mimeType" });
    const isGoogleDoc = meta.data.mimeType?.startsWith("application/vnd.google-apps.");
    const res = isGoogleDoc
      ? await drive.files.export({ fileId: driveFileId, mimeType: "application/pdf" }, { responseType: "arraybuffer" })
      : await drive.files.get({ fileId: driveFileId, alt: "media" }, { responseType: "arraybuffer" });
    const buffer = Buffer.from(res.data as ArrayBuffer);
    const finalName = isGoogleDoc && !/\.pdf$/i.test(fileName) ? `${fileName}.pdf` : fileName;
    const safe = finalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${tenant!.id}/bench/${consultantId}/${sha256Buffer(buffer)}-${safe}`;
    const { error } = await getSupabaseAdmin().storage.from(RESUME_BUCKET).upload(storagePath, buffer, { upsert: true });
    if (error) throw error;
    return {
      resumeFileUrl: storagePath,
      resumeFileName: finalName,
      resumeFileMime: isGoogleDoc ? "application/pdf" : meta.data.mimeType ?? null,
      resumeSourceDriveFileId: driveFileId,
    };
  }

  for (const row of consultantRows) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null || consultantIdByLegacy.has(legacyId)) continue;

    const status = (BENCH_CONSULTANT_STATUSES as readonly string[]).includes(row.Status) ? row.Status : "Available";
    const marketerName = blank(row.Marketer);
    const assignedName = blank(row.AssignedTo);
    const data = {
      tenantId: tenant.id,
      legacyId,
      consultantCode: code("BC", legacyId),
      consultantName: titleCaseName(row.ConsultantName ?? ""),
      role: (row.Role ?? "").trim(),
      technologySkills: (row.TechnologySkills ?? "").trim(),
      visaStatus: normalizeVisa(row.VisaStatus ?? ""),
      relocation: normalizeRelocation(row.Relocation ?? ""),
      experience: (row.Experience ?? "").trim(),
      location: (row.Location ?? "").trim(),
      availability: (row.Availability ?? "").trim(),
      payRate: blank(row.PayRate),
      marketingRate: blank(row.MarketingRate),
      status,
      linkedinUrl: blank(row.LinkedinURL),
      marketerUserId: linkUser(marketerName),
      marketerNameRaw: marketerName,
      assignedToUserId: linkUser(assignedName),
      assignedToNameRaw: assignedName,
      onHotlist: (row.OnHotlist ?? "").trim().toUpperCase() === "Y",
      hotlistStatus: blank(row.HotlistStatus),
      addedDate: parseSheetDate(row.AddedDate) ?? new Date(),
    };
    console.log(`${DRY_RUN ? "[dry-run] " : ""}consultant ${data.consultantCode} ${data.consultantName} (${status}${data.onHotlist ? ", hotlist" : ""})`);
    consultantsCreated++;
    if (DRY_RUN) {
      consultantIdByLegacy.set(legacyId, `dry-${legacyId}`);
      continue;
    }
    const created = await db.benchConsultant.create({ data });
    consultantIdByLegacy.set(legacyId, created.id);

    const driveFileId = blank(row.ResumeFileId);
    if (driveFileId && !SKIP_FILES) {
      try {
        const resume = await copyResume(driveFileId, blank(row.ResumeFileName) ?? "resume", created.id);
        await db.benchConsultant.update({ where: { id: created.id }, data: resume });
        resumesCopied++;
      } catch (err) {
        resumeFailures.push(`${data.consultantCode} ${data.consultantName}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  // ---- Submissions ----
  const existingSubs = await db.benchSubmission.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, legacyId: true, placementId: true },
  });
  const submissionIdByLegacy = new Map(existingSubs.filter((s) => s.legacyId != null).map((s) => [s.legacyId!, s.id]));
  let nextPlacement =
    Math.max(0, ...existingSubs.map((s) => parseInt10(s.placementId?.match(/^BPLC-(\d+)$/)?.[1]) ?? 0)) + 1;
  let submissionsCreated = 0;
  let emailsMasked = 0;
  const orphanSubmissions: string[] = [];

  const orderedSubs = [...submissionRows].sort(
    (a, b) =>
      (parseSheetDate(a.SubmissionDate)?.getTime() ?? 0) - (parseSheetDate(b.SubmissionDate)?.getTime() ?? 0) ||
      (parseInt10(a.ID) ?? 0) - (parseInt10(b.ID) ?? 0)
  );
  for (const row of orderedSubs) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null || submissionIdByLegacy.has(legacyId)) continue;
    const consultantId = consultantIdByLegacy.get(parseInt10(row.BenchConsultantID) ?? -1);
    if (!consultantId) {
      orphanSubmissions.push(`#${legacyId} → GAS consultant ${row.BenchConsultantID}`);
      continue;
    }

    const status = normalizeSubmissionStatus(row.Status ?? "");
    const email = maskEmail(row.Email);
    if (email) emailsMasked++;
    const submittedBy = blank(row.SubmittedBy);
    const submissionDate = parseSheetDate(row.SubmissionDate);
    const placementId = blank(row.PlacementID) ?? (isQualifyingPlacementStatus(status) ? code("BPLC", nextPlacement++) : null);
    const data = {
      tenantId: tenant.id,
      legacyId,
      submissionCode: code("BSUB", legacyId),
      benchConsultantId: consultantId,
      companyName: (row.CompanyName ?? "").trim() || "—",
      contactPerson: blank(row.ContactPerson),
      contactNumber: blank(row.ContactNumber),
      email,
      rate: blank(row.Rate),
      status,
      notes: row.Notes?.trim() ? maskEmailsInText(row.Notes.trim()) : null,
      submittedByUserId: linkUser(submittedBy),
      submittedByNameRaw: submittedBy,
      submissionDate,
      placementId,
      selectedDate: parseSheetDate(row.SelectedDate) ?? (placementId ? submissionDate : null),
      doj: parseSheetDate(row.DOJ),
    };
    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}submission ${data.submissionCode} → ${data.companyName} (${status}${placementId ? `, ${placementId}` : ""}) email=${email ?? "—"}`
    );
    submissionsCreated++;
    if (DRY_RUN) {
      submissionIdByLegacy.set(legacyId, `dry-${legacyId}`);
      continue;
    }
    const created = await db.benchSubmission.create({ data });
    submissionIdByLegacy.set(legacyId, created.id);
  }

  // ---- Interviews ----
  const existingInterviews = await db.benchInterview.findMany({
    where: { tenantId: tenant.id, legacyId: { not: null } },
    select: { legacyId: true },
  });
  const existingInterviewIds = new Set(existingInterviews.map((i) => i.legacyId!));
  let interviewsCreated = 0;
  const orphanInterviews: string[] = [];
  for (const row of interviewRows) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null || existingInterviewIds.has(legacyId)) continue;
    const benchSubmissionId = submissionIdByLegacy.get(parseInt10(row.BenchSubmissionID) ?? -1);
    if (!benchSubmissionId) {
      orphanInterviews.push(`#${legacyId} → GAS submission ${row.BenchSubmissionID}`);
      continue;
    }
    const timezone = TIME_ZONES[(row.Timezone ?? "").trim().toUpperCase()] ?? DEFAULT_TIME_ZONE;
    const date = normalizeDate(row.InterviewDate ?? "");
    const time = normalizeTime(row.InterviewTime ?? "") ?? "09:00";
    const scheduledBy = blank(row.ScheduledBy);
    const data = {
      tenantId: tenant.id,
      legacyId,
      benchSubmissionId,
      interviewType: (row.InterviewType ?? "").trim() || "L1",
      scheduledAt: date ? zonedLocalToUtc(`${date}T${time}`, timezone) : null,
      timezone,
      durationMinutes: parseInt10(row.Duration) ?? null,
      mode: MODES[(row.InterviewMode ?? "").trim().toLowerCase()] ?? null,
      clientCompany: blank(row.ClientCompany),
      status: (INTERVIEW_STATUSES as readonly string[]).includes(row.Status) ? row.Status : "Scheduled",
      feedback: blank(row.Feedback),
      scheduledByUserId: linkUser(scheduledBy),
      scheduledByNameRaw: scheduledBy,
      createdAt: parseSheetDate(row.CreatedDate) ?? undefined,
    };
    console.log(`${DRY_RUN ? "[dry-run] " : ""}interview #${legacyId} ${data.interviewType} ${data.scheduledAt?.toISOString() ?? "?"} ${timezone} (${data.status})`);
    interviewsCreated++;
    if (!DRY_RUN) await db.benchInterview.create({ data });
  }

  console.log(
    `\n${DRY_RUN ? "Would create" : "Created"}: ${consultantsCreated} consultants (${resumesCopied} resumes copied), ` +
      `${submissionsCreated} submissions (${emailsMasked} emails masked), ${interviewsCreated} interviews. ` +
      `Visa/ID documents: not migrated by design.`
  );
  if (resumeFailures.length) console.log(`\nResume copy failures:\n  ${resumeFailures.join("\n  ")}`);
  if (orphanSubmissions.length) console.log(`\nSubmissions skipped (consultant missing):\n  ${orphanSubmissions.join("\n  ")}`);
  if (orphanInterviews.length) console.log(`\nInterviews skipped (submission missing):\n  ${orphanInterviews.join("\n  ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
