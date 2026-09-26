// Second-phase migration: pulls the OLDEST N requirements (default 300,
// MIGRATION_REQUIREMENT_LIMIT) from the source Apps Script app's
// "Requirements" sheet, ordered by CreatedDate, plus every "Recruitment"
// (submission) row that references one of them. The newest requirements
// beyond N — and their submissions — are deliberately left untouched.
//
// Differences from migrate-recent-submissions.ts (the first, 100-submission
// run), all due to what's changed in the app since:
//   - Requirements are matched on legacyId, not jobId: renumber-job-ids.ts
//     moved every Job ID onto the JOB-0001 scheme, so GAS's "JOB-001" no
//     longer matches anything. New requirements get the next JOB-NNNN.
//   - New submissions get the next SUB-NNNN submissionId.
//   - Existing requirements, submissions and candidates are never updated
//     (they may have been edited live in the app) — find-or-create only.
//   - Everything goes through getTenantDbFor, since RLS now blocks the
//     plain client.
//   - Text fields get the same cleanup the first batch received afterward
//     (strip-html-from-legacy-text.ts, backfill-apply-tokens.ts), and Job
//     Description is stored as sanitized rich text the way the app now does.
//   - --fix-existing-dates re-parses the date fields of every legacy
//     submission already in the DB — the first run read the sheet's
//     DD/MM/YYYY dates as MM/DD (see parseSheetDate).
//
// Idempotent: re-running skips any requirement/submission whose legacyId is
// already in the DB.
//
// Usage:
//   npx tsx scripts/migrate-oldest-requirements.ts --dry-run
//   npx tsx scripts/migrate-oldest-requirements.ts [--skip-files] [--fix-existing-dates] [--relink-resumes]

import "dotenv/config";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { sanitizeRichText } from "../src/lib/sanitizeRichText";
import { getSupabaseAdmin, RESUME_BUCKET } from "../src/lib/supabase/admin";
import { getGoogleClients, readSheetAsObjects } from "./lib/sheets";
import {
  parseSheetDate,
  parseDecimal,
  parseInt10,
  parseBool,
  candidateIdentityHash,
  sha256Buffer,
  HTML_TAG_PATTERN,
  stripHtml,
} from "./lib/parse";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_FILES = process.argv.includes("--skip-files");
const FIX_EXISTING_DATES = process.argv.includes("--fix-existing-dates");
const RELINK_RESUMES = process.argv.includes("--relink-resumes");
const LIMIT = Number(process.env.MIGRATION_REQUIREMENT_LIMIT ?? 300);
const SPREADSHEET_ID = process.env.GAS_SPREADSHEET_ID;
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

type Row = Record<string, string>;

// The Supabase pooler occasionally stalls a connection indefinitely (one
// real run hung 17 minutes on a single insert). Rather than wait it out,
// exit if nothing has progressed for STALL_MS — the open transaction rolls
// back when the connection drops, and since every step skips rows already
// migrated (by legacyId), simply re-running picks up where this left off.
const STALL_MS = 120_000;
let lastProgressAt = Date.now();
function progress() {
  lastProgressAt = Date.now();
}
const watchdog = setInterval(() => {
  if (Date.now() - lastProgressAt > STALL_MS) {
    console.error(`\nSTALLED: no progress for ${STALL_MS / 1000}s — exiting. Re-run to resume.`);
    process.exit(2);
  }
}, 5_000);
watchdog.unref();

function plainText(value: string | undefined): string | null {
  if (!value) return null;
  return HTML_TAG_PATTERN.test(value) ? stripHtml(value) || null : value;
}

// GAS's Job Description was contenteditable rich text, but plenty of rows
// are plain text with bare newlines — which would collapse when rendered as
// HTML, so those are escaped and given <br>s first.
function richText(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const html = HTML_TAG_PATTERN.test(value)
    ? value
    : value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\r?\n/g, "<br>");
  return sanitizeRichText(html) || null;
}

function formatId(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

function byDateThenId(dateKey: string) {
  return (a: Row, b: Row) =>
    (parseSheetDate(a[dateKey])?.getTime() ?? 0) - (parseSheetDate(b[dateKey])?.getTime() ?? 0) ||
    (parseInt10(a.ID) ?? 0) - (parseInt10(b.ID) ?? 0);
}

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GAS_SPREADSHEET_ID is not set.");
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant "${TENANT_SUBDOMAIN}" — check DEFAULT_TENANT_SUBDOMAIN.`);
  const db = getTenantDbFor(tenant.id);

  console.log(`Reading source sheets from ${SPREADSHEET_ID}...`);
  const { sheets, drive } = getGoogleClients();
  const [requirementRows, recruitmentRows] = await Promise.all([
    readSheetAsObjects(sheets, SPREADSHEET_ID, "Requirements"),
    readSheetAsObjects(sheets, SPREADSHEET_ID, "Recruitment"),
  ]);
  console.log(`Found ${requirementRows.length} requirement rows, ${recruitmentRows.length} submission rows.`);

  const undated = requirementRows.filter((r) => !parseSheetDate(r.CreatedDate));
  if (undated.length > 0) {
    throw new Error(`${undated.length} requirement row(s) have no parseable CreatedDate: ${undated.map((r) => r.JobID).join(", ")}`);
  }
  const oldestRequirements = [...requirementRows].sort(byDateThenId("CreatedDate")).slice(0, LIMIT);
  const newestKept = requirementRows.length - oldestRequirements.length;
  console.log(
    `Oldest ${oldestRequirements.length}: ${oldestRequirements[0].JobID} (${oldestRequirements[0].CreatedDate}) → ` +
      `${oldestRequirements.at(-1)!.JobID} (${oldestRequirements.at(-1)!.CreatedDate}). Leaving the newest ${newestKept} alone.`
  );

  const [existingRequirements, existingSubmissions] = await Promise.all([
    db.requirement.findMany({ where: { tenantId: tenant.id }, select: { id: true, jobId: true, legacyId: true } }),
    db.submission.findMany({ where: { tenantId: tenant.id }, select: { id: true, legacyId: true } }),
  ]);

  // --- Requirements ---
  const requirementIdByLegacyJobId = new Map<string, string>();
  const requirementLegacyIds = new Map(existingRequirements.filter((r) => r.legacyId != null).map((r) => [r.legacyId!, r.id]));
  let nextJobNumber =
    Math.max(0, ...existingRequirements.map((r) => parseInt10(r.jobId.match(/^JOB-(\d+)$/)?.[1]) ?? 0)) + 1;
  let requirementsCreated = 0;
  let requirementsExisting = 0;

  for (const row of oldestRequirements) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null) {
      console.warn(`  ! skipping requirement ${row.JobID} with no numeric ID`);
      continue;
    }
    const existingId = requirementLegacyIds.get(legacyId);
    if (existingId) {
      requirementIdByLegacyJobId.set(row.JobID, existingId);
      requirementsExisting++;
      continue;
    }

    const jobId = formatId("JOB", nextJobNumber++);
    const createdAt = parseSheetDate(row.CreatedDate)!;
    requirementsCreated++;
    if (DRY_RUN) {
      console.log(`[dry-run] requirement ${row.JobID} → ${jobId}: ${row.JobTitle} (${createdAt.toISOString().slice(0, 10)}, ${row.Status})`);
      requirementIdByLegacyJobId.set(row.JobID, `dry-run-${jobId}`);
      continue;
    }

    const saved = await db.requirement.create({
      data: {
        tenantId: tenant.id,
        legacyId,
        jobId,
        jobTitle: row.JobTitle || "(untitled)",
        jobDescription: richText(row.JobDescription),
        duration: row.Duration || null,
        visa: row.Visa || null,
        mandatorySkills: plainText(row.MandatorySkills),
        workLocation: row.WorkLocation || null,
        billRate: parseDecimal(row.BillRate),
        payRate: parseDecimal(row.PayRate),
        clientName: row.ClientName || null,
        status: row.Status || "Open",
        priority: parseInt10(row.Priority) ?? 0,
        employmentType: row.EmploymentType || null,
        country: row.Country || null,
        isRemote: parseBool(row.IsRemote),
        ceipalJobId: row.CeipalJobID || null,
        postedByRaw: row.PostedBy || null,
        accountManagerRaw: row.CPOC || null,
        regions: {
          other: row.OtherCountryName || null,
          europe: row.EuropeCountries || null,
          apac: row.ApacCountries || null,
          uae: row.UaeCountries || null,
          southAmerica: row.SouthAmericaCountries || null,
        },
        publicApplyToken: randomBytes(16).toString("hex"),
        createdAt,
      },
    });
    requirementIdByLegacyJobId.set(row.JobID, saved.id);
    progress();
  }
  console.log(`Requirements: ${requirementsCreated} to create, ${requirementsExisting} already migrated.`);

  // --- Submissions (+ candidates + resumes) ---
  const existingSubmissionLegacyIds = new Set(existingSubmissions.map((s) => s.legacyId).filter((id) => id != null));
  const seenLegacyIds = new Set<number>();
  const candidateSubmissions = recruitmentRows
    .filter((r) => requirementIdByLegacyJobId.has(r.RequirementJobID))
    .sort(byDateThenId("SubmissionDate"));
  const toMigrate: Row[] = [];
  let submissionsExisting = 0;
  for (const row of candidateSubmissions) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null) {
      console.warn(`  ! skipping submission row with no numeric ID: ${row.CandidateName}`);
    } else if (existingSubmissionLegacyIds.has(legacyId)) {
      submissionsExisting++;
    } else if (seenLegacyIds.has(legacyId)) {
      console.warn(`  ! skipping duplicate submission ID ${legacyId} (${row.CandidateName})`);
    } else {
      seenLegacyIds.add(legacyId);
      toMigrate.push(row);
    }
  }
  console.log(
    `Submissions under these requirements: ${candidateSubmissions.length} — ` +
      `${toMigrate.length} to create, ${submissionsExisting} already migrated.`
  );

  let nextSubmissionNumber = existingSubmissions.length + 1;
  let migrated = 0;
  let resumesLinked = 0;
  const failures: string[] = [];

  for (const row of toMigrate) {
    const legacyId = parseInt10(row.ID)!;
    const submissionId = formatId("SUB", nextSubmissionNumber);
    if (DRY_RUN) {
      console.log(`[dry-run] submission ${legacyId} → ${submissionId}: ${row.CandidateName} → ${row.RequirementJobID} (${row.Status}, ${row.SubmissionDate})`);
      nextSubmissionNumber++;
      migrated++;
      continue;
    }

    try {
      const email = row.EmailID || null;
      const phone = row.ContactNumber || null;
      const identityHash = candidateIdentityHash(email, phone, `legacy-${legacyId}`);
      const candidate =
        (await db.candidate.findUnique({
          where: { tenantId_identityHash: { tenantId: tenant.id, identityHash } },
        })) ??
        (await db.candidate.create({
          data: {
            tenantId: tenant.id,
            identityHash,
            name: row.CandidateName || "(unnamed)",
            email,
            phone,
            currentLocation: row.CurrentLocation || null,
            totalExperienceYears: parseDecimal(row.TotalExperience),
            visaStatus: row.VisaStatus || null,
            linkedinUrl: row.LinkedinURL || null,
          },
        }));

      let resumeId: string | null = null;
      if (!SKIP_FILES && row.ResumeFileId) {
        resumeId = await migrateResumeFile({
          driveFileId: row.ResumeFileId,
          fileName: row.ResumeFileName || `resume-${legacyId}`,
          tenantId: tenant.id,
          candidateId: candidate.id,
        });
        if (resumeId) resumesLinked++;
      }

      await db.submission.create({
        data: {
          tenantId: tenant.id,
          legacyId,
          submissionId,
          candidateId: candidate.id,
          resumeId,
          requirementId: requirementIdByLegacyJobId.get(row.RequirementJobID) ?? null,
          requirementJobIdRaw: row.RequirementJobID || null,
          roleWithSkills: plainText(row.RoleWithSkills),
          roleSkillsShort: row.RoleSkillsShort || null,
          status: row.Status || "New_Resume",
          employmentType: row.EmploymentType || null,
          country: row.Country || null,
          recruiterNameRaw: row.RecruiterName || null,
          assignedToNameRaw: row.AssignedTo || null,
          cpocNameRaw: row.CPOC || null,
          salesBy: row.SalesBy || null,
          submissionDate: parseSheetDate(row.SubmissionDate),
          submissionCountDate: parseSheetDate(row.SubmissionCountDate),
          selectedDate: parseSheetDate(row.SelectedDate),
          doj: parseSheetDate(row.DOJ),
          billRate: parseDecimal(row.BillRate),
          payRate: parseDecimal(row.PayRate),
          commission: parseDecimal(row.Commission),
          placementId: row.PlacementID || null,
          rejectReason: row.RejectReason || null,
          additionalDocName: row.DocFileName || null,
        },
      });
      nextSubmissionNumber++;
      migrated++;
    } catch (err) {
      failures.push(`${legacyId} (${row.CandidateName})`);
      console.warn(`  ! skipping submission ${legacyId} (${row.CandidateName}):`, err);
    }
    progress();
    if (migrated % 25 === 0) console.log(`  ...${migrated}/${toMigrate.length}`);
  }

  // --- Resume re-link ---
  // migrateResumeFile swallows every error (so one bad file can't sink a
  // submission), which means a transient DB/pooler failure mid-upload leaves
  // the submission created with resumeId = null — and later runs skip
  // existing submissions, so it would never be retried. Only ever fills in a
  // null resumeId; never replaces one.
  let resumesRelinked = 0;
  const relinkFailures: string[] = [];
  if (RELINK_RESUMES && !SKIP_FILES) {
    const sheetById = new Map<number, Row>();
    for (const row of recruitmentRows) {
      const id = parseInt10(row.ID);
      if (id !== null && row.ResumeFileId) sheetById.set(id, row);
    }
    const unlinked = await db.submission.findMany({
      where: { tenantId: tenant.id, legacyId: { not: null }, resumeId: null },
      select: { id: true, legacyId: true, submissionId: true, candidateId: true },
    });
    console.log(`\n${unlinked.length} legacy submission(s) without a resume — retrying.`);
    for (const s of unlinked) {
      const row = sheetById.get(s.legacyId!);
      if (!row) {
        relinkFailures.push(`${s.submissionId} (no ResumeFileId in sheet)`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`[dry-run] relink ${s.submissionId}: ${row.CandidateName} ← Drive ${row.ResumeFileId}`);
        continue;
      }
      const resumeId = await migrateResumeFile({
        driveFileId: row.ResumeFileId,
        fileName: row.ResumeFileName || `resume-${s.legacyId}`,
        tenantId: tenant.id,
        candidateId: s.candidateId,
      });
      if (resumeId) {
        await db.submission.update({ where: { id: s.id, tenantId: tenant.id }, data: { resumeId } });
        resumesRelinked++;
      } else {
        relinkFailures.push(`${s.submissionId} (${row.CandidateName}, Drive ${row.ResumeFileId})`);
      }
      progress();
    }
  }

  // --- Date correction for submissions migrated by the first run ---
  let datesFixed = 0;
  if (FIX_EXISTING_DATES) {
    const sheetById = new Map<number, Row[]>();
    for (const row of recruitmentRows) {
      const id = parseInt10(row.ID);
      if (id !== null) sheetById.set(id, [...(sheetById.get(id) ?? []), row]);
    }
    const legacySubmissions = await db.submission.findMany({
      where: { tenantId: tenant.id, legacyId: { not: null } },
      select: { id: true, legacyId: true, submissionId: true, submissionDate: true, submissionCountDate: true, selectedDate: true, doj: true },
    });
    for (const s of legacySubmissions) {
      const matches = sheetById.get(s.legacyId!) ?? [];
      if (matches.length !== 1) {
        console.warn(`  ! can't fix dates for ${s.submissionId}: ${matches.length} sheet rows with ID ${s.legacyId}`);
        continue;
      }
      const row = matches[0];
      const corrected = {
        submissionDate: parseSheetDate(row.SubmissionDate),
        submissionCountDate: parseSheetDate(row.SubmissionCountDate),
        selectedDate: parseSheetDate(row.SelectedDate),
        doj: parseSheetDate(row.DOJ),
      };
      const changed = (Object.keys(corrected) as (keyof typeof corrected)[]).filter(
        (k) => (s[k]?.getTime() ?? null) !== (corrected[k]?.getTime() ?? null)
      );
      if (changed.length === 0) continue;
      datesFixed++;
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}fix dates ${s.submissionId}: ` +
          changed.map((k) => `${k} ${s[k]?.toISOString().slice(0, 10) ?? "null"} → ${corrected[k]?.toISOString().slice(0, 10) ?? "null"}`).join(", ")
      );
      if (!DRY_RUN) {
        await db.submission.update({
          where: { id: s.id, tenantId: tenant.id },
          data: Object.fromEntries(changed.map((k) => [k, corrected[k]])),
        });
        progress();
      }
    }
  }

  console.log(
    `\nDone. ${DRY_RUN ? "(dry run, nothing written) " : ""}` +
      `${requirementsCreated} requirements created, ${migrated} submissions created` +
      `${SKIP_FILES || DRY_RUN ? "" : ` (${resumesLinked} with resume)`}` +
      `${FIX_EXISTING_DATES ? `, ${datesFixed} existing submissions with corrected dates` : ""}.`
  );
  if (failures.length > 0) console.log(`Failed submissions (re-run to retry): ${failures.join(", ")}`);
  if (RELINK_RESUMES) {
    console.log(`Resumes re-linked: ${resumesRelinked}. Still without a resume: ${relinkFailures.length}`);
    for (const f of relinkFailures) console.log(`  - ${f}`);
  }

  async function migrateResumeFile(args: {
    driveFileId: string;
    fileName: string;
    tenantId: string;
    candidateId: string;
  }): Promise<string | null> {
    try {
      const meta = await drive.files.get({ fileId: args.driveFileId, fields: "mimeType" });
      // Native Google Docs have no binary content to download — they have to
      // be exported (the first run missed this and lost those resumes).
      const isGoogleDoc = meta.data.mimeType?.startsWith("application/vnd.google-apps.");
      const res = isGoogleDoc
        ? await drive.files.export(
            { fileId: args.driveFileId, mimeType: "application/pdf" },
            { responseType: "arraybuffer" }
          )
        : await drive.files.get(
            { fileId: args.driveFileId, alt: "media" },
            { responseType: "arraybuffer" }
          );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      const fileName = isGoogleDoc && !/\.pdf$/i.test(args.fileName) ? `${args.fileName}.pdf` : args.fileName;
      const fileSha256 = sha256Buffer(buffer);

      const existing = await db.resume.findFirst({ where: { tenantId: args.tenantId, fileSha256 } });
      if (existing) return existing.id;

      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${args.tenantId}/${args.candidateId}/${fileSha256}-${safeFileName}`;
      const { error } = await getSupabaseAdmin()
        .storage.from(RESUME_BUCKET)
        .upload(storagePath, buffer, { upsert: true });
      if (error) throw error;

      const resume = await db.resume.create({
        data: {
          tenantId: args.tenantId,
          candidateId: args.candidateId,
          fileUrl: storagePath,
          fileName,
          fileSizeBytes: buffer.byteLength,
          fileSha256,
          sourceDriveFileId: args.driveFileId,
          source: "migration",
        },
      });
      return resume.id;
    } catch (err) {
      console.warn(`  ! resume download failed for Drive file ${args.driveFileId}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
