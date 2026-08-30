// One-shot migration: pulls the N most recently submitted candidates
// (default 100, MIGRATION_SUBMISSION_LIMIT) from the source Apps Script app's
// "Recruitment" sheet, plus the "Requirements" (JD) rows they reference, into
// the new Postgres schema. Resume files are downloaded from Drive and
// re-uploaded to Supabase Storage.
//
// Idempotent: re-running upserts on (tenantId, legacyId) / (tenantId, jobId) /
// (tenantId, identityHash), so a partial or repeated run won't duplicate rows.
//
// Usage:
//   npx tsx scripts/migrate-recent-submissions.ts [--dry-run] [--skip-files]

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getGoogleClients, readSheetAsObjects } from "./lib/sheets";
import {
  parseSheetDate,
  parseDecimal,
  parseInt10,
  parseBool,
  candidateIdentityHash,
  sha256Buffer,
} from "./lib/parse";
import { supabaseAdmin, RESUME_BUCKET } from "../src/lib/supabase/admin";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_FILES = process.argv.includes("--skip-files");
const LIMIT = Number(process.env.MIGRATION_SUBMISSION_LIMIT ?? 100);
const SPREADSHEET_ID = process.env.GAS_SPREADSHEET_ID;
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GAS_SPREADSHEET_ID is not set.");

  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) {
    throw new Error(
      `No tenant "${TENANT_SUBDOMAIN}" — run \`npx prisma db seed\` before migrating.`
    );
  }

  console.log(`Reading source sheets from ${SPREADSHEET_ID}...`);
  const { sheets, drive } = getGoogleClients();
  const [requirementRows, recruitmentRows] = await Promise.all([
    readSheetAsObjects(sheets, SPREADSHEET_ID, "Requirements"),
    readSheetAsObjects(sheets, SPREADSHEET_ID, "Recruitment"),
  ]);
  console.log(
    `Found ${requirementRows.length} requirement rows, ${recruitmentRows.length} submission rows.`
  );

  const recentSubmissions = recruitmentRows
    .filter((r) => parseSheetDate(r.SubmissionDate) !== null)
    .sort(
      (a, b) =>
        parseSheetDate(b.SubmissionDate)!.getTime() -
        parseSheetDate(a.SubmissionDate)!.getTime()
    )
    .slice(0, LIMIT);
  console.log(`Migrating the ${recentSubmissions.length} most recent submissions.`);

  const referencedJobIds = new Set(
    recentSubmissions.map((r) => r.RequirementJobID).filter(Boolean)
  );
  const requirementsToMigrate = requirementRows.filter((r) =>
    referencedJobIds.has(r.JobID)
  );

  // --- Requirements (JDs) ---
  const requirementIdByJobId = new Map<string, string>();
  for (const row of requirementsToMigrate) {
    const data = {
      tenantId: tenant.id,
      legacyId: parseInt10(row.ID),
      jobId: row.JobID,
      jobTitle: row.JobTitle || "(untitled)",
      jobDescription: row.JobDescription || null,
      duration: row.Duration || null,
      visa: row.Visa || null,
      mandatorySkills: row.MandatorySkills || null,
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
      cpocRaw: row.CPOC || null,
      regions: {
        other: row.OtherCountryName || null,
        europe: row.EuropeCountries || null,
        apac: row.ApacCountries || null,
        uae: row.UaeCountries || null,
        southAmerica: row.SouthAmericaCountries || null,
      },
    };

    if (DRY_RUN) {
      console.log(`[dry-run] requirement ${data.jobId}: ${data.jobTitle}`);
      continue;
    }

    const saved = await prisma.requirement.upsert({
      where: { tenantId_jobId: { tenantId: tenant.id, jobId: data.jobId } },
      update: data,
      create: data,
    });
    requirementIdByJobId.set(data.jobId, saved.id);
  }

  // --- Submissions (+ candidates + resumes) ---
  let migrated = 0;
  for (const row of recentSubmissions) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null) {
      console.warn(`  ! skipping submission row with no numeric ID: ${row.CandidateName}`);
      continue;
    }
    const email = row.EmailID || null;
    const phone = row.ContactNumber || null;
    const identityHash = candidateIdentityHash(email, phone, `legacy-${legacyId}`);

    if (DRY_RUN) {
      console.log(
        `[dry-run] submission ${legacyId}: ${row.CandidateName} -> ${row.RequirementJobID} (${row.Status})`
      );
      continue;
    }

    try {
    const candidate = await prisma.candidate.upsert({
      where: { tenantId_identityHash: { tenantId: tenant.id, identityHash } },
      update: {
        name: row.CandidateName || "(unnamed)",
        email,
        phone,
        currentLocation: row.CurrentLocation || null,
        totalExperienceYears: parseDecimal(row.TotalExperience),
        visaStatus: row.VisaStatus || null,
        linkedinUrl: row.LinkedinURL || null,
      },
      create: {
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
    });

    let resumeId: string | null = null;
    if (!SKIP_FILES && row.ResumeFileId) {
      resumeId = await migrateResumeFile({
        driveFileId: row.ResumeFileId,
        fileName: row.ResumeFileName || `resume-${legacyId}`,
        tenantId: tenant.id,
        candidateId: candidate.id,
      });
    }

    const requirementId = requirementIdByJobId.get(row.RequirementJobID) ?? null;

    await prisma.submission.upsert({
      where: { tenantId_legacyId: { tenantId: tenant.id, legacyId } },
      update: {},
      create: {
        tenantId: tenant.id,
        legacyId,
        candidateId: candidate.id,
        resumeId,
        requirementId,
        requirementJobIdRaw: row.RequirementJobID || null,
        roleWithSkills: row.RoleWithSkills || null,
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

    migrated++;
    } catch (err) {
      console.warn(`  ! skipping submission ${legacyId} (${row.CandidateName}):`, err);
    }
    if (migrated % 10 === 0) console.log(`  ...${migrated}/${recentSubmissions.length}`);
  }

  console.log(
    `Done. ${DRY_RUN ? "(dry run, nothing written) " : ""}` +
      `${requirementsToMigrate.length} requirements, ${migrated} submissions.`
  );

  async function migrateResumeFile(args: {
    driveFileId: string;
    fileName: string;
    tenantId: string;
    candidateId: string;
  }): Promise<string | null> {
    try {
      const res = await drive.files.get(
        { fileId: args.driveFileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const buffer = Buffer.from(res.data as ArrayBuffer);
      const fileSha256 = sha256Buffer(buffer);

      const existing = await prisma.resume.findFirst({
        where: { tenantId: args.tenantId, fileSha256 },
      });
      if (existing) return existing.id;

      const safeFileName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${args.tenantId}/${args.candidateId}/${fileSha256}-${safeFileName}`;
      const { error } = await supabaseAdmin.storage
        .from(RESUME_BUCKET)
        .upload(storagePath, buffer, { upsert: true });
      if (error) throw error;

      const resume = await prisma.resume.create({
        data: {
          tenantId: args.tenantId,
          candidateId: args.candidateId,
          fileUrl: storagePath,
          fileName: args.fileName,
          fileSizeBytes: buffer.byteLength,
          fileSha256,
          sourceDriveFileId: args.driveFileId,
          source: "migration",
        },
      });
      return resume.id;
    } catch (err) {
      console.warn(`  ! resume download failed for Drive file ${args.driveFileId}:`, err);
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
    await pool.end();
  });
