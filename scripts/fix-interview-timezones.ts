// One-off: corrects interview times saved before the timezone fix.
//
// Until that fix, createInterview/updateInterview did `new Date(scheduledAt)`
// on the raw datetime-local value ("2026-10-02T10:00"), which on Vercel reads
// it as UTC instead of in the interview's own Timezone field — so 10:00
// America/New_York was stored as 10:00Z (and displayed back as 6:00 AM).
// This re-reads each affected row's stored UTC wall-clock time in its own
// timezone, which is what the recruiter originally typed.
//
// Only rows last saved before --before (the moment the fix went live) are
// touched; correcting a row bumps its updatedAt past that, so re-running is a
// no-op. No interviews came from the GAS migration (every row was entered in
// the app), so there's no legacy data to exclude. Calendar events already
// sent are NOT re-synced — that would re-email every candidate; re-save an
// interview in the app to push its corrected time to the calendar.
//
// Caveat: an interview edited more than once before the fix drifted again
// on each re-save (the edit form pre-filled in the browser's zone), so its
// original time can't be recovered exactly — those are flagged for a manual
// check rather than silently trusted.
//
// Usage:
//   npx tsx scripts/fix-interview-timezones.ts --before=2026-10-03T04:00:00Z           # preview only
//   npx tsx scripts/fix-interview-timezones.ts --before=2026-10-03T04:00:00Z --apply   # write

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { isValidTimeZone, zonedLocalToUtc } from "../src/lib/timezone";

const APPLY = process.argv.includes("--apply");
const beforeArg = process.argv.find((a) => a.startsWith("--before="))?.slice("--before=".length);
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

async function main() {
  const before = beforeArg ? new Date(beforeArg) : null;
  if (!before || Number.isNaN(before.getTime())) {
    console.error("Pass --before=<ISO timestamp of when the timezone fix was deployed>.");
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant with subdomain "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id);

  const interviews = await db.interview.findMany({
    where: { tenantId: tenant.id, scheduledAt: { not: null }, updatedAt: { lt: before } },
    include: { submission: { include: { candidate: { select: { name: true } } } } },
    orderBy: { scheduledAt: "asc" },
  });
  console.log(`${interviews.length} interview(s) last saved before ${before.toISOString()}.`);

  let fixed = 0;
  for (const i of interviews) {
    const tz = i.timezone && isValidTimeZone(i.timezone) ? i.timezone : null;
    if (!tz) {
      console.warn(`  ! ${i.id} (${i.submission.candidate.name}): timezone "${i.timezone}" isn't valid — fix by hand`);
      continue;
    }
    // The stored instant's UTC clock reading is what was typed into the form.
    const typed = i.scheduledAt!.toISOString().slice(0, 16);
    const corrected = zonedLocalToUtc(typed, tz)!;
    if (corrected.getTime() === i.scheduledAt!.getTime()) continue; // UTC (or a zero-offset zone) — nothing to do

    const editedAfterCreate = i.updatedAt.getTime() - i.createdAt.getTime() > 5000;
    console.log(
      `  ${i.submission.candidate.name} — ${i.interviewType}: ${typed} ${tz} | ` +
        `${i.scheduledAt!.toISOString()} → ${corrected.toISOString()}` +
        (editedAfterCreate ? "  [edited after creation — double-check this one]" : "") +
        (i.googleEventId || i.outlookEventId ? "  [has calendar event — re-save in app to update it]" : "")
    );
    if (APPLY) {
      await db.interview.update({ where: { id: i.id }, data: { scheduledAt: corrected } });
    }
    fixed++;
  }

  console.log(`${APPLY ? "Corrected" : "Would correct"} ${fixed} interview(s).${APPLY ? "" : " Re-run with --apply to write."}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
