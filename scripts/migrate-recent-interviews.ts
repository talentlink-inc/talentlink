// Migrates GAS Interviews from the last N months (default 3, by InterviewDate,
// falling back to CreatedDate) onto the submissions already migrated by
// migrate-recent-submissions.ts / migrate-oldest-requirements.ts.
//
// - An interview's SubmissionID is the GAS Recruitment row ID, i.e. our
//   Submission.legacyId. Interviews whose submission hasn't been migrated
//   yet are skipped and listed — migrate that submission first, then re-run.
// - InterviewDate + InterviewTime are wall-clock time in the row's Timezone,
//   which GAS stores as an abbreviation (EST/CST/MST/PST/IST). These are
//   mapped to IANA zones (EST -> America/New_York, so DST is handled the way
//   recruiters actually meant it) because the app now validates Timezone.
// - Calendar events are NOT created: these already went out from GAS.
// - Idempotent: matched on (tenantId, legacyId); existing rows are skipped.
//
// Usage:
//   npx tsx scripts/migrate-recent-interviews.ts --dry-run
//   npx tsx scripts/migrate-recent-interviews.ts
//   MIGRATION_INTERVIEW_MONTHS=6 npx tsx scripts/migrate-recent-interviews.ts

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { INTERVIEW_STATUSES } from "../src/lib/recruitment";
import { zonedLocalToUtc } from "../src/lib/timezone";
import { getGoogleClients, readSheetAsObjects } from "./lib/sheets";
import { DEFAULT_TIME_ZONE, MODES, TIME_ZONES, normalizeDate, normalizeTime, parseInt10, parseSheetDate } from "./lib/parse";

const DRY_RUN = process.argv.includes("--dry-run");
const MONTHS = Number(process.env.MIGRATION_INTERVIEW_MONTHS ?? 3);
const SPREADSHEET_ID = process.env.GAS_SPREADSHEET_ID;
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";


type Row = Record<string, string>;

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GAS_SPREADSHEET_ID is not set.");

  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant with subdomain "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id);

  const { sheets } = getGoogleClients();
  const rows: Row[] = await readSheetAsObjects(sheets, SPREADSHEET_ID, "Interviews");

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS);
  console.log(`${rows.length} interview rows in the sheet; keeping those since ${cutoff.toISOString().slice(0, 10)}.`);

  const [submissions, existing, users] = await Promise.all([
    db.submission.findMany({
      where: { tenantId: tenant.id, legacyId: { not: null } },
      select: { id: true, legacyId: true },
    }),
    db.interview.findMany({ where: { tenantId: tenant.id, legacyId: { not: null } }, select: { legacyId: true } }),
    db.user.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true } }),
  ]);
  const submissionByLegacyId = new Map(submissions.map((s) => [s.legacyId!, s.id]));
  const existingLegacyIds = new Set(existing.map((i) => i.legacyId!));
  const userIdByName = new Map(users.map((u) => [u.name.trim().toLowerCase(), u.id]));

  let created = 0;
  let alreadyMigrated = 0;
  const missingSubmission: string[] = [];
  const unparseable: string[] = [];

  for (const row of rows) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null) continue;

    const date = normalizeDate(row.InterviewDate ?? "");
    const time = normalizeTime(row.InterviewTime ?? "") ?? "09:00";
    const tzAbbrev = (row.Timezone ?? "").trim().toUpperCase();
    const timezone = TIME_ZONES[tzAbbrev] ?? DEFAULT_TIME_ZONE;
    const scheduledAt = date ? zonedLocalToUtc(`${date}T${time}`, timezone) : null;

    const relevantDate = scheduledAt ?? parseSheetDate(row.CreatedDate);
    if (!relevantDate || relevantDate < cutoff) continue;

    const label = `#${legacyId} ${row.CandidateName} (${row.InterviewType}, ${row.InterviewDate} ${row.InterviewTime} ${row.Timezone})`;
    if (existingLegacyIds.has(legacyId)) {
      alreadyMigrated++;
      continue;
    }
    if (!scheduledAt) {
      unparseable.push(label);
      continue;
    }
    const submissionId = submissionByLegacyId.get(parseInt10(row.SubmissionID) ?? -1);
    if (!submissionId) {
      missingSubmission.push(`${label} → GAS submission ${row.SubmissionID}`);
      continue;
    }

    const status = (INTERVIEW_STATUSES as readonly string[]).includes(row.Status) ? row.Status : "Scheduled";
    const durationMinutes = parseInt10(row.Duration);
    const scheduledByName = row.ScheduledBy?.trim() || null;
    const data = {
      tenantId: tenant.id,
      legacyId,
      submissionId,
      interviewType: row.InterviewType?.trim() || "L1",
      scheduledAt,
      timezone,
      durationMinutes: durationMinutes && durationMinutes > 0 ? durationMinutes : null,
      mode: MODES[(row.InterviewMode ?? "").trim().toLowerCase()] ?? null,
      clientCompany: row.ClientCompany?.trim() || null,
      status,
      feedback: row.Feedback?.trim() || null,
      scheduledByUserId: scheduledByName ? userIdByName.get(scheduledByName.toLowerCase()) ?? null : null,
      scheduledByNameRaw: scheduledByName,
      outlookEventId: row.OutlookEventId?.trim() || null,
      infoAlertEventIds: row.InfoAlertEventIds?.trim() || null,
      createdAt: parseSheetDate(row.CreatedDate) ?? undefined,
    };

    console.log(`${DRY_RUN ? "[dry-run] " : ""}${label} → ${scheduledAt.toISOString()} ${timezone}, ${status}`);
    if (!DRY_RUN) await db.interview.create({ data });
    created++;
  }

  console.log(
    `\n${DRY_RUN ? "Would create" : "Created"} ${created} interview(s); ${alreadyMigrated} already migrated.`
  );
  if (missingSubmission.length) {
    console.log(`\nSkipped ${missingSubmission.length} whose submission isn't migrated yet:`);
    missingSubmission.forEach((m) => console.log(`  - ${m}`));
  }
  if (unparseable.length) {
    console.log(`\nSkipped ${unparseable.length} with an unreadable date/time:`);
    unparseable.forEach((m) => console.log(`  - ${m}`));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
